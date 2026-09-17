package com.lifetrack.domain.repository

import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import kotlinx.coroutines.flow.Flow

interface TaskRepository {
    fun getTasks(): Flow<List<Task>>
    fun getTaskById(id: String): Flow<Task?>
    suspend fun saveTask(task: Task)
    suspend fun toggleTaskCompletion(id: String)
    suspend fun deleteTask(id: String)
    suspend fun addSubtask(taskId: String, subtask: Subtask)
    suspend fun toggleSubtask(taskId: String, subtaskId: String)
    suspend fun deleteSubtask(taskId: String, subtaskId: String)
}
