package com.lifetrack

import com.lifetrack.domain.usecase.AttendanceStatus
import com.lifetrack.domain.usecase.VtuCalculatorUseCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class VtuCalculatorTest {

    @Test
    fun testVtuGradeMapping() {
        assertEquals("O", VtuCalculatorUseCase.getGradeFromMarks(95.0).letter)
        assertEquals(10, VtuCalculatorUseCase.getGradeFromMarks(90.0).points)
        assertEquals("A+", VtuCalculatorUseCase.getGradeFromMarks(85.0).letter)
        assertEquals("A", VtuCalculatorUseCase.getGradeFromMarks(72.0).letter)
        assertEquals("B+", VtuCalculatorUseCase.getGradeFromMarks(65.0).letter)
        assertEquals("B", VtuCalculatorUseCase.getGradeFromMarks(56.0).letter)
        assertEquals("C", VtuCalculatorUseCase.getGradeFromMarks(51.0).letter)
        assertEquals("P", VtuCalculatorUseCase.getGradeFromMarks(42.0).letter)
        assertEquals("F", VtuCalculatorUseCase.getGradeFromMarks(35.0).letter)
    }

    @Test
    fun testOfficialVtuPercentageFormula() {
        // Formula: (CGPA - 0.75) * 10
        // 8.42 -> (8.42 - 0.75) * 10 = 76.7
        val pct = VtuCalculatorUseCase.cgpaToPercentage(8.42)
        assertEquals(76.7, pct)

        // 9.75 -> 90.0%
        assertEquals(90.0, VtuCalculatorUseCase.cgpaToPercentage(9.75))

        // Clamped at 0
        assertEquals(0.0, VtuCalculatorUseCase.cgpaToPercentage(0.5))
    }

    @Test
    fun testDegreeClassification() {
        assertTrue(VtuCalculatorUseCase.getDegreeClass(8.5).isDistinction)
        assertEquals("First Class with Distinction (FCD)", VtuCalculatorUseCase.getDegreeClass(8.5).title)
        assertEquals("First Class (FC)", VtuCalculatorUseCase.getDegreeClass(7.0).title)
        assertEquals("Second Class (SC)", VtuCalculatorUseCase.getDegreeClass(6.0).title)
        assertEquals("Pass Class", VtuCalculatorUseCase.getDegreeClass(4.5).title)
    }

    @Test
    fun testSemesterSgpaCalculation() {
        // 4 credits with 10 pts = 40
        // 4 credits with 9 pts = 36
        // 3 credits with 8 pts = 24
        // total credits = 11, total points = 100 -> SGPA = 9.09
        val sgpa = VtuCalculatorUseCase.calculateSemesterSgpa(
            listOf(4 to 10, 4 to 9, 3 to 8)
        )
        assertEquals(9.09, sgpa)
    }

    @Test
    fun testAttendanceReportSafeAndBunk() {
        // 38 attended out of 44 classes = 86.4% (> 85% threshold)
        val report = VtuCalculatorUseCase.calculateAttendanceReport(38, 44, 85.0)
        assertEquals(86.4, report.percentage)
        assertEquals(AttendanceStatus.SAFE, report.status)
        // Can bunk 0 classes because 38 / 45 = 84.4% (< 85%)
        assertEquals(0, report.classesCanBunk)
        assertEquals(0, report.classesToAttend)
    }

    @Test
    fun testAttendanceReportWarningAndCatchUp() {
        // 30 attended out of 40 classes = 75.0% (< 85% threshold)
        val report = VtuCalculatorUseCase.calculateAttendanceReport(30, 40, 85.0)
        assertEquals(75.0, report.percentage)
        assertEquals(AttendanceStatus.WARNING, report.status)
        assertTrue(report.classesToAttend > 0)
    }
}
