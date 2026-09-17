package com.lifetrack.domain.model

enum class TaskPriority {
    LOW,
    MEDIUM,
    HIGH,
    URGENT
}

enum class TaskStatus {
    TODO,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED
}

enum class TaskCategory {
    ALL,
    ACADEMIC,
    VTU,
    STUDY,
    WORK,
    PERSONAL,
    FINANCE,
    HEALTH,
    PROJECT,
    OTHER
}

enum class TaskRecurrence {
    NONE,
    DAILY,
    WEEKLY,
    MONTHLY,
    CUSTOM
}

data class Subtask(
    val id: String,
    val taskId: String,
    val title: String,
    val completed: Boolean = false,
    val sortOrder: Int = 0,
    val estimatedMinutes: Int? = null,
    val updatedAtEpochMs: Long = 0L,
    val isDeleted: Boolean = false
)

data class Task(
    val id: String,
    val title: String,
    val description: String = "",
    val category: TaskCategory = TaskCategory.PERSONAL,
    val priority: TaskPriority = TaskPriority.MEDIUM,
    val status: TaskStatus = TaskStatus.TODO,
    val dueDate: String? = null,
    val dueTime: String? = null,
    val dueDateEpochMs: Long? = null,
    val completedAtEpochMs: Long? = null,
    val estimatedMinutes: Int? = null,
    val actualMinutes: Int? = null,
    val isStarred: Boolean = false,
    val recurrence: TaskRecurrence = TaskRecurrence.NONE,
    val subtasks: List<Subtask> = emptyList(),
    val tags: List<String> = emptyList(),
    val isSyncPending: Boolean = false,
    val isDeleted: Boolean = false,
    val createdAtEpochMs: Long = 0L,
    val updatedAtEpochMs: Long = 0L,
    val subjectId: String? = null,
    val examId: String? = null,
    val notes: String? = null
) {
    val isCompleted: Boolean
        get() = status == TaskStatus.COMPLETED

    val completedSubtasksCount: Int
        get() = subtasks.count { it.completed && !it.isDeleted }

    val totalSubtasksCount: Int
        get() = subtasks.count { !it.isDeleted }

    val subtaskProgress: Float
        get() = if (totalSubtasksCount > 0) completedSubtasksCount.toFloat() / totalSubtasksCount.toFloat() else 0f
}

data class TaskFilterState(
    val selectedCategory: TaskCategory? = TaskCategory.ALL,
    val selectedPriority: TaskPriority? = null,
    val selectedStatus: TaskStatus? = null,
    val searchQuery: String = "",
    val showCompleted: Boolean = true
)

data class TaskMetrics(
    val totalCount: Int,
    val completedCount: Int,
    val pendingCount: Int,
    val urgentCount: Int,
    val completionRate: Float
)
