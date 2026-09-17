package com.lifetrack.domain.model

data class Subject(
    val id: String,
    val code: String, // e.g. BCS301
    val name: String, // e.g. Data Structures & Applications
    val credits: Int = 4,
    val cieMarks: Double = 0.0, // Internal Continuous Evaluation (0-50)
    val seeMarks: Double = 0.0, // Semester End Exam Marks (0-50)
    val attendedClasses: Int = 0,
    val totalClasses: Int = 0,
    val targetAttendancePercent: Double = 85.0,
    val updatedAt: Long = 0L,
    val isDeleted: Boolean = false
) {
    val totalMarks: Double
        get() = cieMarks + seeMarks

    val attendancePercentage: Double
        get() = if (totalClasses > 0) (attendedClasses.toDouble() / totalClasses.toDouble()) * 100.0 else 100.0
}

enum class ExamStatus {
    NOT_STARTED,
    STUDYING,
    REVIEWING,
    READY
}

data class Exam(
    val id: String,
    val subjectId: String? = null,
    val title: String,
    val courseCode: String? = null,
    val examDate: String, // YYYY-MM-DD
    val examTime: String, // HH:mm
    val roomOrVenue: String? = null,
    val targetScore: String? = null,
    val status: ExamStatus = ExamStatus.STUDYING,
    val studyGuideMarkdown: String? = null,
    val updatedAt: Long = 0L,
    val isDeleted: Boolean = false
)

data class SyllabusTopic(
    val id: String,
    val subjectId: String,
    val examId: String? = null,
    val moduleNumber: Int,
    val title: String,
    val isCompleted: Boolean = false,
    val confidenceLevel: Int = 1, // 1 to 5
    val updatedAt: Long = 0L,
    val isDeleted: Boolean = false
)
