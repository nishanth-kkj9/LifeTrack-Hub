package com.lifetrack.domain.model

data class Habit(
    val id: String,
    val name: String,
    val category: String = "Productivity",
    val targetDaysPerWeek: Int = 7,
    val colorHex: String = "#3B82F6",
    val currentStreak: Int = 0,
    val bestStreak: Int = 0,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    val isDeleted: Boolean = false
)

data class HabitLog(
    val id: String,
    val habitId: String,
    val date: String, // YYYY-MM-DD
    val completed: Boolean = true,
    val notes: String? = null,
    val updatedAt: Long = 0L
)

data class FocusSession(
    val id: String,
    val taskId: String? = null,
    val subjectId: String? = null,
    val durationMinutes: Int,
    val startTime: Long,
    val endTime: Long,
    val completedSuccessfully: Boolean = true,
    val reflectionRating: Int = 5, // 1-5 scale
    val notes: String? = null,
    val createdAt: Long = 0L,
    val isDeleted: Boolean = false
)
