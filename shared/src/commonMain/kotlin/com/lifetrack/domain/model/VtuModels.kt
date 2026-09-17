package com.lifetrack.domain.model

enum class VtuGrade(val gradePoints: Int, val description: String) {
    O(10, "Outstanding"),
    A_PLUS(9, "Excellent"),
    A(8, "Very Good"),
    B_PLUS(7, "Good"),
    B(6, "Above Average"),
    C(5, "Average"),
    P(4, "Pass"),
    F(0, "Fail")
}

data class VtuSubject(
    val code: String,
    val name: String,
    val credits: Int,
    val grade: VtuGrade? = null,
    val internalMarks: Int? = null,
    val externalMarks: Int? = null
) {
    val totalMarks: Int?
        get() = if (internalMarks != null && externalMarks != null) internalMarks + externalMarks else null
}

data class VtuSemesterSummary(
    val semesterNumber: Int,
    val subjects: List<VtuSubject>,
    val sgpa: Double,
    val totalCredits: Int
)

object VtuGradingSystem {
    fun calculateSgpa(subjects: List<VtuSubject>): Double {
        var totalCreditPoints = 0.0
        var totalCredits = 0
        for (sub in subjects) {
            val grade = sub.grade ?: continue
            totalCreditPoints += sub.credits * grade.gradePoints
            totalCredits += sub.credits
        }
        return if (totalCredits > 0) (totalCreditPoints / totalCredits) else 0.0
    }

    fun calculateCgpa(semesters: List<VtuSemesterSummary>): Double {
        var totalPoints = 0.0
        var totalCredits = 0
        for (sem in semesters) {
            totalPoints += sem.sgpa * sem.totalCredits
            totalCredits += sem.totalCredits
        }
        return if (totalCredits > 0) (totalPoints / totalCredits) else 0.0
    }
}
