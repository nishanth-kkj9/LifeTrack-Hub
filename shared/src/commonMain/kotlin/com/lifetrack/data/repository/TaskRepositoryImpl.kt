package com.lifetrack.data.repository

import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.TaskLocalDataSource
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class TaskRepositoryImpl(
    private val localDataSource: TaskLocalDataSource,
    private val timeProvider: TimeProvider = SystemTimeProvider()
) : TaskRepository {

    override fun observeAllTasks(): Flow<List<Task>> =
        localDataSource.observeTasks()

    override fun observeTaskById(id: String): Flow<Task?> =
        localDataSource.observeTasks().map { list ->
            list.firstOrNull { it.id == id }
        }

    override fun observeTaskMetrics(): Flow<TaskMetrics> =
        localDataSource.observeTasks().map { list ->
            val total = list.size
            val completed = list.count { it.isCompleted }
            val pending = list.count { !it.isCompleted }
            val urgent = list.count { it.priority == TaskPriority.URGENT && !it.isCompleted }
            val rate = if (total > 0) (completed.toFloat() / total.toFloat()) * 100f else 0f
            TaskMetrics(
                totalCount = total,
                completedCount = completed,
                pendingCount = pending,
                urgentCount = urgent,
                completionRate = rate
            )
        }

    override suspend fun getTaskById(id: String): Task? =
        localDataSource.getTaskById(id)

    override suspend fun saveTask(task: Task): Task {
        val now = timeProvider.nowEpochMs()
        val prepared = task.copy(
            createdAtEpochMs = if (task.createdAtEpochMs > 0L) task.createdAtEpochMs else now,
            updatedAtEpochMs = now,
            isSyncPending = true
        )
        return localDataSource.upsertTask(prepared)
    }

    override suspend fun updateTask(task: Task): Task {
        val now = timeProvider.nowEpochMs()
        val prepared = task.copy(
            updatedAtEpochMs = now,
            isSyncPending = true
        )
        return localDataSource.upsertTask(prepared)
    }

    override suspend fun deleteTask(id: String): Boolean =
        localDataSource.deleteTask(id)

    override suspend fun toggleTaskCompletion(id: String): Task? {
        val current = localDataSource.getTaskById(id) ?: return null
        val now = timeProvider.nowEpochMs()
        val willBeCompleted = current.status != TaskStatus.COMPLETED
        val updated = current.copy(
            status = if (willBeCompleted) TaskStatus.COMPLETED else TaskStatus.TODO,
            completedAtEpochMs = if (willBeCompleted) now else null,
            updatedAtEpochMs = now,
            isSyncPending = true
        )
        return localDataSource.upsertTask(updated)
    }

    override suspend fun addSubtask(taskId: String, subtask: Subtask): Task? =
        localDataSource.upsertSubtask(subtask)

    override suspend fun toggleSubtask(taskId: String, subtaskId: String): Task? {
        val parent = localDataSource.getTaskById(taskId) ?: return null
        val sub = parent.subtasks.firstOrNull { it.id == subtaskId } ?: return null
        val updatedSub = sub.copy(
            completed = !sub.completed,
            updatedAtEpochMs = timeProvider.nowEpochMs()
        )
        return localDataSource.upsertSubtask(updatedSub)
    }

    override suspend fun deleteSubtask(taskId: String, subtaskId: String): Task? =
        localDataSource.deleteSubtask(taskId, subtaskId)
}
