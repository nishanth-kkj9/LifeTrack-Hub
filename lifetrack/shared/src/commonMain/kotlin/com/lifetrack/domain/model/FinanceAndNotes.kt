package com.lifetrack.domain.model

enum class TransactionType {
    INCOME,
    EXPENSE
}

enum class FinanceCategory(val displayName: String) {
    TUITION_AND_EDUCATION("Tuition & Education"),
    BOOKS_AND_SUPPLIES("Books & Supplies"),
    HOUSING_AND_RENT("Housing & Rent"),
    FOOD_AND_DINING("Food & Dining"),
    GROCERIES("Groceries"),
    TRANSPORTATION("Transportation"),
    BILLS_AND_UTILITIES("Bills & Utilities"),
    SHOPPING("Shopping"),
    HEALTH_AND_WELLNESS("Health & Wellness"),
    SALARY_AND_WAGES("Salary & Wages"),
    FREELANCE_AND_GIGS("Freelance & Gigs"),
    ALLOWANCE_AND_GRANTS("Allowance & Grants"),
    INVESTMENTS_AND_SAVINGS("Investments & Savings"),
    OTHER("Other")
}

data class Transaction(
    val id: String,
    val title: String,
    val amount: Double,
    val type: TransactionType,
    val category: FinanceCategory = FinanceCategory.FOOD_AND_DINING,
    val date: String, // YYYY-MM-DD
    val paymentMethod: String = "Online Wallet",
    val notes: String? = null,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    val isDeleted: Boolean = false
)

data class BudgetSettings(
    val monthlyBudget: Double = 15000.0,
    val savingsGoal: Double = 5000.0,
    val currencySymbol: String = "₹"
)

data class Note(
    val id: String,
    val title: String,
    val content: String,
    val category: String = "Quick Notes",
    val isPinned: Boolean = false,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    val isDeleted: Boolean = false
)
