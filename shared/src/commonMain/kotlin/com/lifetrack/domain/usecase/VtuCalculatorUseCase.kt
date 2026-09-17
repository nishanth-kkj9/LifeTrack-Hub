package com.lifetrack.domain.usecase

import com.lifetrack.domain.model.AttendanceReport
import com.lifetrack.domain.model.AttendanceStatus
import com.lifetrack.domain.model.Subject
import com.lifetrack.domain.model.VtuDegreeClass
import com.lifetrack.domain.model.VtuGrade
import com.lifetrack.domain.model.VtuGradingSystem
import com.lifetrack.domain.model.VtuSemesterSummary
import com.lifetrack.domain.model.VtuSubject
import kotlin.math.ceil
import kotlin.math.floor

/**
 * Domain use case encapsulating VTU CBCS 2022/2021/2018 grading, percentage, and attendance calculations.
 */
class VtuCalculatorUseCase {

    fun calculateSgpa(subjects: List<VtuSubject>): Double {
        return VtuGradingSystem.calculateSgpa(subjects)
    }

    fun calculateCgpa(semesters: List<VtuSemesterSummary>): Double {
        return VtuGradingSystem.calculateCgpa(semesters)
    }

    /**
     * Official VTU Formula: Percentage = (CGPA - 0.75) * 10
     */
    fun calculatePercentage(cgpa: Double): Double {
        return if (cgpa >= 0.75) (cgpa - 0.75) * 10.0 else 0.0
    }

    fun determineClass(cgpa: Double): VtuDegreeClass {
        return VtuDegreeClass.fromCgpa(cgpa)
    }

    /**
     * Generates a VTU 85% attendance policy analysis for a given subject.
     */
    fun analyzeAttendance(
        subject: Subject,
        targetPercentage: Double = 85.0
    ): AttendanceReport {
        val attended = subject.attendedClasses
        val total = subject.totalClasses
        val currentPercent = subject.attendancePercentage

        val targetFraction = targetPercentage / 100.0

        val classesNeeded: Int = if (total == 0) {
            0
        } else if (currentPercent < targetPercentage) {
            // (attended + X) / (total + X) >= targetFraction
            // attended + X >= targetFraction * total + targetFraction * X
            // X * (1 - targetFraction) >= targetFraction * total - attended
            // X >= (targetFraction * total - attended) / (1 - targetFraction)
            val numerator = (targetFraction * total) - attended
            val denominator = 1.0 - targetFraction
            ceil(numerator / denominator).toInt().coerceAtLeast(0)
        } else {
            0
        }

        val classesCanBunk: Int = if (total == 0 || currentPercent < targetPercentage) {
            0
        } else {
            // attended / (total + Y) >= targetFraction
            // total + Y <= attended / targetFraction
            // Y <= (attended / targetFraction) - total
            val maxTotal = floor(attended.toDouble() / targetFraction).toInt()
            (maxTotal - total).coerceAtLeast(0)
        }

        val status = when {
            currentPercent >= 85.0 -> AttendanceStatus.SAFE
            currentPercent >= 75.0 -> AttendanceStatus.WARNING
            else -> AttendanceStatus.CRITICAL
        }

        return AttendanceReport(
            subjectId = subject.id,
            subjectName = subject.name,
            attended = attended,
            total = total,
            currentPercentage = currentPercent,
            targetPercentage = targetPercentage,
            classesNeededForTarget = classesNeeded,
            classesCanBunk = classesCanBunk,
            status = status
        )
    }
}
