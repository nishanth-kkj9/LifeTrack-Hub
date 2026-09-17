package com.lifetrack.domain.usecase

import com.lifetrack.core.IdGenerator
import com.lifetrack.core.PlatformIdGenerator
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskFilterState
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Authoritative single path for retrieving and filtering tasks according to TaskFilterState.
 */
class GetTasksUseCase(private val repository: TaskRepository) {
    operator fun invoke(filterState: TaskFilterState = TaskFilterState()): Flow<List<Task>> {
        return repository.observeAllTasks().map { list ->
            list.filter { task ->
                val matchesCategory = filterState.selectedCategory == null ||
                        filterState.selectedCategory == TaskCategory.ALL ||
                        task.category == filterState.selectedCategory
                val matchesPriority = filterState.selectedPriority == null || task.priority == filterState.selectedPriority
                val matchesStatus = filterState.selectedStatus == null || task.status == filterState.selectedStatus
                val matchesSearch = filterState.searchQuery.isBlank() ||
                        task.title.contains(filterState.searchQuery, ignoreCase = true) ||
                        task.description.contains(filterState.searchQuery, ignoreCase = true) ||
                        task.tags.any { it.contains(filterState.searchQuery, ignoreCase = true) }
                matchesCategory && matchesPriority && matchesStatus && matchesSearch
            }
        }
    }
}

/**
 * Creates tasks with injected TimeProvider and IdGenerator abstractions.
 */
class CreateTaskUseCase(
    private val repository: TaskRepository,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    private val idGenerator: IdGenerator = PlatformIdGenerator()
) {
    suspend operator fun invoke(
        title: String,
        description: String = "",
        category: TaskCategory = TaskCategory.PERSONAL,
        priority: TaskPriority = TaskPriority.MEDIUM,
        dueDate: String? = null,
        dueTime: String? = null,
        dueDateEpochMs: Long? = null,
        estimatedMinutes: Int? = null,
        recurrence: TaskRecurrence = TaskRecurrence.NONE,
        tags: List<String> = emptyList(),
        isStarred: Boolean = false,
        subtasks: List<Subtask> = emptyList()
    ): Task {
        val trimmedTitle = title.trim()
        require(trimmedTitle.isNotBlank()) { "Task title cannot be blank" }
        val now = timeProvider.nowEpochMs()
        val taskId = idGenerator.generateId("task")
        val processedSubtasks = subtasks.map { sub ->
            if (sub.id.isBlank()) sub.copy(id = idGenerator.generateId("sub"), taskId = taskId, updatedAtEpochMs = now)
            else sub.copy(taskId = taskId, updatedAtEpochMs = now)
        }
        val newTask = Task(
            id = taskId,
            title = trimmedTitle,
            description = description.trim(),
            category = category,
            priority = priority,
            status = TaskStatus.TODO,
            dueDate = dueDate,
            dueTime = dueTime,
            dueDateEpochMs = dueDateEpochMs,
            estimatedMinutes = estimatedMinutes,
            recurrence = recurrence,
            subtasks = processedSubtasks,
            tags = tags,
            isStarred = isStarred,
            isSyncPending = true,
            createdAtEpochMs = now,
            updatedAtEpochMs = now
        )
        return repository.saveTask(newTask)
    }
}

class ToggleTaskCompletionUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(taskId: String): Task? {
        return repository.toggleTaskCompletion(taskId)
    }
}

class DeleteTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(taskId: String): Boolean {
        return repository.deleteTask(taskId)
    }
}

class AddSubtaskUseCase(
    private val repository: TaskRepository,
    private val idGenerator: IdGenerator = PlatformIdGenerator(),
    private val timeProvider: TimeProvider = SystemTimeProvider()
) {
    suspend operator fun invoke(taskId: String, title: String): Task? {
        val trimmed = title.trim()
        require(trimmed.isNotBlank()) { "Subtask title cannot be blank" }
        val subtask = Subtask(
            id = idGenerator.generateId("sub"),
            taskId = taskId,
            title = trimmed,
            completed = false,
            updatedAtEpochMs = timeProvider.nowEpochMs()
        )
        return repository.addSubtask(taskId, subtask)
    }
}

class ToggleSubtaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(taskId: String, subtaskId: String): Task? {
        return repository.toggleSubtask(taskId, subtaskId)
    }
}

class DeleteSubtaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(taskId: String, subtaskId: String): Task? {
        return repository.deleteSubtask(taskId, subtaskId)
    }
}

class GetTaskMetricsUseCase(private val repository: TaskRepository) {
    operator fun invoke(): Flow<TaskMetrics> {
        return repository.observeTaskMetrics()
    }
}

class ParseNaturalLanguageTaskUseCase {
    data class ParsedTaskDraft(
        val title: String,
        val category: TaskCategory,
        val priority: TaskPriority,
        val estimatedMinutes: Int? = null,
        val recurrence: TaskRecurrence = TaskRecurrence.NONE,
        val relativeDayOffset: Int? = null,
        val tags: List<String> = emptyList()
    )

    operator fun invoke(input: String): ParsedTaskDraft {
        return parse(input)
    }

    companion object {
        fun parse(input: String): ParsedTaskDraft {
            val lower = input.lowercase()

            val priority = when {
                "urgent" in lower || "asap" in lower || "critical" in lower || "!" in lower -> TaskPriority.URGENT
                "high priority" in lower || "important" in lower -> TaskPriority.HIGH
                "low priority" in lower || "whenever" in lower -> TaskPriority.LOW
                else -> TaskPriority.MEDIUM
            }

            val category = when {
                "vtu" in lower || "cie" in lower || "see" in lower || "lab" in lower -> TaskCategory.VTU
                "pay" in lower || "fee" in lower || "bill" in lower || "money" in lower || "rent" in lower -> TaskCategory.FINANCE
                "exam" in lower || "assignment" in lower || "study" in lower || "module" in lower || "syllabus" in lower -> TaskCategory.ACADEMIC
                "workout" in lower || "gym" in lower || "meds" in lower || "run" in lower || "health" in lower -> TaskCategory.HEALTH
                "project" in lower || "architecture" in lower || "code" in lower || "deploy" in lower || "kmp" in lower -> TaskCategory.PROJECT
                "meeting" in lower || "work" in lower || "office" in lower -> TaskCategory.WORK
                else -> TaskCategory.PERSONAL
            }

            val recurrence = when {
                "every day" in lower || "daily" in lower -> TaskRecurrence.DAILY
                "every week" in lower || "weekly" in lower -> TaskRecurrence.WEEKLY
                "every month" in lower || "monthly" in lower -> TaskRecurrence.MONTHLY
                else -> TaskRecurrence.NONE
            }

            val relativeDayOffset = when {
                "today" in lower -> 0
                "tomorrow" in lower -> 1
                "day after tomorrow" in lower -> 2
                else -> null
            }

            var estimatedMinutes: Int? = null
            val minuteMatch = Regex("""\b(\d+)\s*(?:min|mins|minute|minutes|m)\b""").find(lower)
            if (minuteMatch != null) {
                estimatedMinutes = minuteMatch.groupValues[1].toIntOrNull()
            } else {
                val hourMatch = Regex("""\b(\d+)\s*(?:hr|hrs|hour|hours|h)\b""").find(lower)
                if (hourMatch != null) {
                    estimatedMinutes = (hourMatch.groupValues[1].toIntOrNull() ?: 0) * 60
                }
            }

            val extractedTags = mutableListOf<String>()
            val hashtagRegex = Regex("""#(\w+)""")
            hashtagRegex.findAll(input).forEach { match ->
                extractedTags.add(match.groupValues[1].lowercase())
            }

            var cleanedTitle = input
                .replace(Regex("""(?i)\b(urgent|asap|critical|high priority|important|low priority)\b"""), "")
                .replace(Regex("""(?i)\b\d+\s*(?:mins?|minutes?|hrs?|hours?|m|h)\b"""), "")
                .replace(Regex("""(?i)\b(today|tomorrow|daily|weekly|monthly)\b"""), "")
                .replace(hashtagRegex, "")
                .replace("!", "")
                .trim()
                .replace(Regex("""\s+"""), " ")

            if (cleanedTitle.isBlank()) {
                cleanedTitle = input.trim()
            }

            return ParsedTaskDraft(
                title = cleanedTitle,
                category = category,
                priority = priority,
                estimatedMinutes = estimatedMinutes,
                recurrence = recurrence,
                relativeDayOffset = relativeDayOffset,
                tags = extractedTags
            )
        }
    }
}
