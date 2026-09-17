package com.lifetrack.domain.model

enum class VtuGrade(val gradePoints: Int, val description: String) {
    O(10, "Outstanding"),
    A_PLUS(9, "Excellent"),
    A(8, "Very Good"),
    B_PLUS(7, "Good"),
    B(6, "Above Average"),
    C(5, "Average"),
    P(4, "Pass"),
    F(0, "Fail");

    companion object {
        fun fromScore(score: Int): VtuGrade = when {
            score >= 90 -> O
            score >= 80 -> A_PLUS
            score >= 70 -> A
            score >= 60 -> B_PLUS
            score >= 50 -> B
            score >= 40 -> C
            score >= 35 -> P
            else -> F
        }
    }
}

enum class VtuDegreeClass(val displayName: String) {
    FIRST_CLASS_WITH_DISTINCTION("First Class with Distinction"),
    FIRST_CLASS("First Class"),
    SECOND_CLASS("Second Class"),
    PASS_CLASS("Pass Class"),
    FAIL("Fail");

    companion object {
        fun fromCgpa(cgpa: Double): VtuDegreeClass = when {
            cgpa >= 7.75 -> FIRST_CLASS_WITH_DISTINCTION
            cgpa >= 6.75 -> FIRST_CLASS
            cgpa >= 5.75 -> SECOND_CLASS
            cgpa >= 4.0 -> PASS_CLASS
            else -> FAIL
        }
    }
}

enum class AttendanceStatus {
    SAFE,
    WARNING,
    CRITICAL
}

data class Subject(
    val id: String,
    val code: String,
    val name: String,
    val credits: Int,
    val semester: Int,
    val scheme: String = "2022",
    val attendedClasses: Int = 0,
    val totalClasses: Int = 0,
    val cieMarks: Int? = null,
    val maxCieMarks: Int = 50,
    val seeMarks: Int? = null,
    val maxSeeMarks: Int = 50,
    val grade: VtuGrade? = null
) {
    val attendancePercentage: Double
        get() = if (totalClasses > 0) (attendedClasses.toDouble() / totalClasses) * 100.0 else 100.0

    val totalMarks: Int?
        get() = if (cieMarks != null && seeMarks != null) cieMarks + seeMarks else null
}

data class Exam(
    val id: String,
    val subjectId: String,
    val subjectCode: String,
    val subjectName: String,
    val examType: String, // "CIE-1", "CIE-2", "CIE-3", "SEE"
    val date: String,     // YYYY-MM-DD
    val time: String,     // HH:mm
    val room: String? = null,
    val maxMarks: Int = 50,
    val syllabusTopics: List<String> = emptyList()
)

data class SyllabusTopic(
    val id: String,
    val subjectId: String,
    val moduleNumber: Int,
    val topicName: String,
    val isCompleted: Boolean = false,
    val pyqFrequency: Int = 0 // Number of times appeared in VTU exams
)

data class AttendanceReport(
    val subjectId: String,
    val subjectName: String,
    val attended: Int,
    val total: Int,
    val currentPercentage: Double,
    val targetPercentage: Double = 85.0,
    val classesNeededForTarget: Int,
    val classesCanBunk: Int,
    val status: AttendanceStatus
)

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

    fun cgpaToPercentage(cgpa: Double): Double {
        return (cgpa - 0.75) * 10.0
    }
}
