package com.lifetrack.domain.model

enum class HabitFrequency {
    DAILY,
    WEEKDAYS,
    WEEKENDS,
    WEEKLY
}

data class Habit(
    val id: String,
    val name: String,
    val description: String = "",
    val frequency: HabitFrequency = HabitFrequency.DAILY,
    val targetDaysPerWeek: Int = 7,
    val colorHex: String = "#0F766E",
    val iconName: String = "check",
    val streak: Int = 0,
    val bestStreak: Int = 0,
    val createdAtEpochMs: Long = 0L
)

data class HabitLog(
    val id: String,
    val habitId: String,
    val date: String, // YYYY-MM-DD
    val completed: Boolean = true,
    val loggedAtEpochMs: Long = 0L
)

data class FocusSession(
    val id: String,
    val taskId: String? = null,
    val subjectId: String? = null,
    val durationMinutes: Int,
    val completedAtEpochMs: Long,
    val notes: String = ""
)
