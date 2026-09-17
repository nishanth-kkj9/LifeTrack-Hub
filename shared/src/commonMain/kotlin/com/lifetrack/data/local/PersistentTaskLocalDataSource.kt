package com.lifetrack.data.local

import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.local.db.SqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Production-ready durable TaskLocalDataSource implementation backed by a SQL storage engine.
 *
 * Guarantees:
 * 1. Normalized relational storage with explicit columns for all Task properties (no full-object blobs).
 * 2. Foreign-key subtask relationships persisted in relational child tables.
 * 3. Schema versioning and migration readiness via TaskDatabaseSchema.
 * 4. Thread-safe atomic transactions and mutations.
 * 5. Reactive flow emissions reflecting the current database state.
 */
class PersistentTaskLocalDataSource(
    private val driver: SqlDriver,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    seedIfEmpty: Boolean = true
) : TaskLocalDataSource, AutoCloseable {

    private val mutex = Mutex()
    private val tasksFlow = MutableStateFlow<List<Task>>(emptyList())

    init {
        TaskDatabaseSchema.initializeSchema(driver)
        if (seedIfEmpty) {
            val existing = queryAllNonDeletedTasks()
            if (existing.isEmpty()) {
                seedInitialData()
            }
        }
        refreshTasksFlow()
    }

    override fun observeTasks(): Flow<List<Task>> {
        return tasksFlow.asStateFlow()
    }

    override suspend fun getTaskById(id: String): Task? {
        return mutex.withLock {
            queryTaskById(id)
        }
    }

    override suspend fun upsertTask(task: Task): Task {
        return mutex.withLock {
            val now = timeProvider.nowEpochMs()
            val existing = queryTaskById(task.id)
            val updatedTask = if (existing != null) {
                task.copy(updatedAtEpochMs = now)
            } else {
                task.copy(
                    createdAtEpochMs = if (task.createdAtEpochMs > 0L) task.createdAtEpochMs else now,
                    updatedAtEpochMs = now
                )
            }

            driver.transaction {
                val tagsStr = updatedTask.tags.joinToString(",")
                driver.execute(
                    """
                    INSERT OR REPLACE INTO tasks (
                        id, title, description, category, priority, status,
                        due_date, due_time, due_date_epoch_ms, completed_at_epoch_ms,
                        estimated_minutes, actual_minutes, is_starred, recurrence,
                        tags, is_sync_pending, is_deleted, created_at_epoch_ms,
                        updated_at_epoch_ms, subject_id, exam_id, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """.trimIndent(),
                    arrayOf(
                        updatedTask.id,
                        updatedTask.title,
                        updatedTask.description,
                        updatedTask.category.name,
                        updatedTask.priority.name,
                        updatedTask.status.name,
                        updatedTask.dueDate,
                        updatedTask.dueTime,
                        updatedTask.dueDateEpochMs,
                        updatedTask.completedAtEpochMs,
                        updatedTask.estimatedMinutes,
                        updatedTask.actualMinutes,
                        if (updatedTask.isStarred) 1 else 0,
                        updatedTask.recurrence.name,
                        tagsStr,
                        if (updatedTask.isSyncPending) 1 else 0,
                        if (updatedTask.isDeleted) 1 else 0,
                        updatedTask.createdAtEpochMs,
                        updatedTask.updatedAtEpochMs,
                        updatedTask.subjectId,
                        updatedTask.examId,
                        updatedTask.notes
                    )
                )

                // Persist subtasks
                for (sub in updatedTask.subtasks) {
                    driver.execute(
                        """
                        INSERT OR REPLACE INTO subtasks (
                            id, task_id, title, completed, sort_order,
                            estimated_minutes, updated_at_epoch_ms, is_deleted
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                        """.trimIndent(),
                        arrayOf(
                            sub.id,
                            updatedTask.id,
                            sub.title,
                            if (sub.completed) 1 else 0,
                            sub.sortOrder,
                            sub.estimatedMinutes,
                            if (sub.updatedAtEpochMs > 0L) sub.updatedAtEpochMs else now,
                            if (sub.isDeleted) 1 else 0
                        )
                    )
                }
            }

            refreshTasksFlow()
            updatedTask
        }
    }

    override suspend fun deleteTask(id: String): Boolean {
        return mutex.withLock {
            val existing = queryTaskById(id)
            if (existing != null) {
                val now = timeProvider.nowEpochMs()
                driver.transaction {
                    driver.execute(
                        "UPDATE tasks SET is_deleted = 1, updated_at_epoch_ms = ?, is_sync_pending = 1 WHERE id = ?;",
                        arrayOf(now, id)
                    )
                    driver.execute(
                        "UPDATE subtasks SET is_deleted = 1, updated_at_epoch_ms = ? WHERE task_id = ?;",
                        arrayOf(now, id)
                    )
                }
                refreshTasksFlow()
                true
            } else {
                false
            }
        }
    }

    override suspend fun upsertSubtask(subtask: Subtask): Task? {
        return mutex.withLock {
            val parent = queryTaskById(subtask.taskId) ?: return@withLock null
            val now = timeProvider.nowEpochMs()
            val updatedSub = subtask.copy(updatedAtEpochMs = now)

            driver.transaction {
                driver.execute(
                    """
                    INSERT OR REPLACE INTO subtasks (
                        id, task_id, title, completed, sort_order,
                        estimated_minutes, updated_at_epoch_ms, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """.trimIndent(),
                    arrayOf(
                        updatedSub.id,
                        updatedSub.taskId,
                        updatedSub.title,
                        if (updatedSub.completed) 1 else 0,
                        updatedSub.sortOrder,
                        updatedSub.estimatedMinutes,
                        updatedSub.updatedAtEpochMs,
                        if (updatedSub.isDeleted) 1 else 0
                    )
                )

                driver.execute(
                    "UPDATE tasks SET updated_at_epoch_ms = ?, is_sync_pending = 1 WHERE id = ?;",
                    arrayOf(now, parent.id)
                )
            }

            refreshTasksFlow()
            queryTaskById(parent.id)
        }
    }

    override suspend fun deleteSubtask(taskId: String, subtaskId: String): Task? {
        return mutex.withLock {
            val parent = queryTaskById(taskId) ?: return@withLock null
            val now = timeProvider.nowEpochMs()

            driver.transaction {
                driver.execute(
                    "UPDATE subtasks SET is_deleted = 1, updated_at_epoch_ms = ? WHERE id = ? AND task_id = ?;",
                    arrayOf(now, subtaskId, taskId)
                )

                driver.execute(
                    "UPDATE tasks SET updated_at_epoch_ms = ?, is_sync_pending = 1 WHERE id = ?;",
                    arrayOf(now, taskId)
                )
            }

            refreshTasksFlow()
            queryTaskById(taskId)
        }
    }

    override fun close() {
        driver.close()
    }

    private fun refreshTasksFlow() {
        tasksFlow.value = queryAllNonDeletedTasks()
    }

    private fun queryAllNonDeletedTasks(): List<Task> {
        val tasks = driver.query(
            "SELECT * FROM tasks WHERE is_deleted = 0;"
        ) { cursor ->
            mapTaskCursor(cursor)
        }

        return tasks.map { task ->
            val subtasks = querySubtasksForTask(task.id)
            task.copy(subtasks = subtasks)
        }.sortedWith(
            compareByDescending<Task> { it.isStarred }
                .thenBy { it.isCompleted }
                .thenByDescending { it.createdAtEpochMs }
        )
    }

    private fun queryTaskById(id: String): Task? {
        val task = driver.query(
            "SELECT * FROM tasks WHERE id = ? AND is_deleted = 0 LIMIT 1;",
            arrayOf(id)
        ) { cursor ->
            mapTaskCursor(cursor)
        }.firstOrNull() ?: return null

        val subtasks = querySubtasksForTask(id)
        return task.copy(subtasks = subtasks)
    }

    private fun querySubtasksForTask(taskId: String): List<Subtask> {
        return driver.query(
            "SELECT * FROM subtasks WHERE task_id = ? AND is_deleted = 0 ORDER BY sort_order ASC;",
            arrayOf(taskId)
        ) { cursor ->
            Subtask(
                id = cursor.getString(0) ?: "",
                taskId = cursor.getString(1) ?: "",
                title = cursor.getString(2) ?: "",
                completed = cursor.getInt(3) == 1,
                sortOrder = cursor.getInt(4) ?: 0,
                estimatedMinutes = cursor.getInt(5),
                updatedAtEpochMs = cursor.getLong(6) ?: 0L,
                isDeleted = cursor.getInt(7) == 1
            )
        }
    }

    private fun mapTaskCursor(cursor: com.lifetrack.data.local.db.SqlCursor): Task {
        val id = cursor.getString(0) ?: ""
        val title = cursor.getString(1) ?: ""
        val description = cursor.getString(2) ?: ""
        val categoryName = cursor.getString(3) ?: TaskCategory.PERSONAL.name
        val priorityName = cursor.getString(4) ?: TaskPriority.MEDIUM.name
        val statusName = cursor.getString(5) ?: TaskStatus.TODO.name
        val dueDate = cursor.getString(6)
        val dueTime = cursor.getString(7)
        val dueDateEpochMs = cursor.getLong(8)
        val completedAtEpochMs = cursor.getLong(9)
        val estimatedMinutes = cursor.getInt(10)
        val actualMinutes = cursor.getInt(11)
        val isStarred = cursor.getInt(12) == 1
        val recurrenceName = cursor.getString(13) ?: TaskRecurrence.NONE.name
        val tagsStr = cursor.getString(14) ?: ""
        val isSyncPending = cursor.getInt(15) == 1
        val isDeleted = cursor.getInt(16) == 1
        val createdAtEpochMs = cursor.getLong(17) ?: 0L
        val updatedAtEpochMs = cursor.getLong(18) ?: 0L
        val subjectId = cursor.getString(19)
        val examId = cursor.getString(20)
        val notes = cursor.getString(21)

        val tags = if (tagsStr.isNotBlank()) tagsStr.split(",").filter { it.isNotBlank() } else emptyList()

        return Task(
            id = id,
            title = title,
            description = description,
            category = runCatching { TaskCategory.valueOf(categoryName) }.getOrDefault(TaskCategory.PERSONAL),
            priority = runCatching { TaskPriority.valueOf(priorityName) }.getOrDefault(TaskPriority.MEDIUM),
            status = runCatching { TaskStatus.valueOf(statusName) }.getOrDefault(TaskStatus.TODO),
            dueDate = dueDate,
            dueTime = dueTime,
            dueDateEpochMs = dueDateEpochMs,
            completedAtEpochMs = completedAtEpochMs,
            estimatedMinutes = estimatedMinutes,
            actualMinutes = actualMinutes,
            isStarred = isStarred,
            recurrence = runCatching { TaskRecurrence.valueOf(recurrenceName) }.getOrDefault(TaskRecurrence.NONE),
            subtasks = emptyList(),
            tags = tags,
            isSyncPending = isSyncPending,
            isDeleted = isDeleted,
            createdAtEpochMs = createdAtEpochMs,
            updatedAtEpochMs = updatedAtEpochMs,
            subjectId = subjectId,
            examId = examId,
            notes = notes
        )
    }

    private fun seedInitialData() {
        val now = 1710000000000L
        val sample1 = Task(
            id = "seed-task-1",
            title = "VTU Computer Networks Lab Record Submission",
            description = "Complete simulation graphs for NS2 Part B experiments and Wireshark traces",
            category = TaskCategory.VTU,
            priority = TaskPriority.URGENT,
            status = TaskStatus.TODO,
            dueDate = "2026-09-20",
            dueTime = "14:00",
            createdAtEpochMs = now,
            updatedAtEpochMs = now,
            estimatedMinutes = 120,
            isStarred = true,
            recurrence = TaskRecurrence.NONE,
            subtasks = listOf(
                Subtask("sub-1", "seed-task-1", "Graph congestion window vs time for TCP Reno", completed = true, updatedAtEpochMs = now),
                Subtask("sub-2", "seed-task-1", "Print Wireshark packet capture logs", completed = false, updatedAtEpochMs = now),
                Subtask("sub-3", "seed-task-1", "Get lab instructor signature", completed = false, updatedAtEpochMs = now)
            ),
            tags = listOf("vtu", "lab", "cn", "networks")
        )
        val sample2 = Task(
            id = "seed-task-2",
            title = "Review Microcontroller Architecture Module 4",
            description = "8051 timers, counters and serial interrupts for upcoming CIE",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.HIGH,
            status = TaskStatus.TODO,
            dueDate = "2026-09-22",
            dueTime = "18:00",
            createdAtEpochMs = now,
            updatedAtEpochMs = now,
            estimatedMinutes = 90,
            isStarred = true,
            recurrence = TaskRecurrence.NONE,
            subtasks = listOf(
                Subtask("sub-4", "seed-task-2", "Review TMOD and TCON bit configurations", completed = true, updatedAtEpochMs = now),
                Subtask("sub-5", "seed-task-2", "Solve 5 VTU previous year question papers", completed = false, updatedAtEpochMs = now)
            ),
            tags = listOf("exam", "theory", "cie")
        )
        val sample3 = Task(
            id = "seed-task-3",
            title = "College Semester Exam Fee Verification",
            description = "Online student portal payment receipt downloaded and submitted",
            category = TaskCategory.FINANCE,
            priority = TaskPriority.HIGH,
            status = TaskStatus.COMPLETED,
            completedAtEpochMs = now,
            createdAtEpochMs = now,
            updatedAtEpochMs = now,
            estimatedMinutes = 15,
            isStarred = false,
            tags = listOf("fees", "vtu")
        )
        val sample4 = Task(
            id = "seed-task-4",
            title = "LifeTrack KMP Architecture Canonicalization",
            description = "Consolidate root and lifetrack modules into unified production multiplatform core",
            category = TaskCategory.PROJECT,
            priority = TaskPriority.URGENT,
            status = TaskStatus.IN_PROGRESS,
            createdAtEpochMs = now,
            updatedAtEpochMs = now,
            estimatedMinutes = 45,
            isStarred = true,
            tags = listOf("kmp", "compose", "architecture")
        )

        for (task in listOf(sample1, sample2, sample3, sample4)) {
            val tagsStr = task.tags.joinToString(",")
            driver.execute(
                """
                INSERT OR REPLACE INTO tasks (
                    id, title, description, category, priority, status,
                    due_date, due_time, due_date_epoch_ms, completed_at_epoch_ms,
                    estimated_minutes, actual_minutes, is_starred, recurrence,
                    tags, is_sync_pending, is_deleted, created_at_epoch_ms,
                    updated_at_epoch_ms, subject_id, exam_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """.trimIndent(),
                arrayOf(
                    task.id, task.title, task.description, task.category.name,
                    task.priority.name, task.status.name, task.dueDate, task.dueTime,
                    task.dueDateEpochMs, task.completedAtEpochMs, task.estimatedMinutes,
                    task.actualMinutes, if (task.isStarred) 1 else 0, task.recurrence.name,
                    tagsStr, if (task.isSyncPending) 1 else 0, if (task.isDeleted) 1 else 0,
                    task.createdAtEpochMs, task.updatedAtEpochMs, task.subjectId, task.examId, task.notes
                )
            )
            for (sub in task.subtasks) {
                driver.execute(
                    """
                    INSERT OR REPLACE INTO subtasks (
                        id, task_id, title, completed, sort_order,
                        estimated_minutes, updated_at_epoch_ms, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """.trimIndent(),
                    arrayOf(
                        sub.id, sub.taskId, sub.title, if (sub.completed) 1 else 0,
                        sub.sortOrder, sub.estimatedMinutes, sub.updatedAtEpochMs, if (sub.isDeleted) 1 else 0
                    )
                )
            }
        }
    }
}
