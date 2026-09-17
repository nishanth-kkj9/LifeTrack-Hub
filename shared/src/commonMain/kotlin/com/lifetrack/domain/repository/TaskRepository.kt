package com.lifetrack.domain.repository

import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.Flow

/**
 * Clean architectural abstraction for Task persistence.
 * Decouples domain logic and use cases from underlying storage implementations.
 */
interface TaskRepository {
    fun observeAllTasks(): Flow<List<Task>>
    fun observeTaskById(id: String): Flow<Task?>
    fun observeTaskMetrics(): Flow<TaskMetrics>

    suspend fun getTaskById(id: String): Task?
    suspend fun saveTask(task: Task): Task
    suspend fun updateTask(task: Task): Task
    suspend fun deleteTask(id: String): Boolean
    suspend fun toggleTaskCompletion(id: String): Task?
    
    suspend fun addSubtask(taskId: String, subtask: Subtask): Task?
    suspend fun toggleSubtask(taskId: String, subtaskId: String): Task?
    suspend fun deleteSubtask(taskId: String, subtaskId: String): Task?
}
