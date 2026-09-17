package com.lifetrack.domain.model

enum class TaskPriority {
    URGENT,
    HIGH,
    MEDIUM,
    LOW
}

enum class TaskCategory {
    STUDY,
    WORK,
    PERSONAL,
    FINANCE,
    HEALTH,
    PROJECT,
    OTHER
}

enum class TaskStatus {
    TODO,
    IN_PROGRESS,
    IN_REVIEW,
    DONE
}

enum class TaskRecurrence {
    NONE,
    DAILY,
    WEEKDAYS,
    WEEKLY,
    MONTHLY
}

data class Subtask(
    val id: String,
    val taskId: String,
    val title: String,
    val completed: Boolean = false,
    val sortOrder: Int = 0,
    val estimatedMinutes: Int? = null,
    val updatedAt: Long = 0L,
    val isDeleted: Boolean = false
)

data class Task(
    val id: String,
    val title: String,
    val description: String? = null,
    val category: TaskCategory = TaskCategory.STUDY,
    val priority: TaskPriority = TaskPriority.MEDIUM,
    val status: TaskStatus = TaskStatus.TODO,
    val dueDate: String? = null, // ISO YYYY-MM-DD
    val dueTime: String? = null, // HH:mm
    val completedAt: Long? = null,
    val subtasks: List<Subtask> = emptyList(),
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    val estimatedMinutes: Int? = null,
    val actualMinutes: Int? = null,
    val isStarred: Boolean = false,
    val recurrence: TaskRecurrence = TaskRecurrence.NONE,
    val subjectId: String? = null,
    val examId: String? = null,
    val tags: List<String> = emptyList(),
    val notes: String? = null,
    val isDeleted: Boolean = false
) {
    val isCompleted: Boolean
        get() = status == TaskStatus.DONE
}
