package com.lifetrack.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetrack.domain.model.BudgetSettings
import com.lifetrack.domain.model.FinanceCategory
import com.lifetrack.domain.model.Transaction
import com.lifetrack.domain.model.TransactionType
import com.lifetrack.ui.theme.LifeTrackEmeraldPrimary

@Composable
fun FinanceLedgerView(
    modifier: Modifier = Modifier
) {
    val budgetSettings = remember { BudgetSettings(monthlyBudget = 8500.0, currencySymbol = "₹") }

    val transactions = remember {
        mutableStateListOf(
            Transaction("tx-1", 450.0, TransactionType.EXPENSE, FinanceCategory.FOOD, "Hostel Mess Snacks & Canteen", 1720000000000L, "2026-09-27"),
            Transaction("tx-2", 1200.0, TransactionType.EXPENSE, FinanceCategory.BOOKS, "VTU 5th Sem Textbooks", 1720000050000L, "2026-09-26"),
            Transaction("tx-3", 6000.0, TransactionType.INCOME, FinanceCategory.OTHER, "Monthly Allowance / Stipend", 1720000080000L, "2026-09-25"),
            Transaction("tx-4", 350.0, TransactionType.EXPENSE, FinanceCategory.TRANSPORT, "Namma Metro Card Recharge", 1720000100000L, "2026-09-24")
        )
    }

    var newTitle by remember { mutableStateOf("") }
    var newAmount by remember { mutableStateOf("") }
    var isExpense by remember { mutableStateOf(true) }

    val totalExpense = transactions.filter { it.type == TransactionType.EXPENSE }.sumOf { it.amount }
    val totalIncome = transactions.filter { it.type == TransactionType.INCOME }.sumOf { it.amount }
    val budgetSpentPercent = ((totalExpense / budgetSettings.monthlyBudget) * 100.0).coerceIn(0.0, 100.0)

    Column(modifier = modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        // Summary Cards Row
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Text("Monthly Budget & Expenses", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "${budgetSettings.currencySymbol}${totalExpense.toInt()} / ${budgetSettings.currencySymbol}${budgetSettings.monthlyBudget.toInt()}",
                            color = Color(0xFF2DD4BF),
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text("Spent (${budgetSpentPercent.toInt()}%)", color = Color(0xFF94A3B8), fontSize = 11.sp)
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "+${budgetSettings.currencySymbol}${totalIncome.toInt()}",
                            color = Color(0xFF34D399),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text("Total Income", color = Color(0xFF94A3B8), fontSize = 11.sp)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                LinearProgressIndicator(
                    progress = { (budgetSpentPercent / 100.0).toFloat() },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                    color = if (budgetSpentPercent > 80) Color(0xFFEF4444) else LifeTrackEmeraldPrimary,
                    trackColor = Color(0xFF334155)
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Quick Add Transaction Input
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(1.dp)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = newTitle,
                        onValueChange = { newTitle = it },
                        placeholder = { Text("Expense note...", fontSize = 12.sp) },
                        modifier = Modifier.weight(1.5f).height(50.dp),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = newAmount,
                        onValueChange = { newAmount = it },
                        placeholder = { Text("₹ Amount", fontSize = 12.sp) },
                        modifier = Modifier.weight(1f).height(50.dp),
                        singleLine = true
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = if (isExpense) Color(0xFFFEE2E2) else Color(0xFFF1F5F9),
                            onClick = { isExpense = true }
                        ) {
                            Text(
                                "Expense",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isExpense) Color(0xFFB91C1C) else Color.Gray
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = if (!isExpense) Color(0xFFD1FAE5) else Color(0xFFF1F5F9),
                            onClick = { isExpense = false }
                        ) {
                            Text(
                                "Income",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (!isExpense) Color(0xFF065F46) else Color.Gray
                            )
                        }
                    }

                    Button(
                        onClick = {
                            val parsedAmount = newAmount.toDoubleOrNull()
                            if (newTitle.isNotBlank() && parsedAmount != null && parsedAmount > 0) {
                                transactions.add(
                                    0,
                                    Transaction(
                                        id = "tx-${System.currentTimeMillis()}",
                                        amount = parsedAmount,
                                        type = if (isExpense) TransactionType.EXPENSE else TransactionType.INCOME,
                                        category = FinanceCategory.OTHER,
                                        note = newTitle,
                                        timestampEpochMs = System.currentTimeMillis(),
                                        date = "Today"
                                    )
                                )
                                newTitle = ""
                                newAmount = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E)),
                        shape = RoundedCornerShape(6.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Text("Add", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Text("Recent Transactions", fontWeight = FontWeight.Bold, fontSize = 14.sp)
        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(transactions, key = { it.id }) { tx ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(tx.note.ifBlank { tx.category.name }, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text("${tx.date} • ${tx.category.name}", fontSize = 11.sp, color = Color.Gray)
                        }
                        Text(
                            text = if (tx.type == TransactionType.EXPENSE) "-${budgetSettings.currencySymbol}${tx.amount.toInt()}" else "+${budgetSettings.currencySymbol}${tx.amount.toInt()}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = if (tx.type == TransactionType.EXPENSE) Color(0xFFE11D48) else Color(0xFF059669)
                        )
                    }
                }
            }
        }
    }
}
