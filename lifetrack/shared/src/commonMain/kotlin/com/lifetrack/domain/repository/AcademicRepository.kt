package com.lifetrack.domain.repository

import com.lifetrack.domain.model.Exam
import com.lifetrack.domain.model.Subject
import com.lifetrack.domain.model.SyllabusTopic
import kotlinx.coroutines.flow.Flow

interface AcademicRepository {
    fun getSubjects(): Flow<List<Subject>>
    fun getExams(): Flow<List<Exam>>
    fun getSyllabusTopics(subjectId: String): Flow<List<SyllabusTopic>>
    suspend fun saveSubject(subject: Subject)
    suspend fun saveExam(exam: Exam)
    suspend fun toggleTopicCompletion(topicId: String)
    suspend fun updateAttendance(subjectId: String, attendedDelta: Int, totalDelta: Int)
}
