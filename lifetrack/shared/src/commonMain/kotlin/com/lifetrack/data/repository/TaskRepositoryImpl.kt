package com.lifetrack.data.repository

import com.lifetrack.data.local.TaskLocalDataSource
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class TaskRepositoryImpl(
    private val localDataSource: TaskLocalDataSource
) : TaskRepository {

    override fun getTasks(): Flow<List<Task>> {
        return localDataSource.observeTasks()
    }

    override fun getTaskById(id: String): Flow<Task?> {
        return localDataSource.observeTasks().map { tasks ->
            tasks.firstOrNull { it.id == id }
        }
    }

    override suspend fun saveTask(task: Task) {
        localDataSource.upsertTask(task)
    }

    override suspend fun toggleTaskCompletion(id: String) {
        val existing = localDataSource.getTaskById(id) ?: return
        val newStatus = if (existing.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE
        val updated = existing.copy(
            status = newStatus,
            completedAt = if (newStatus == TaskStatus.DONE) 1710000000000L else null
        )
        localDataSource.upsertTask(updated)
    }

    override suspend fun deleteTask(id: String) {
        localDataSource.markTaskDeleted(id)
    }

    override suspend fun addSubtask(taskId: String, subtask: Subtask) {
        localDataSource.upsertSubtask(subtask)
    }

    override suspend fun toggleSubtask(taskId: String, subtaskId: String) {
        val task = localDataSource.getTaskById(taskId) ?: return
        val sub = task.subtasks.firstOrNull { it.id == subtaskId } ?: return
        val updated = sub.copy(completed = !sub.completed)
        localDataSource.upsertSubtask(updated)
    }

    override suspend fun deleteSubtask(taskId: String, subtaskId: String) {
        localDataSource.markSubtaskDeleted(taskId, subtaskId)
    }
}
