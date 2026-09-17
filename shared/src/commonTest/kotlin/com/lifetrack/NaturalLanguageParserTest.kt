package com.lifetrack

import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import kotlin.test.Test
import kotlin.test.assertEquals

class NaturalLanguageParserTest {

    private val parser = ParseNaturalLanguageTaskUseCase()

    @Test
    fun testUrgentVtuTaskParsing() {
        val result = parser("VTU Computer Networks Lab Record urgent 60m")
        assertEquals(TaskCategory.VTU, result.category)
        assertEquals(TaskPriority.URGENT, result.priority)
        assertEquals(60, result.estimatedMinutes)
        assertEquals("VTU Computer Networks Lab Record", result.title)
    }

    @Test
    fun testFinanceTaskParsing() {
        val result = parser("Pay College Semester Exam Fee 15 mins")
        assertEquals(TaskCategory.FINANCE, result.category)
        assertEquals(15, result.estimatedMinutes)
    }
}
