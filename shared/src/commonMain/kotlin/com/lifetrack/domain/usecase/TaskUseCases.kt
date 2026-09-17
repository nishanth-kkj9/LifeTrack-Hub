package com.lifetrack.domain.usecase

import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskFilterState
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.model.VtuGradingSystem
import com.lifetrack.domain.model.VtuSemesterSummary
import com.lifetrack.domain.model.VtuSubject
import com.lifetrack.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class GetTasksUseCase(private val repository: TaskRepository) {
    operator fun invoke(filterState: TaskFilterState): Flow<List<Task>> {
        return repository.observeAllTasks().map { list ->
            list.filter { task ->
                val matchesCategory = filterState.selectedCategory == TaskCategory.ALL || task.category == filterState.selectedCategory
                val matchesPriority = filterState.selectedPriority == null || task.priority == filterState.selectedPriority
                val matchesStatus = filterState.selectedStatus == null || task.status == filterState.selectedStatus
                val matchesSearch = filterState.searchQuery.isBlank() ||
                        task.title.contains(filterState.searchQuery, ignoreCase = true) ||
                        task.description.contains(filterState.searchQuery, ignoreCase = true)
                matchesCategory && matchesPriority && matchesStatus && matchesSearch
            }
        }
    }
}

class CreateTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(
        title: String,
        description: String = "",
        category: TaskCategory = TaskCategory.PERSONAL,
        priority: TaskPriority = TaskPriority.MEDIUM,
        dueDateEpochMs: Long? = null,
        estimatedMinutes: Int? = null,
        tags: List<String> = emptyList()
    ): Task {
        val trimmedTitle = title.trim()
        require(trimmedTitle.isNotBlank()) { "Task title cannot be blank" }
        val now = 1710600000000L
        val newTask = Task(
            id = "task_${now}_${(1000..9999).random()}",
            title = trimmedTitle,
            description = description.trim(),
            category = category,
            priority = priority,
            status = TaskStatus.PENDING,
            dueDateEpochMs = dueDateEpochMs,
            estimatedMinutes = estimatedMinutes,
            tags = tags,
            isSyncPending = true,
            createdAtEpochMs = now,
            updatedAtEpochMs = now
        )
        return repository.insertTask(newTask)
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
        val estimatedMinutes: Int? = null
    )

    operator fun invoke(input: String): ParsedTaskDraft {
        val lower = input.lowercase()
        val priority = when {
            "urgent" in lower || "asap" in lower || "critical" in lower || "!" in lower -> TaskPriority.URGENT
            "high priority" in lower || "important" in lower -> TaskPriority.HIGH
            "low priority" in lower || "whenever" in lower -> TaskPriority.LOW
            else -> TaskPriority.MEDIUM
        }

        val category = when {
            "vtu" in lower || "internals" in lower -> TaskCategory.VTU
            "pay" in lower || "fee" in lower || "bill" in lower || "money" in lower -> TaskCategory.FINANCE
            "exam" in lower || "assignment" in lower || "study" in lower || "homework" in lower -> TaskCategory.ACADEMIC
            "lab" in lower -> TaskCategory.VTU
            "workout" in lower || "gym" in lower || "meds" in lower || "run" in lower -> TaskCategory.HEALTH
            "meeting" in lower || "project" in lower || "deploy" in lower -> TaskCategory.WORK
            else -> TaskCategory.PERSONAL
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

        var cleanedTitle = input
            .replace(Regex("""(?i)\b(urgent|asap|critical|high priority|important|low priority)\b"""), "")
            .replace(Regex("""(?i)\b\d+\s*(?:mins?|minutes?|hrs?|hours?|m|h)\b"""), "")
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
            estimatedMinutes = estimatedMinutes
        )
    }
}

class CalculateVtuCgpaUseCase {
    fun calculateSgpa(subjects: List<VtuSubject>): Double = VtuGradingSystem.calculateSgpa(subjects)
    fun calculateCgpa(semesters: List<VtuSemesterSummary>): Double = VtuGradingSystem.calculateCgpa(semesters)
}
