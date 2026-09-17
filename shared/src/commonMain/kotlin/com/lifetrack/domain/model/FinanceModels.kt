package com.lifetrack.domain.model

enum class TransactionType {
    INCOME,
    EXPENSE,
    TRANSFER
}

enum class FinanceCategory {
    FOOD,
    TRANSPORT,
    ACADEMICS,
    TECH,
    HEALTH,
    ENTERTAINMENT,
    INVESTMENT,
    FEES,
    HOSTEL,
    BOOKS,
    OTHER
}

data class Transaction(
    val id: String,
    val amount: Double,
    val type: TransactionType,
    val category: FinanceCategory = FinanceCategory.OTHER,
    val note: String = "",
    val timestampEpochMs: Long = 0L,
    val date: String = "", // YYYY-MM-DD
    val isSyncPending: Boolean = false
)

data class BudgetSettings(
    val monthlyBudget: Double = 5000.0,
    val categoryBudgets: Map<FinanceCategory, Double> = emptyMap(),
    val currencySymbol: String = "₹",
    val alertThresholdPercent: Double = 80.0
)

data class Note(
    val id: String,
    val title: String,
    val content: String,
    val tags: List<String> = emptyList(),
    val isPinned: Boolean = false,
    val createdAtEpochMs: Long = 0L,
    val updatedAtEpochMs: Long = 0L
)
