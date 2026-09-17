package com.lifetrack.domain.repository

import com.lifetrack.domain.model.BudgetSettings
import com.lifetrack.domain.model.FocusSession
import com.lifetrack.domain.model.Habit
import com.lifetrack.domain.model.HabitLog
import com.lifetrack.domain.model.Note
import com.lifetrack.domain.model.Transaction
import kotlinx.coroutines.flow.Flow

interface HabitRepository {
    fun getHabits(): Flow<List<Habit>>
    fun getHabitLogs(habitId: String): Flow<List<HabitLog>>
    suspend fun saveHabit(habit: Habit)
    suspend fun logHabitDay(habitId: String, date: String, completed: Boolean)
    suspend fun recordFocusSession(session: FocusSession)
}

interface FinanceRepository {
    fun getTransactions(): Flow<List<Transaction>>
    fun getBudgetSettings(): Flow<BudgetSettings>
    suspend fun saveTransaction(transaction: Transaction)
    suspend fun deleteTransaction(id: String)
    suspend fun updateBudgetSettings(settings: BudgetSettings)
}

interface NoteRepository {
    fun getNotes(): Flow<List<Note>>
    suspend fun saveNote(note: Note)
    suspend fun deleteNote(id: String)
    suspend fun togglePin(id: String)
}
