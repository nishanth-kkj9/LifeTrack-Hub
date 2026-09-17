package com.lifetrack.data.local

import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Temporary thread-safe local data source used for Phase 1 architectural vertical verification.
 * Backs both Android and Desktop application shells until Phase 3 SQLite encryption.
 */
class InMemoryTaskLocalDataSource : TaskLocalDataSource {

    private val mutex = Mutex()
    private val tasksFlow = MutableStateFlow<Map<String, Task>>(initialSeedData())

    private fun initialSeedData(): Map<String, Task> {
        val now = 1710000000000L
        val sample1 = Task(
            id = "seed-task-1",
            title = "Complete Module 3 Data Structures Review",
            description = "Binary Search Trees, AVL Trees, and Graph Traversals for upcoming CIE",
            category = TaskCategory.STUDY,
            priority = TaskPriority.HIGH,
            status = TaskStatus.TODO,
            dueDate = "2026-09-20",
            dueTime = "18:00",
            createdAt = now,
            updatedAt = now,
            estimatedMinutes = 90,
            isStarred = true,
            subtasks = listOf(
                Subtask("sub-1", "seed-task-1", "Review AVL rotation cases", completed = true),
                Subtask("sub-2", "seed-task-1", "Solve 5 VTU previous question papers", completed = false)
            ),
            tags = listOf("vtu", "cie", "dsa")
        )
        val sample2 = Task(
            id = "seed-task-2",
            title = "LifeTrack Multiplatform Architecture Verification",
            description = "Verify shared Kotlin domain layer across Android Jetpack Compose and Desktop Compose shells",
            category = TaskCategory.PROJECT,
            priority = TaskPriority.URGENT,
            status = TaskStatus.IN_PROGRESS,
            dueDate = "2026-09-17",
            dueTime = "23:59",
            createdAt = now,
            updatedAt = now,
            estimatedMinutes = 60,
            isStarred = true,
            subtasks = listOf(
                Subtask("sub-3", "seed-task-2", "Shared domain models & use cases", completed = true),
                Subtask("sub-4", "seed-task-2", "Android Compose shell execution", completed = true),
                Subtask("sub-5", "seed-task-2", "Desktop Compose shell execution", completed = true)
            ),
            tags = listOf("kmp", "compose", "architecture")
        )
        return mapOf(sample1.id to sample1, sample2.id to sample2)
    }

    override fun observeTasks(): Flow<List<Task>> {
        return tasksFlow.asStateFlow().map { map ->
            map.values.filter { !it.isDeleted }.sortedWith(
                compareByDescending<Task> { it.isStarred }
                    .thenBy { it.isCompleted }
                    .thenByDescending { it.createdAt }
            )
        }
    }

    override suspend fun getTaskById(id: String): Task? {
        return mutex.withLock {
            tasksFlow.value[id]?.takeIf { !it.isDeleted }
        }
    }

    override suspend fun upsertTask(task: Task) {
        mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            current[task.id] = task
            tasksFlow.value = current
        }
    }

    override suspend fun markTaskDeleted(id: String) {
        mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            val existing = current[id]
            if (existing != null) {
                current[id] = existing.copy(isDeleted = true, updatedAt = 1710000000000L)
                tasksFlow.value = current
            }
        }
    }

    override suspend fun upsertSubtask(subtask: Subtask) {
        mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            val parent = current[subtask.taskId]
            if (parent != null) {
                val updatedSubtasks = parent.subtasks.filter { it.id != subtask.id } + subtask
                current[parent.id] = parent.copy(subtasks = updatedSubtasks)
                tasksFlow.value = current
            }
        }
    }

    override suspend fun markSubtaskDeleted(taskId: String, subtaskId: String) {
        mutex.withLock {
            val current = tasksFlow.value.toMutableMap()
            val parent = current[taskId]
            if (parent != null) {
                val updatedSubtasks = parent.subtasks.filter { it.id != subtaskId }
                current[parent.id] = parent.copy(subtasks = updatedSubtasks)
                tasksFlow.value = current
            }
        }
    }
}
