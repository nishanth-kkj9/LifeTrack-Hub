package com.lifetrack.domain.model

enum class TaskPriority {
    LOW,
    MEDIUM,
    HIGH,
    URGENT
}

enum class TaskStatus {
    PENDING,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED
}

enum class TaskCategory {
    ALL,
    ACADEMIC,
    VTU,
    PERSONAL,
    WORK,
    HEALTH,
    FINANCE
}

data class Task(
    val id: String,
    val title: String,
    val description: String = "",
    val category: TaskCategory = TaskCategory.PERSONAL,
    val priority: TaskPriority = TaskPriority.MEDIUM,
    val status: TaskStatus = TaskStatus.PENDING,
    val dueDateEpochMs: Long? = null,
    val estimatedMinutes: Int? = null,
    val tags: List<String> = emptyList(),
    val isSyncPending: Boolean = false,
    val createdAtEpochMs: Long = 0L,
    val updatedAtEpochMs: Long = 0L
)

data class TaskFilterState(
    val selectedCategory: TaskCategory = TaskCategory.ALL,
    val selectedPriority: TaskPriority? = null,
    val selectedStatus: TaskStatus? = null,
    val searchQuery: String = ""
)

data class TaskMetrics(
    val totalCount: Int,
    val completedCount: Int,
    val pendingCount: Int,
    val urgentCount: Int,
    val completionRate: Float
)
