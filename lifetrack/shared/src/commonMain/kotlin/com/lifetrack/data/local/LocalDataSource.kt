package com.lifetrack.data.local

import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import kotlinx.coroutines.flow.Flow

/**
 * Architecture boundary abstraction for the local database.
 * In Phase 3, this interface is backed by the Encrypted SQLite (SQLCipher) engine.
 */
interface TaskLocalDataSource {
    fun observeTasks(): Flow<List<Task>>
    suspend fun getTaskById(id: String): Task?
    suspend fun upsertTask(task: Task)
    suspend fun markTaskDeleted(id: String)
    suspend fun upsertSubtask(subtask: Subtask)
    suspend fun markSubtaskDeleted(taskId: String, subtaskId: String)
}
