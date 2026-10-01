package com.lifetrack.data.repository

import com.lifetrack.core.HlcClock
import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.StandardSyncEventIdGenerator
import com.lifetrack.core.SyncEventIdGenerator
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.TaskLocalDataSource
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.repository.TaskRepository
import com.lifetrack.sync.SyncRecord
import com.lifetrack.sync.SyncRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Production TaskRepository implementation enforcing atomic entity and outbox transactions.
 */
class TaskRepositoryImpl(
    private val localDataSource: TaskLocalDataSource,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    private val syncRepository: SyncRepository? = null,
    private val hlcClock: HlcClock = StandardHlcClock("local-node", timeProvider),
    private val syncEventIdGenerator: SyncEventIdGenerator = StandardSyncEventIdGenerator()
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

        return if (localDataSource is PersistentTaskLocalDataSource) {
            val hlc = hlcClock.now()
            val eventId = syncEventIdGenerator.generateEventId(prepared.id, hlc)
            val syncRecord = SyncRecord(
                id = eventId,
                entityType = "TASK",
                entityId = prepared.id,
                operation = "UPSERT",
                payload = TaskPayloadSerializer.serializeTask(prepared),
                hlcTimestamp = hlc.toString(),
                createdAt = now,
                originDeviceId = hlc.nodeId,
                protocolVersion = 1,
                schemaVersion = 1
            )
            localDataSource.upsertTaskAtomic(prepared, syncRecord)
        } else {
            localDataSource.upsertTask(prepared)
        }
    }

    override suspend fun updateTask(task: Task): Task {
        val now = timeProvider.nowEpochMs()
        val prepared = task.copy(
            updatedAtEpochMs = now,
            isSyncPending = true
        )

        return if (localDataSource is PersistentTaskLocalDataSource) {
            val hlc = hlcClock.now()
            val eventId = syncEventIdGenerator.generateEventId(prepared.id, hlc)
            val syncRecord = SyncRecord(
                id = eventId,
                entityType = "TASK",
                entityId = prepared.id,
                operation = "UPSERT",
                payload = TaskPayloadSerializer.serializeTask(prepared),
                hlcTimestamp = hlc.toString(),
                createdAt = now,
                originDeviceId = hlc.nodeId,
                protocolVersion = 1,
                schemaVersion = 1
            )
            localDataSource.upsertTaskAtomic(prepared, syncRecord)
        } else {
            localDataSource.upsertTask(prepared)
        }
    }

    override suspend fun deleteTask(id: String): Boolean {
        val now = timeProvider.nowEpochMs()
        return if (localDataSource is PersistentTaskLocalDataSource) {
            val hlc = hlcClock.now()
            val eventId = syncEventIdGenerator.generateEventId(id, hlc)
            val syncRecord = SyncRecord(
                id = eventId,
                entityType = "TASK",
                entityId = id,
                operation = "DELETE",
                payload = id,
                hlcTimestamp = hlc.toString(),
                createdAt = now,
                originDeviceId = hlc.nodeId,
                protocolVersion = 1,
                schemaVersion = 1
            )
            localDataSource.deleteTaskAtomic(id, syncRecord)
        } else {
            localDataSource.deleteTask(id)
        }
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

        return if (localDataSource is PersistentTaskLocalDataSource) {
            val hlc = hlcClock.now()
            val eventId = syncEventIdGenerator.generateEventId(updated.id, hlc)
            val syncRecord = SyncRecord(
                id = eventId,
                entityType = "TASK",
                entityId = updated.id,
                operation = "UPSERT",
                payload = TaskPayloadSerializer.serializeTask(updated),
                hlcTimestamp = hlc.toString(),
                createdAt = now,
                originDeviceId = hlc.nodeId,
                protocolVersion = 1,
                schemaVersion = 1
            )
            localDataSource.upsertTaskAtomic(updated, syncRecord)
        } else {
            localDataSource.upsertTask(updated)
        }
    }

    override suspend fun addSubtask(taskId: String, subtask: Subtask): Task? {
        val now = timeProvider.nowEpochMs()
        val prepared = subtask.copy(updatedAtEpochMs = now)

        return if (localDataSource is PersistentTaskLocalDataSource) {
            val hlc = hlcClock.now()
            val eventId = syncEventIdGenerator.generateEventId(prepared.id, hlc)
            val syncRecord = SyncRecord(
                id = eventId,
                entityType = "SUBTASK",
                entityId = prepared.id,
                operation = "UPSERT",
                payload = TaskPayloadSerializer.serializeSubtask(prepared),
                hlcTimestamp = hlc.toString(),
                createdAt = now,
                originDeviceId = hlc.nodeId,
                protocolVersion = 1,
                schemaVersion = 1
            )
            localDataSource.upsertSubtaskAtomic(prepared, syncRecord)
        } else {
            localDataSource.upsertSubtask(prepared)
        }
    }

    override suspend fun toggleSubtask(taskId: String, subtaskId: String): Task? {
        val parent = localDataSource.getTaskById(taskId) ?: return null
        val sub = parent.subtasks.firstOrNull { it.id == subtaskId } ?: return null
        val now = timeProvider.nowEpochMs()
        val updatedSub = sub.copy(
            completed = !sub.completed,
            updatedAtEpochMs = now
        )

        return if (localDataSource is PersistentTaskLocalDataSource) {
            val hlc = hlcClock.now()
            val eventId = syncEventIdGenerator.generateEventId(updatedSub.id, hlc)
            val syncRecord = SyncRecord(
                id = eventId,
                entityType = "SUBTASK",
                entityId = updatedSub.id,
                operation = "UPSERT",
                payload = TaskPayloadSerializer.serializeSubtask(updatedSub),
                hlcTimestamp = hlc.toString(),
                createdAt = now,
                originDeviceId = hlc.nodeId,
                protocolVersion = 1,
                schemaVersion = 1
            )
            localDataSource.upsertSubtaskAtomic(updatedSub, syncRecord)
        } else {
            localDataSource.upsertSubtask(updatedSub)
        }
    }

    override suspend fun deleteSubtask(taskId: String, subtaskId: String): Task? {
        val now = timeProvider.nowEpochMs()
        return if (localDataSource is PersistentTaskLocalDataSource) {
            val hlc = hlcClock.now()
            val eventId = syncEventIdGenerator.generateEventId(subtaskId, hlc)
            val syncRecord = SyncRecord(
                id = eventId,
                entityType = "SUBTASK",
                entityId = subtaskId,
                operation = "DELETE",
                payload = subtaskId,
                hlcTimestamp = hlc.toString(),
                createdAt = now,
                originDeviceId = hlc.nodeId,
                protocolVersion = 1,
                schemaVersion = 1
            )
            localDataSource.deleteSubtaskAtomic(taskId, subtaskId, syncRecord)
        } else {
            localDataSource.deleteSubtask(taskId, subtaskId)
        }
    }
}

/**
 * Normalized field serializer for sync delta transport using robust JSON encoding.
 */
object TaskPayloadSerializer {

    fun serializeTask(task: Task): String {
        val map = mutableMapOf<String, com.lifetrack.core.json.JsonElement>(
            "id" to com.lifetrack.core.json.JsonPrimitive(task.id),
            "title" to com.lifetrack.core.json.JsonPrimitive(task.title),
            "description" to com.lifetrack.core.json.JsonPrimitive(task.description),
            "category" to com.lifetrack.core.json.JsonPrimitive(task.category.name),
            "priority" to com.lifetrack.core.json.JsonPrimitive(task.priority.name),
            "status" to com.lifetrack.core.json.JsonPrimitive(task.status.name),
            "isStarred" to com.lifetrack.core.json.JsonPrimitive(task.isStarred),
            "recurrence" to com.lifetrack.core.json.JsonPrimitive(task.recurrence.name),
            "tags" to com.lifetrack.core.json.JsonArray(task.tags.map { com.lifetrack.core.json.JsonPrimitive(it) }),
            "createdAtEpochMs" to com.lifetrack.core.json.JsonPrimitive(task.createdAtEpochMs),
            "updatedAtEpochMs" to com.lifetrack.core.json.JsonPrimitive(task.updatedAtEpochMs),
            "isDeleted" to com.lifetrack.core.json.JsonPrimitive(task.isDeleted)
        )
        task.dueDate?.let { map["dueDate"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.dueTime?.let { map["dueTime"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.dueDateEpochMs?.let { map["dueDateEpochMs"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.completedAtEpochMs?.let { map["completedAtEpochMs"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.estimatedMinutes?.let { map["estimatedMinutes"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.actualMinutes?.let { map["actualMinutes"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.subjectId?.let { map["subjectId"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.examId?.let { map["examId"] = com.lifetrack.core.json.JsonPrimitive(it) }
        task.notes?.let { map["notes"] = com.lifetrack.core.json.JsonPrimitive(it) }
        return com.lifetrack.core.json.JsonObject(map).toJsonString()
    }

    fun deserializeTask(payload: String): Task? {
        val trimmed = payload.trim()
        if (trimmed.startsWith("{")) {
            return try {
                val obj = com.lifetrack.core.json.JsonParser.parseObject(trimmed)
                val id = obj.getString("id") ?: return null
                val title = obj.getString("title") ?: ""
                val description = obj.getString("description") ?: ""
                val categoryStr = obj.getString("category") ?: TaskCategory.PERSONAL.name
                val priorityStr = obj.getString("priority") ?: TaskPriority.MEDIUM.name
                val statusStr = obj.getString("status") ?: TaskStatus.TODO.name
                val dueDate = obj.getString("dueDate")
                val dueTime = obj.getString("dueTime")
                val dueDateEpochMs = obj.getLong("dueDateEpochMs")
                val completedAtEpochMs = obj.getLong("completedAtEpochMs")
                val estimatedMinutes = obj.getInt("estimatedMinutes")
                val actualMinutes = obj.getInt("actualMinutes")
                val isStarred = obj.getBoolean("isStarred") ?: false
                val recurrenceStr = obj.getString("recurrence") ?: TaskRecurrence.NONE.name
                val tagsArray = obj.getArray("tags")
                val tags = tagsArray?.elements?.mapNotNull { it.stringOrNull } ?: emptyList()
                val createdAt = obj.getLong("createdAtEpochMs") ?: 0L
                val updatedAt = obj.getLong("updatedAtEpochMs") ?: 0L
                val subjectId = obj.getString("subjectId")
                val examId = obj.getString("examId")
                val notes = obj.getString("notes")
                val isDeleted = obj.getBoolean("isDeleted") ?: false

                val category = try { TaskCategory.valueOf(categoryStr) } catch (_: Throwable) { TaskCategory.PERSONAL }
                val priority = try { TaskPriority.valueOf(priorityStr) } catch (_: Throwable) { TaskPriority.MEDIUM }
                val status = try { TaskStatus.valueOf(statusStr) } catch (_: Throwable) { TaskStatus.TODO }
                val recurrence = try { TaskRecurrence.valueOf(recurrenceStr) } catch (_: Throwable) { TaskRecurrence.NONE }

                Task(
                    id = id,
                    title = title,
                    description = description,
                    category = category,
                    priority = priority,
                    status = status,
                    dueDate = dueDate,
                    dueTime = dueTime,
                    dueDateEpochMs = dueDateEpochMs,
                    completedAtEpochMs = completedAtEpochMs,
                    estimatedMinutes = estimatedMinutes,
                    actualMinutes = actualMinutes,
                    isStarred = isStarred,
                    recurrence = recurrence,
                    tags = tags,
                    isSyncPending = false,
                    isDeleted = isDeleted,
                    createdAtEpochMs = createdAt,
                    updatedAtEpochMs = updatedAt,
                    subjectId = subjectId,
                    examId = examId,
                    notes = notes
                )
            } catch (_: Throwable) {
                null
            }
        }

        // Backward compatibility: legacy pipe-separated encoding
        val parts = trimmed.split("|")
        if (parts.size < 6) return null
        val id = parts[0]
        val title = parts.getOrNull(1)?.replace("&#124;", "|") ?: ""
        val description = parts.getOrNull(2)?.replace("&#124;", "|") ?: ""
        val categoryStr = parts.getOrNull(3) ?: TaskCategory.PERSONAL.name
        val priorityStr = parts.getOrNull(4) ?: TaskPriority.MEDIUM.name
        val statusStr = parts.getOrNull(5) ?: TaskStatus.TODO.name
        val dueDate = parts.getOrNull(6)?.takeIf { it.isNotEmpty() }
        val dueTime = parts.getOrNull(7)?.takeIf { it.isNotEmpty() }
        val dueDateEpochMs = parts.getOrNull(8)?.toLongOrNull()
        val completedAtEpochMs = parts.getOrNull(9)?.toLongOrNull()
        val estimatedMinutes = parts.getOrNull(10)?.toIntOrNull()
        val actualMinutes = parts.getOrNull(11)?.toIntOrNull()
        val isStarred = parts.getOrNull(12) == "1"
        val recurrenceStr = parts.getOrNull(13) ?: TaskRecurrence.NONE.name
        val tagsStr = parts.getOrNull(14) ?: ""
        val createdAt = parts.getOrNull(15)?.toLongOrNull() ?: 0L
        val updatedAt = parts.getOrNull(16)?.toLongOrNull() ?: 0L
        val subjectId = parts.getOrNull(17)?.takeIf { it.isNotEmpty() }
        val examId = parts.getOrNull(18)?.takeIf { it.isNotEmpty() }
        val notes = parts.getOrNull(19)?.replace("&#124;", "|")?.takeIf { it.isNotEmpty() }
        val isDeleted = parts.getOrNull(20) == "1"

        val category = try { TaskCategory.valueOf(categoryStr) } catch (_: Throwable) { TaskCategory.PERSONAL }
        val priority = try { TaskPriority.valueOf(priorityStr) } catch (_: Throwable) { TaskPriority.MEDIUM }
        val status = try { TaskStatus.valueOf(statusStr) } catch (_: Throwable) { TaskStatus.TODO }
        val recurrence = try { TaskRecurrence.valueOf(recurrenceStr) } catch (_: Throwable) { TaskRecurrence.NONE }
        val tags = if (tagsStr.isNotBlank()) tagsStr.split(",").filter { it.isNotBlank() } else emptyList()

        return Task(
            id = id,
            title = title,
            description = description,
            category = category,
            priority = priority,
            status = status,
            dueDate = dueDate,
            dueTime = dueTime,
            dueDateEpochMs = dueDateEpochMs,
            completedAtEpochMs = completedAtEpochMs,
            estimatedMinutes = estimatedMinutes,
            actualMinutes = actualMinutes,
            isStarred = isStarred,
            recurrence = recurrence,
            tags = tags,
            isSyncPending = false,
            isDeleted = isDeleted,
            createdAtEpochMs = createdAt,
            updatedAtEpochMs = updatedAt,
            subjectId = subjectId,
            examId = examId,
            notes = notes
        )
    }

    fun serializeSubtask(subtask: Subtask): String {
        val map = mutableMapOf<String, com.lifetrack.core.json.JsonElement>(
            "id" to com.lifetrack.core.json.JsonPrimitive(subtask.id),
            "taskId" to com.lifetrack.core.json.JsonPrimitive(subtask.taskId),
            "title" to com.lifetrack.core.json.JsonPrimitive(subtask.title),
            "completed" to com.lifetrack.core.json.JsonPrimitive(subtask.completed),
            "sortOrder" to com.lifetrack.core.json.JsonPrimitive(subtask.sortOrder),
            "updatedAtEpochMs" to com.lifetrack.core.json.JsonPrimitive(subtask.updatedAtEpochMs),
            "isDeleted" to com.lifetrack.core.json.JsonPrimitive(subtask.isDeleted)
        )
        subtask.estimatedMinutes?.let { map["estimatedMinutes"] = com.lifetrack.core.json.JsonPrimitive(it) }
        return com.lifetrack.core.json.JsonObject(map).toJsonString()
    }

    fun deserializeSubtask(payload: String): Subtask? {
        val trimmed = payload.trim()
        if (trimmed.startsWith("{")) {
            return try {
                val obj = com.lifetrack.core.json.JsonParser.parseObject(trimmed)
                val id = obj.getString("id") ?: return null
                val taskId = obj.getString("taskId") ?: return null
                val title = obj.getString("title") ?: ""
                val completed = obj.getBoolean("completed") ?: false
                val sortOrder = obj.getInt("sortOrder") ?: 0
                val estimatedMinutes = obj.getInt("estimatedMinutes")
                val updatedAtEpochMs = obj.getLong("updatedAtEpochMs") ?: 0L
                val isDeleted = obj.getBoolean("isDeleted") ?: false

                Subtask(
                    id = id,
                    taskId = taskId,
                    title = title,
                    completed = completed,
                    sortOrder = sortOrder,
                    estimatedMinutes = estimatedMinutes,
                    updatedAtEpochMs = updatedAtEpochMs,
                    isDeleted = isDeleted
                )
            } catch (_: Throwable) {
                null
            }
        }

        // Backward compatibility: legacy pipe-separated encoding
        val parts = trimmed.split("|")
        if (parts.size < 4) return null
        return Subtask(
            id = parts[0],
            taskId = parts[1],
            title = parts[2].replace("&#124;", "|"),
            completed = parts[3] == "1",
            sortOrder = parts.getOrNull(4)?.toIntOrNull() ?: 0,
            estimatedMinutes = parts.getOrNull(5)?.toIntOrNull(),
            updatedAtEpochMs = parts.getOrNull(6)?.toLongOrNull() ?: 0L,
            isDeleted = parts.getOrNull(7) == "1"
        )
    }
}
