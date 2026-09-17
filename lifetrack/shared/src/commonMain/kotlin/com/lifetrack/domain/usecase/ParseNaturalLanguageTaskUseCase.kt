package com.lifetrack.domain.usecase

import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence

data class ParsedTaskInput(
    val title: String,
    val priority: TaskPriority = TaskPriority.MEDIUM,
    val category: TaskCategory = TaskCategory.STUDY,
    val estimatedMinutes: Int? = null,
    val recurrence: TaskRecurrence = TaskRecurrence.NONE,
    val tags: List<String> = emptyList(),
    val relativeDayOffset: Int? = null // 0 for today, 1 for tomorrow, etc.
)

object ParseNaturalLanguageTaskUseCase {

    fun parse(rawInput: String): ParsedTaskInput {
        var text = rawInput.trim()
        var priority = TaskPriority.MEDIUM
        var category = TaskCategory.STUDY
        val tags = mutableListOf<String>()
        var estimatedMinutes: Int? = null
        var recurrence = TaskRecurrence.NONE
        var dayOffset: Int? = null

        // 1. Extract Tags: #tagname
        val tagRegex = Regex("#([a-zA-Z0-9_-]+)")
        tagRegex.findAll(text).forEach { match ->
            val tag = match.groupValues[1].lowercase()
            tags.add(tag)
            when (tag) {
                "study" -> category = TaskCategory.STUDY
                "work" -> category = TaskCategory.WORK
                "personal" -> category = TaskCategory.PERSONAL
                "finance" -> category = TaskCategory.FINANCE
                "health" -> category = TaskCategory.HEALTH
                "project" -> category = TaskCategory.PROJECT
            }
        }
        text = tagRegex.replace(text, "").trim()

        // 2. Extract Priority
        when {
            Regex("(?i)\\b(p1|!1|urgent|critical)\\b").containsMatchIn(text) -> {
                priority = TaskPriority.URGENT
                text = Regex("(?i)\\b(p1|!1|urgent|critical)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\b(p2|!2|high)\\b").containsMatchIn(text) -> {
                priority = TaskPriority.HIGH
                text = Regex("(?i)\\b(p2|!2|high)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\b(p3|!3|medium|med)\\b").containsMatchIn(text) -> {
                priority = TaskPriority.MEDIUM
                text = Regex("(?i)\\b(p3|!3|medium|med)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\b(p4|!4|low)\\b").containsMatchIn(text) -> {
                priority = TaskPriority.LOW
                text = Regex("(?i)\\b(p4|!4|low)\\b").replace(text, "").trim()
            }
        }

        // 3. Extract Duration: ~30m, 45mins, ~1h, 2hrs, 2hours
        val durationMatch = Regex("(?i)~?(\\d+)\\s*(m|min|mins|minutes|h|hr|hrs|hours)\\b").find(text)
        if (durationMatch != null) {
            val amount = durationMatch.groupValues[1].toIntOrNull() ?: 0
            val unit = durationMatch.groupValues[2].lowercase()
            estimatedMinutes = if (unit.startsWith("h")) amount * 60 else amount
            text = text.replace(durationMatch.value, "").trim()
        }

        // 4. Extract Recurrence
        when {
            Regex("(?i)\\b(every\\s*day|daily)\\b").containsMatchIn(text) -> {
                recurrence = TaskRecurrence.DAILY
                text = Regex("(?i)\\b(every\\s*day|daily)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\b(every\\s*weekday|weekdays)\\b").containsMatchIn(text) -> {
                recurrence = TaskRecurrence.WEEKDAYS
                text = Regex("(?i)\\b(every\\s*weekday|weekdays)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\b(every\\s*week|weekly)\\b").containsMatchIn(text) -> {
                recurrence = TaskRecurrence.WEEKLY
                text = Regex("(?i)\\b(every\\s*week|weekly)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\b(every\\s*month|monthly)\\b").containsMatchIn(text) -> {
                recurrence = TaskRecurrence.MONTHLY
                text = Regex("(?i)\\b(every\\s*month|monthly)\\b").replace(text, "").trim()
            }
        }

        // 5. Extract Relative Dates
        when {
            Regex("(?i)\\b(today|tonight)\\b").containsMatchIn(text) -> {
                dayOffset = 0
                text = Regex("(?i)\\b(today|tonight)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\b(tomorrow|tmrw)\\b").containsMatchIn(text) -> {
                dayOffset = 1
                text = Regex("(?i)\\b(tomorrow|tmrw)\\b").replace(text, "").trim()
            }
            Regex("(?i)\\bin\\s+(\\d+)\\s+days?\\b").containsMatchIn(text) -> {
                val match = Regex("(?i)\\bin\\s+(\\d+)\\s+days?\\b").find(text)
                if (match != null) {
                    dayOffset = match.groupValues[1].toIntOrNull()
                    text = text.replace(match.value, "").trim()
                }
            }
        }

        // Clean extra spaces
        val cleanTitle = text.replace(Regex("\\s+"), " ").trim()

        return ParsedTaskInput(
            title = if (cleanTitle.isNotEmpty()) cleanTitle else "New Task",
            priority = priority,
            category = category,
            estimatedMinutes = estimatedMinutes,
            recurrence = recurrence,
            tags = tags,
            relativeDayOffset = dayOffset
        )
    }
}
