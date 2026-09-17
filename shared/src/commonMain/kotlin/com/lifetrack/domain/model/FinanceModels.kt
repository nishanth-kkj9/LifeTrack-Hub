package com.lifetrack.domain.model

enum class TransactionType {
    INCOME,
    EXPENSE,
    TRANSFER
}

enum class TransactionCategory {
    FOOD,
    TRANSPORT,
    ACADEMICS,
    TECH,
    HEALTH,
    ENTERTAINMENT,
    INVESTMENT,
    OTHER
}

data class Transaction(
    val id: String,
    val amount: Double,
    val type: TransactionType,
    val category: TransactionCategory,
    val note: String = "",
    val timestampEpochMs: Long = 0L,
    val isSyncPending: Boolean = false
)
