package com.lifetrack.data.local

import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Architecture boundary abstraction for the local task storage engine.
 */
interface TaskLocalDataSource {
    fun observeTasks(): Flow<List<Task>>
    suspend fun getTaskById(id: String): Task?
    suspend fun upsertTask(task: Task): Task
    suspend fun deleteTask(id: String): Boolean
    suspend fun upsertSubtask(subtask: Subtask): Task?
    suspend fun deleteSubtask(taskId: String, subtaskId: String): Task?
}

/**
 * Thread-safe In-Memory local data source for Phase 1 architecture verification across Android and Desktop.
 */
class InMemoryTaskLocalDataSource(
    private val timeProvider: TimeProvider = SystemTimeProvider()
) : TaskLocalDataSource {

    private val mutex = Mutex()
    private val tasksFlow = MutableStateFlow<Map<String, Task>>(initialSeedData())

    override fun observeTasks(): Flow<List<Task>> {
        return tasksFlow.asStateFlow().map { map ->
            map.values
                .filterNot { it.isDeleted }
                .sortedWith(
                    compareByDescending<Task> { it.isStarred }
                        .thenBy { it.isCompleted }
                        .thenByDescending { it.createdAtEpochMs }
                )
        }
    }

    override suspend fun getTaskById(id: String): Task? {
        return mutex.withLock {
            tasksFlow.value[id]?.takeIf { !it.isDeleted }
        }
    }

    override suspend fun upsertTask(task: Task): Task {
        return mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            val now = timeProvider.nowEpochMs()
            val existing = current[task.id]
            val updatedTask = if (existing != null) {
                task.copy(updatedAtEpochMs = now)
            } else {
                task.copy(
                    createdAtEpochMs = if (task.createdAtEpochMs > 0L) task.createdAtEpochMs else now,
                    updatedAtEpochMs = now
                )
            }
            current[task.id] = updatedTask
            tasksFlow.value = current
            updatedTask
        }
    }

    override suspend fun deleteTask(id: String): Boolean {
        return mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            val existing = current[id]
            if (existing != null) {
                val now = timeProvider.nowEpochMs()
                current[id] = existing.copy(isDeleted = true, updatedAtEpochMs = now)
                tasksFlow.value = current
                true
            } else {
                false
            }
        }
    }

    override suspend fun upsertSubtask(subtask: Subtask): Task? {
        return mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            val parent = current[subtask.taskId]
            if (parent != null) {
                val now = timeProvider.nowEpochMs()
                val updatedSub = subtask.copy(updatedAtEpochMs = now)
                val newSubtasks = parent.subtasks.filterNot { it.id == subtask.id } + updatedSub
                val updatedParent = parent.copy(
                    subtasks = newSubtasks,
                    updatedAtEpochMs = now
                )
                current[parent.id] = updatedParent
                tasksFlow.value = current
                updatedParent
            } else {
                null
            }
        }
    }

    override suspend fun deleteSubtask(taskId: String, subtaskId: String): Task? {
        return mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            val parent = current[taskId]
            if (parent != null) {
                val now = timeProvider.nowEpochMs()
                val newSubtasks = parent.subtasks.filterNot { it.id == subtaskId }
                val updatedParent = parent.copy(
                    subtasks = newSubtasks,
                    updatedAtEpochMs = now
                )
                current[parent.id] = updatedParent
                tasksFlow.value = current
                updatedParent
            } else {
                null
            }
        }
    }

    private fun initialSeedData(): Map<String, Task> {
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

        return mapOf(
            sample1.id to sample1,
            sample2.id to sample2,
            sample3.id to sample3,
            sample4.id to sample4
        )
    }
}
