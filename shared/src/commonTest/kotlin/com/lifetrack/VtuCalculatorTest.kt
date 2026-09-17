package com.lifetrack

import com.lifetrack.domain.model.VtuGrade
import com.lifetrack.domain.model.VtuGradingSystem
import com.lifetrack.domain.model.VtuSemesterSummary
import com.lifetrack.domain.model.VtuSubject
import kotlin.test.Test
import kotlin.test.assertEquals

class VtuCalculatorTest {

    @Test
    fun testVtuSgpaCalculation() {
        val subjects = listOf(
            VtuSubject(code = "21CS51", name = "Management & Entrepreneurship", credits = 3, grade = VtuGrade.A), // 3 * 8 = 24
            VtuSubject(code = "21CS52", name = "Computer Networks", credits = 4, grade = VtuGrade.O), // 4 * 10 = 40
            VtuSubject(code = "21CS53", name = "Database Management", credits = 4, grade = VtuGrade.A_PLUS), // 4 * 9 = 36
            VtuSubject(code = "21CSL57", name = "CN & DBMS Lab", credits = 1, grade = VtuGrade.O) // 1 * 10 = 10
        )
        // Total credits = 12
        // Total points = 24 + 40 + 36 + 10 = 110
        // SGPA = 110 / 12 = 9.1666...
        val sgpa = VtuGradingSystem.calculateSgpa(subjects)
        assertEquals(9.17, (sgpa * 100.0).toLong() / 100.0, 0.01)
    }

    @Test
    fun testVtuCgpaCalculation() {
        val sem1 = VtuSemesterSummary(semesterNumber = 1, subjects = emptyList(), sgpa = 8.5, totalCredits = 20)
        val sem2 = VtuSemesterSummary(semesterNumber = 2, subjects = emptyList(), sgpa = 9.0, totalCredits = 20)
        // CGPA = (8.5 * 20 + 9.0 * 20) / 40 = 350 / 40 = 8.75
        val cgpa = VtuGradingSystem.calculateCgpa(listOf(sem1, sem2))
        assertEquals(8.75, cgpa, 0.001)
    }
}
