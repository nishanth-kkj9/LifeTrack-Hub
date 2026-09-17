package com.lifetrack.data.repository

import com.lifetrack.data.local.TaskLocalDataSource
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class TaskRepositoryImpl(
    private val localDataSource: TaskLocalDataSource
) : TaskRepository {

    override fun observeAllTasks(): Flow<List<Task>> =
        localDataSource.observeTasks()

    override fun observeTasksByCategory(category: TaskCategory): Flow<List<Task>> =
        localDataSource.observeTasks().map { list ->
            if (category == TaskCategory.ALL) list else list.filter { it.category == category }
        }

    override fun observeTasksByStatus(status: TaskStatus): Flow<List<Task>> =
        localDataSource.observeTasks().map { list ->
            list.filter { it.status == status }
        }

    override fun observeTaskMetrics(): Flow<TaskMetrics> =
        localDataSource.observeTasks().map { list ->
            val total = list.size
            val completed = list.count { it.status == TaskStatus.COMPLETED }
            val pending = list.count { it.status == TaskStatus.PENDING || it.status == TaskStatus.IN_PROGRESS }
            val urgent = list.count { it.priority == TaskPriority.URGENT && it.status != TaskStatus.COMPLETED }
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

    override suspend fun insertTask(task: Task): Task =
        localDataSource.insertTask(task)

    override suspend fun updateTask(task: Task): Task =
        localDataSource.updateTask(task)

    override suspend fun deleteTask(id: String): Boolean =
        localDataSource.deleteTask(id)

    override suspend fun toggleTaskCompletion(id: String): Task? {
        val current = localDataSource.getTaskById(id) ?: return null
        val updated = current.copy(
            status = if (current.status == TaskStatus.COMPLETED) TaskStatus.PENDING else TaskStatus.COMPLETED,
            isSyncPending = true
        )
        return localDataSource.updateTask(updated)
    }
}
