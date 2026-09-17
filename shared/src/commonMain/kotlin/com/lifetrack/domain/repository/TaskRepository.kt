package com.lifetrack.domain.repository

import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.Flow

interface TaskRepository {
    fun observeAllTasks(): Flow<List<Task>>
    fun observeTasksByCategory(category: TaskCategory): Flow<List<Task>>
    fun observeTasksByStatus(status: TaskStatus): Flow<List<Task>>
    fun observeTaskMetrics(): Flow<TaskMetrics>
    
    suspend fun getTaskById(id: String): Task?
    suspend fun insertTask(task: Task): Task
    suspend fun updateTask(task: Task): Task
    suspend fun deleteTask(id: String): Boolean
    suspend fun toggleTaskCompletion(id: String): Task?
}
