package com.lifetrack.data.repository

import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.TaskLocalDataSource
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.repository.TaskRepository
import com.lifetrack.sync.SyncRecord
import com.lifetrack.sync.SyncRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class TaskRepositoryImpl(
    private val localDataSource: TaskLocalDataSource,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    private val syncRepository: SyncRepository? = null,
    private val nodeId: String = "local-device"
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
        val saved = localDataSource.upsertTask(prepared)
        enqueueTaskSync(saved, "UPSERT")
        return saved
    }

    override suspend fun updateTask(task: Task): Task {
        val now = timeProvider.nowEpochMs()
        val prepared = task.copy(
            updatedAtEpochMs = now,
            isSyncPending = true
        )
        val updated = localDataSource.upsertTask(prepared)
        enqueueTaskSync(updated, "UPSERT")
        return updated
    }

    override suspend fun deleteTask(id: String): Boolean {
        val deleted = localDataSource.deleteTask(id)
        if (deleted) {
            val now = timeProvider.nowEpochMs()
            syncRepository?.enqueueRecord(
                SyncRecord(
                    id = "sync-task-$id-$now",
                    entityType = "TASK",
                    entityId = id,
                    operation = "DELETE",
                    payloadEncrypted = id.encodeToByteArray(),
                    hlcTimestamp = HlcTimestamp.now(nodeId, timeProvider).toString(),
                    createdAt = now
                )
            )
        }
        return deleted
    }

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
        val saved = localDataSource.upsertTask(updated)
        enqueueTaskSync(saved, "UPSERT")
        return saved
    }

    override suspend fun addSubtask(taskId: String, subtask: Subtask): Task? {
        val updated = localDataSource.upsertSubtask(subtask)
        if (updated != null) {
            val now = timeProvider.nowEpochMs()
            syncRepository?.enqueueRecord(
                SyncRecord(
                    id = "sync-subtask-${subtask.id}-$now",
                    entityType = "SUBTASK",
                    entityId = subtask.id,
                    operation = "UPSERT",
                    payloadEncrypted = "${subtask.id}:${subtask.taskId}:${subtask.title}:${subtask.completed}".encodeToByteArray(),
                    hlcTimestamp = HlcTimestamp.now(nodeId, timeProvider).toString(),
                    createdAt = now
                )
            )
        }
        return updated
    }

    override suspend fun toggleSubtask(taskId: String, subtaskId: String): Task? {
        val parent = localDataSource.getTaskById(taskId) ?: return null
        val sub = parent.subtasks.firstOrNull { it.id == subtaskId } ?: return null
        val updatedSub = sub.copy(
            completed = !sub.completed,
            updatedAtEpochMs = timeProvider.nowEpochMs()
        )
        val updated = localDataSource.upsertSubtask(updatedSub)
        if (updated != null) {
            val now = timeProvider.nowEpochMs()
            syncRepository?.enqueueRecord(
                SyncRecord(
                    id = "sync-subtask-$subtaskId-$now",
                    entityType = "SUBTASK",
                    entityId = subtaskId,
                    operation = "UPSERT",
                    payloadEncrypted = "${updatedSub.id}:${updatedSub.taskId}:${updatedSub.title}:${updatedSub.completed}".encodeToByteArray(),
                    hlcTimestamp = HlcTimestamp.now(nodeId, timeProvider).toString(),
                    createdAt = now
                )
            )
        }
        return updated
    }

    override suspend fun deleteSubtask(taskId: String, subtaskId: String): Task? {
        val updated = localDataSource.deleteSubtask(taskId, subtaskId)
        if (updated != null) {
            val now = timeProvider.nowEpochMs()
            syncRepository?.enqueueRecord(
                SyncRecord(
                    id = "sync-subtask-del-$subtaskId-$now",
                    entityType = "SUBTASK",
                    entityId = subtaskId,
                    operation = "DELETE",
                    payloadEncrypted = subtaskId.encodeToByteArray(),
                    hlcTimestamp = HlcTimestamp.now(nodeId, timeProvider).toString(),
                    createdAt = now
                )
            )
        }
        return updated
    }

    private suspend fun enqueueTaskSync(task: Task, operation: String) {
        val now = timeProvider.nowEpochMs()
        syncRepository?.enqueueRecord(
            SyncRecord(
                id = "sync-task-${task.id}-$now",
                entityType = "TASK",
                entityId = task.id,
                operation = operation,
                payloadEncrypted = "${task.id}:${task.title}:${task.status}:${task.priority}".encodeToByteArray(),
                hlcTimestamp = HlcTimestamp.now(nodeId, timeProvider).toString(),
                createdAt = now
            )
        )
    }
}
