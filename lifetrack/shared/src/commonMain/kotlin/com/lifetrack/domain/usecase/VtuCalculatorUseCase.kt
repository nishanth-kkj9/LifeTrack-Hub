package com.lifetrack.domain.usecase

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class VtuGrade(
    val letter: String,
    val points: Int,
    val minMarks: Int,
    val maxMarks: Int,
    val description: String
)

data class VtuDegreeClass(
    val title: String,
    val isDistinction: Boolean
)

data class AttendanceReport(
    val percentage: Double,
    val status: AttendanceStatus,
    val classesCanBunk: Int,
    val classesToAttend: Int,
    val threshold: Double
)

enum class AttendanceStatus {
    SAFE,
    WARNING,
    DANGER
}

object VtuCalculatorUseCase {

    val GRADES = listOf(
        VtuGrade("O", 10, 90, 100, "Outstanding"),
        VtuGrade("A+", 9, 80, 89, "Excellent"),
        VtuGrade("A", 8, 70, 79, "Very Good"),
        VtuGrade("B+", 7, 60, 69, "Good"),
        VtuGrade("B", 6, 55, 59, "Above Average"),
        VtuGrade("C", 5, 50, 54, "Average"),
        VtuGrade("P", 4, 40, 49, "Pass"),
        VtuGrade("F", 0, 0, 39, "Fail")
    )

    fun getGradeFromMarks(totalMarks: Double): VtuGrade {
        val rounded = totalMarks.roundToInt()
        return GRADES.firstOrNull { rounded >= it.minMarks } ?: VtuGrade("F", 0, 0, 39, "Fail")
    }

    /**
     * Official VTU Formula for 2018, 2021, and 2022 Schemes:
     * Percentage (%) = (CGPA - 0.75) * 10
     */
    fun cgpaToPercentage(cgpa: Double): Double {
        if (cgpa <= 0.0) return 0.0
        val percentage = (cgpa - 0.75) * 10.0
        val clamped = max(0.0, min(100.0, percentage))
        return (clamped * 100.0).roundToInt() / 100.0
    }

    fun getDegreeClass(cgpa: Double): VtuDegreeClass {
        return when {
            cgpa >= 7.75 -> VtuDegreeClass("First Class with Distinction (FCD)", isDistinction = true)
            cgpa >= 6.75 -> VtuDegreeClass("First Class (FC)", isDistinction = false)
            cgpa >= 5.75 -> VtuDegreeClass("Second Class (SC)", isDistinction = false)
            cgpa >= 4.0 -> VtuDegreeClass("Pass Class", isDistinction = false)
            else -> VtuDegreeClass("Needs Improvement / Arrear", isDistinction = false)
        }
    }

    fun calculateSemesterSgpa(subjectCreditsAndPoints: List<Pair<Int, Int>>): Double {
        var totalCredits = 0
        var totalPoints = 0
        for ((credits, gradePoints) in subjectCreditsAndPoints) {
            totalCredits += credits
            totalPoints += credits * gradePoints
        }
        if (totalCredits <= 0) return 0.0
        val sgpa = totalPoints.toDouble() / totalCredits.toDouble()
        return (sgpa * 100.0).roundToInt() / 100.0
    }

    fun calculateAttendanceReport(attended: Int, total: Int, threshold: Double = 85.0): AttendanceReport {
        if (total <= 0) {
            return AttendanceReport(
                percentage = 100.0,
                status = AttendanceStatus.SAFE,
                classesCanBunk = 0,
                classesToAttend = 0,
                threshold = threshold
            )
        }

        val rawPct = (attended.toDouble() / total.toDouble()) * 100.0
        val pct = (rawPct * 10.0).roundToInt() / 10.0

        val status = when {
            pct < 75.0 -> AttendanceStatus.DANGER
            pct < threshold -> AttendanceStatus.WARNING
            else -> AttendanceStatus.SAFE
        }

        val thresholdRatio = threshold / 100.0
        var canBunk = 0
        var needAttend = 0

        if (pct >= threshold) {
            // How many more classes can be missed while remaining >= threshold
            val bunkable = floor((attended.toDouble() - (thresholdRatio * total.toDouble())) / thresholdRatio).toInt()
            canBunk = max(0, bunkable)
        } else {
            // How many consecutive classes must be attended to reach threshold
            val required = ceil(((thresholdRatio * total.toDouble()) - attended.toDouble()) / (1.0 - thresholdRatio)).toInt()
            needAttend = max(0, required)
        }

        return AttendanceReport(
            percentage = pct,
            status = status,
            classesCanBunk = canBunk,
            classesToAttend = needAttend,
            threshold = threshold
        )
    }
}
