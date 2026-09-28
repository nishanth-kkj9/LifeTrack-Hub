package com.lifetrack.data.local

import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.db.SqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.sync.SyncRecord
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class EntitySyncMetadata(
    val entityType: String,
    val entityId: String,
    val hlcTimestamp: String,
    val isDeleted: Boolean,
    val updatedAtEpochMs: Long
)

/**
 * Production-ready durable TaskLocalDataSource implementation backed by SQLite relational engine.
 * Guarantees:
 * 1. Normalized relational storage with explicit columns.
 * 2. Foreign-key subtask relationships.
 * 3. Schema versioning and migration readiness via TaskDatabaseSchema.
 * 4. Single-transaction atomic entity mutations + outbox events.
 * 5. Deterministic LWW conflict application and tombstone persistence.
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

    override fun observeTasks(): Flow<List<Task>> = tasksFlow.asStateFlow()

    override suspend fun getTaskById(id: String): Task? = mutex.withLock {
        queryTaskById(id)
    }

    override suspend fun upsertTask(task: Task): Task {
        return upsertTaskAtomic(task, null)
    }

    override suspend fun deleteTask(id: String): Boolean {
        return deleteTaskAtomic(id, null)
    }

    override suspend fun upsertSubtask(subtask: Subtask): Task? {
        return upsertSubtaskAtomic(subtask, null)
    }

    override suspend fun deleteSubtask(taskId: String, subtaskId: String): Task? {
        return deleteSubtaskAtomic(taskId, subtaskId, null)
    }

    /**
     * Executes atomic Task mutation + outbox event enqueueing within a single SQLite transaction.
     */
    suspend fun upsertTaskAtomic(task: Task, syncRecord: SyncRecord?): Task = mutex.withLock {
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

            // Insert subtasks if present
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
                        sub.taskId,
                        sub.title,
                        if (sub.completed) 1 else 0,
                        sub.sortOrder,
                        sub.estimatedMinutes,
                        if (sub.updatedAtEpochMs > 0L) sub.updatedAtEpochMs else now,
                        if (sub.isDeleted) 1 else 0
                    )
                )
            }

            // Atomically enqueue outbox event if provided
            if (syncRecord != null) {
                insertOutboxEvent(syncRecord)
                upsertEntitySyncMetadata(
                    entityType = "TASK",
                    entityId = updatedTask.id,
                    hlcTimestamp = syncRecord.hlcTimestamp,
                    isDeleted = updatedTask.isDeleted,
                    updatedAt = now
                )
            }
        }

        refreshTasksFlow()
        updatedTask
    }

    /**
     * Executes atomic Task deletion + outbox event enqueueing within a single SQLite transaction.
     */
    suspend fun deleteTaskAtomic(id: String, syncRecord: SyncRecord?): Boolean = mutex.withLock {
        val now = timeProvider.nowEpochMs()
        var deleted = false
        driver.transaction {
            val existing = queryTaskById(id)
            if (existing != null) {
                driver.execute(
                    """
                    UPDATE tasks
                    SET is_deleted = 1, updated_at_epoch_ms = ?, is_sync_pending = 1
                    WHERE id = ?;
                    """.trimIndent(),
                    arrayOf(now, id)
                )
                driver.execute(
                    """
                    UPDATE subtasks
                    SET is_deleted = 1, updated_at_epoch_ms = ?
                    WHERE task_id = ?;
                    """.trimIndent(),
                    arrayOf(now, id)
                )

                if (syncRecord != null) {
                    insertOutboxEvent(syncRecord)
                    upsertEntitySyncMetadata(
                        entityType = "TASK",
                        entityId = id,
                        hlcTimestamp = syncRecord.hlcTimestamp,
                        isDeleted = true,
                        updatedAt = now
                    )
                }
                deleted = true
            }
        }
        if (deleted) {
            refreshTasksFlow()
        }
        deleted
    }

    /**
     * Executes atomic Subtask mutation + outbox event within a single SQLite transaction.
     */
    suspend fun upsertSubtaskAtomic(subtask: Subtask, syncRecord: SyncRecord?): Task? = mutex.withLock {
        val now = timeProvider.nowEpochMs()
        var parentTask: Task? = null
        driver.transaction {
            val parent = queryTaskById(subtask.taskId)
            if (parent != null) {
                driver.execute(
                    """
                    INSERT OR REPLACE INTO subtasks (
                        id, task_id, title, completed, sort_order,
                        estimated_minutes, updated_at_epoch_ms, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """.trimIndent(),
                    arrayOf(
                        subtask.id,
                        subtask.taskId,
                        subtask.title,
                        if (subtask.completed) 1 else 0,
                        subtask.sortOrder,
                        subtask.estimatedMinutes,
                        now,
                        if (subtask.isDeleted) 1 else 0
                    )
                )

                driver.execute(
                    "UPDATE tasks SET updated_at_epoch_ms = ?, is_sync_pending = 1 WHERE id = ?;",
                    arrayOf(now, subtask.taskId)
                )

                if (syncRecord != null) {
                    insertOutboxEvent(syncRecord)
                    upsertEntitySyncMetadata(
                        entityType = "SUBTASK",
                        entityId = subtask.id,
                        hlcTimestamp = syncRecord.hlcTimestamp,
                        isDeleted = subtask.isDeleted,
                        updatedAt = now
                    )
                }
                parentTask = queryTaskById(subtask.taskId)
            }
        }
        if (parentTask != null) {
            refreshTasksFlow()
        }
        parentTask
    }

    /**
     * Executes atomic Subtask deletion + outbox event within a single SQLite transaction.
     */
    suspend fun deleteSubtaskAtomic(taskId: String, subtaskId: String, syncRecord: SyncRecord?): Task? = mutex.withLock {
        val now = timeProvider.nowEpochMs()
        var parentTask: Task? = null
        driver.transaction {
            val parent = queryTaskById(taskId)
            if (parent != null) {
                driver.execute(
                    "UPDATE subtasks SET is_deleted = 1, updated_at_epoch_ms = ? WHERE id = ?;",
                    arrayOf(now, subtaskId)
                )
                driver.execute(
                    "UPDATE tasks SET updated_at_epoch_ms = ?, is_sync_pending = 1 WHERE id = ?;",
                    arrayOf(now, taskId)
                )

                if (syncRecord != null) {
                    insertOutboxEvent(syncRecord)
                    upsertEntitySyncMetadata(
                        entityType = "SUBTASK",
                        entityId = subtaskId,
                        hlcTimestamp = syncRecord.hlcTimestamp,
                        isDeleted = true,
                        updatedAt = now
                    )
                }
                parentTask = queryTaskById(taskId)
            }
        }
        if (parentTask != null) {
            refreshTasksFlow()
        }
        parentTask
    }

    /**
     * Applies remote task UPSERT without re-enqueueing outbox events (isSyncPending = false).
     */
    suspend fun applyRemoteTaskUpsert(task: Task, hlcTimestamp: String, updatedAtMs: Long): Unit = mutex.withLock {
        driver.transaction {
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
                    task.id,
                    task.title,
                    task.description,
                    task.category.name,
                    task.priority.name,
                    task.status.name,
                    task.dueDate,
                    task.dueTime,
                    task.dueDateEpochMs,
                    task.completedAtEpochMs,
                    task.estimatedMinutes,
                    task.actualMinutes,
                    if (task.isStarred) 1 else 0,
                    task.recurrence.name,
                    tagsStr,
                    0, // not pending sync
                    if (task.isDeleted) 1 else 0,
                    task.createdAtEpochMs,
                    updatedAtMs,
                    task.subjectId,
                    task.examId,
                    task.notes
                )
            )

            upsertEntitySyncMetadata(
                entityType = "TASK",
                entityId = task.id,
                hlcTimestamp = hlcTimestamp,
                isDeleted = task.isDeleted,
                updatedAt = updatedAtMs
            )
        }
        refreshTasksFlow()
    }

    /**
     * Applies remote task DELETE (tombstone) without re-enqueueing outbox events.
     */
    suspend fun applyRemoteTaskDelete(taskId: String, hlcTimestamp: String, updatedAtMs: Long): Unit = mutex.withLock {
        driver.transaction {
            driver.execute(
                "UPDATE tasks SET is_deleted = 1, updated_at_epoch_ms = ?, is_sync_pending = 0 WHERE id = ?;",
                arrayOf(updatedAtMs, taskId)
            )
            upsertEntitySyncMetadata(
                entityType = "TASK",
                entityId = taskId,
                hlcTimestamp = hlcTimestamp,
                isDeleted = true,
                updatedAt = updatedAtMs
            )
        }
        refreshTasksFlow()
    }

    suspend fun getEntitySyncMetadata(entityType: String, entityId: String): EntitySyncMetadata? = mutex.withLock {
        driver.query(
            "SELECT entity_type, entity_id, hlc_timestamp, is_deleted, updated_at FROM entity_sync_metadata WHERE entity_type = ? AND entity_id = ? LIMIT 1;",
            arrayOf(entityType, entityId)
        ) { cursor ->
            EntitySyncMetadata(
                entityType = cursor.getString(0) ?: "",
                entityId = cursor.getString(1) ?: "",
                hlcTimestamp = cursor.getString(2) ?: "",
                isDeleted = (cursor.getInt(3) ?: 0) == 1,
                updatedAtEpochMs = cursor.getLong(4) ?: 0L
            )
        }.firstOrNull()
    }

    suspend fun clearTaskSyncPending(taskId: String): Unit = mutex.withLock {
        driver.execute(
            "UPDATE tasks SET is_sync_pending = 0 WHERE id = ?;",
            arrayOf(taskId)
        )
        refreshTasksFlow()
    }

    private fun insertOutboxEvent(syncRecord: SyncRecord) {
        driver.execute(
            """
            INSERT OR REPLACE INTO sync_outbox (
                id, entity_type, entity_id, operation, payload,
                hlc_timestamp, created_at, status, in_flight_at,
                retry_count, next_retry_at, last_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """.trimIndent(),
            arrayOf(
                syncRecord.id,
                syncRecord.entityType,
                syncRecord.entityId,
                syncRecord.operation,
                syncRecord.payload,
                syncRecord.hlcTimestamp,
                syncRecord.createdAt,
                syncRecord.status,
                syncRecord.inFlightAt,
                syncRecord.retryCount,
                syncRecord.nextRetryAt,
                syncRecord.lastError
            )
        )
    }

    private fun upsertEntitySyncMetadata(
        entityType: String,
        entityId: String,
        hlcTimestamp: String,
        isDeleted: Boolean,
        updatedAt: Long
    ) {
        driver.execute(
            """
            INSERT OR REPLACE INTO entity_sync_metadata (
                entity_type, entity_id, hlc_timestamp, is_deleted, updated_at
            ) VALUES (?, ?, ?, ?, ?);
            """.trimIndent(),
            arrayOf(
                entityType,
                entityId,
                hlcTimestamp,
                if (isDeleted) 1 else 0,
                updatedAt
            )
        )
    }

    private fun refreshTasksFlow() {
        tasksFlow.value = queryAllNonDeletedTasks()
    }

    private fun queryAllNonDeletedTasks(): List<Task> {
        val tasks = driver.query(
            "SELECT * FROM tasks WHERE is_deleted = 0;"
        ) { cursor ->
            mapCursorToTask(cursor)
        }

        return tasks.map { task ->
            val subtasks = driver.query(
                "SELECT * FROM subtasks WHERE task_id = ? AND is_deleted = 0 ORDER BY sort_order ASC;",
                arrayOf(task.id)
            ) { cursor ->
                mapCursorToSubtask(cursor)
            }
            task.copy(subtasks = subtasks)
        }
    }

    private fun queryTaskById(id: String): Task? {
        val task = driver.query(
            "SELECT * FROM tasks WHERE id = ? AND is_deleted = 0 LIMIT 1;",
            arrayOf(id)
        ) { cursor ->
            mapCursorToTask(cursor)
        }.firstOrNull() ?: return null

        val subtasks = driver.query(
            "SELECT * FROM subtasks WHERE task_id = ? AND is_deleted = 0 ORDER BY sort_order ASC;",
            arrayOf(id)
        ) { cursor ->
            mapCursorToSubtask(cursor)
        }
        return task.copy(subtasks = subtasks)
    }

    private fun mapCursorToTask(cursor: com.lifetrack.data.local.db.SqlCursor): Task {
        val id = cursor.getString(0) ?: ""
        val title = cursor.getString(1) ?: ""
        val description = cursor.getString(2) ?: ""
        val categoryStr = cursor.getString(3) ?: TaskCategory.PERSONAL.name
        val priorityStr = cursor.getString(4) ?: TaskPriority.MEDIUM.name
        val statusStr = cursor.getString(5) ?: TaskStatus.TODO.name
        val dueDate = cursor.getString(6)
        val dueTime = cursor.getString(7)
        val dueDateEpochMs = cursor.getLong(8)
        val completedAtEpochMs = cursor.getLong(9)
        val estimatedMinutes = cursor.getInt(10)
        val actualMinutes = cursor.getInt(11)
        val isStarred = (cursor.getInt(12) ?: 0) == 1
        val recurrenceStr = cursor.getString(13) ?: TaskRecurrence.NONE.name
        val tagsStr = cursor.getString(14) ?: ""
        val isSyncPending = (cursor.getInt(15) ?: 0) == 1
        val isDeleted = (cursor.getInt(16) ?: 0) == 1
        val createdAtEpochMs = cursor.getLong(17) ?: 0L
        val updatedAtEpochMs = cursor.getLong(18) ?: 0L
        val subjectId = cursor.getString(19)
        val examId = cursor.getString(20)
        val notes = cursor.getString(21)

        val category = try { TaskCategory.valueOf(categoryStr) } catch (_: Throwable) { TaskCategory.PERSONAL }
        val priority = try { TaskPriority.valueOf(priorityStr) } catch (_: Throwable) { TaskPriority.MEDIUM }
        val status = try { TaskStatus.valueOf(statusStr) } catch (_: Throwable) { TaskStatus.TODO }
        val recurrence = try { TaskRecurrence.valueOf(recurrenceStr) } catch (_: Throwable) { TaskRecurrence.NONE }
        val tags = if (tagsStr.isNotBlank()) tagsStr.split(",").filter { it.isNotBlank() } else emptyList()

        return Task(
            id = id,
            title = title,
            description = description,
            category = category,
            priority = priority,
            status = status,
            dueDate = dueDate,
            dueTime = dueTime,
            dueDateEpochMs = dueDateEpochMs,
            completedAtEpochMs = completedAtEpochMs,
            estimatedMinutes = estimatedMinutes,
            actualMinutes = actualMinutes,
            isStarred = isStarred,
            recurrence = recurrence,
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

    private fun mapCursorToSubtask(cursor: com.lifetrack.data.local.db.SqlCursor): Subtask {
        val id = cursor.getString(0) ?: ""
        val taskId = cursor.getString(1) ?: ""
        val title = cursor.getString(2) ?: ""
        val completed = (cursor.getInt(3) ?: 0) == 1
        val sortOrder = cursor.getInt(4) ?: 0
        val estimatedMinutes = cursor.getInt(5)
        val updatedAtEpochMs = cursor.getLong(6) ?: 0L
        val isDeleted = (cursor.getInt(7) ?: 0) == 1

        return Subtask(
            id = id,
            taskId = taskId,
            title = title,
            completed = completed,
            sortOrder = sortOrder,
            estimatedMinutes = estimatedMinutes,
            updatedAtEpochMs = updatedAtEpochMs,
            isDeleted = isDeleted
        )
    }

    private fun seedInitialData() {
        val now = 1710000000000L
        val samples = listOf(
            Task(
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
            ),
            Task(
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
            ),
            Task(
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
            ),
            Task(
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
        )

        driver.transaction {
            for (task in samples) {
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
                        tagsStr, 0, 0, task.createdAtEpochMs, task.updatedAtEpochMs,
                        task.subjectId, task.examId, task.notes
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
                            sub.sortOrder, sub.estimatedMinutes, sub.updatedAtEpochMs, 0
                        )
                    )
                }
            }
        }
    }

    override fun close() {
        driver.close()
    }
}
