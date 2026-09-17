package com.lifetrack

import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class NaturalLanguageParserTest {

    @Test
    fun testParseTaskWithPriorityAndEstimateAndTags() {
        val input = "Finish Operating Systems Assignment ~45m #study !high tomorrow"
        val parsed = ParseNaturalLanguageTaskUseCase.parse(input)

        assertEquals("Finish Operating Systems Assignment", parsed.title)
        assertEquals(TaskPriority.HIGH, parsed.priority)
        assertEquals(TaskCategory.STUDY, parsed.category)
        assertEquals(45, parsed.estimatedMinutes)
        assertEquals(1, parsed.relativeDayOffset)
        assertTrue(parsed.tags.contains("study"))
    }

    @Test
    fun testParseTaskWithRecurrenceAndUrgentPriority() {
        val input = "Review VTU question papers daily #project !1"
        val parsed = ParseNaturalLanguageTaskUseCase.parse(input)

        assertEquals("Review VTU question papers", parsed.title)
        assertEquals(TaskPriority.URGENT, parsed.priority)
        assertEquals(TaskRecurrence.DAILY, parsed.recurrence)
        assertEquals(TaskCategory.PROJECT, parsed.category)
    }

    @Test
    fun testParseTaskHourEstimate() {
        val input = "Database normalization deep dive ~2h #study"
        val parsed = ParseNaturalLanguageTaskUseCase.parse(input)

        assertEquals("Database normalization deep dive", parsed.title)
        assertEquals(120, parsed.estimatedMinutes)
        assertEquals(TaskCategory.STUDY, parsed.category)
    }
}
