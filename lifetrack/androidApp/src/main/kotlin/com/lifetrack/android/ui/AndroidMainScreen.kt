package com.lifetrack.android.ui

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import com.lifetrack.domain.usecase.VtuCalculatorUseCase
import com.lifetrack.ui.TasksUiAction
import com.lifetrack.ui.TasksViewModel
import com.lifetrack.ui.components.CategoryFilterRow
import com.lifetrack.ui.components.NaturalLanguageTaskInputBar
import com.lifetrack.ui.components.TaskCardItem
import com.lifetrack.ui.components.TaskMetricsBar
import com.lifetrack.ui.theme.AccentTeal
import com.lifetrack.ui.theme.PrimaryBlue
import com.lifetrack.ui.theme.SuccessGreen
import com.lifetrack.ui.theme.WarningAmber

enum class AndroidTab(val title: String) {
    TASKS("Tasks"),
    ACADEMICS("Academics"),
    FINANCES("Finances"),
    ARCHITECTURE("System")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AndroidMainScreen(
    tasksViewModel: TasksViewModel
) {
    var currentTab by remember { mutableStateOf(AndroidTab.TASKS) }
    val uiState by tasksViewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "LifeTrack Hub",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Android Production Shell • Phase 1",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                AndroidTab.values().forEach { tab ->
                    NavigationBarItem(
                        selected = currentTab == tab,
                        onClick = { currentTab = tab },
                        label = { Text(tab.title, style = MaterialTheme.typography.labelSmall) },
                        icon = {
                            Box(
                                modifier = Modifier
                                    .padding(2.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(if (currentTab == tab) PrimaryBlue else Color.Transparent)
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    tab.title.take(1),
                                    fontWeight = FontWeight.Bold,
                                    color = if (currentTab == tab) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (currentTab) {
                AndroidTab.TASKS -> AndroidTasksTab(
                    uiState = uiState,
                    onAction = tasksViewModel::onAction
                )
                AndroidTab.ACADEMICS -> AndroidAcademicsTab()
                AndroidTab.FINANCES -> AndroidFinancesTab()
                AndroidTab.ARCHITECTURE -> AndroidArchitectureTab()
            }
        }
    }
}

@Composable
fun AndroidTasksTab(
    uiState: com.lifetrack.ui.TasksUiState,
    onAction: (TasksUiAction) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            NaturalLanguageTaskInputBar(
                onTaskSubmitted = { onAction(TasksUiAction.QuickCreateTask(it)) }
            )
        }

        item {
            TaskMetricsBar(
                totalTasks = uiState.tasks.size,
                completedTasks = uiState.completedCount,
                pendingTasks = uiState.pendingCount
            )
        }

        item {
            CategoryFilterRow(
                selectedCategory = uiState.selectedCategory,
                onSelectCategory = { onAction(TasksUiAction.FilterByCategory(it)) }
            )
        }

        if (uiState.isLoading) {
            item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
        } else if (uiState.filteredTasks.isEmpty()) {
            item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "No tasks found. Try adding one above!",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            items(uiState.filteredTasks, key = { it.id }) { task ->
                TaskCardItem(
                    task = task,
                    onToggle = { onAction(TasksUiAction.ToggleCompletion(task.id)) },
                    onDelete = { onAction(TasksUiAction.DeleteTask(task.id)) },
                    onAddSubtask = { onAction(TasksUiAction.AddSubtask(task.id, it)) }
                )
            }
        }
    }
}

@Composable
fun AndroidAcademicsTab() {
    val report = remember { VtuCalculatorUseCase.calculateAttendanceReport(attended = 38, total = 44, threshold = 85.0) }
    val pct = remember { VtuCalculatorUseCase.cgpaToPercentage(8.42) }
    val degree = remember { VtuCalculatorUseCase.getDegreeClass(8.42) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("VTU Academic Engine", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Official VTU CGPA Conversion", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Sample CGPA: 8.42", style = MaterialTheme.typography.bodyLarge)
                Text("Formula: (CGPA - 0.75) * 10 = $pct%", style = MaterialTheme.typography.bodyMedium, color = PrimaryBlue, fontWeight = FontWeight.Bold)
                Text("Class: ${degree.title}", style = MaterialTheme.typography.bodyMedium, color = SuccessGreen)
            }
        }

        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("VTU Attendance Calculator (85% Rule)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Attended: 38 / 44 classes (${report.percentage}%)", style = MaterialTheme.typography.bodyLarge)
                Text("Status: ${report.status.name}", style = MaterialTheme.typography.bodyMedium, color = SuccessGreen, fontWeight = FontWeight.Bold)
                Text("Safe to miss (bunk): ${report.classesCanBunk} more classes", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun AndroidFinancesTab() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Student Finance Core", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Monthly Budget", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Allowance: ₹15,000", style = MaterialTheme.typography.bodyLarge)
                    Text("Spent: ₹4,250", style = MaterialTheme.typography.bodyLarge, color = WarningAmber)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text("Remaining: ₹10,750", style = MaterialTheme.typography.titleMedium, color = SuccessGreen, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun AndroidArchitectureTab() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Multiplatform Architecture Diagnostics", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("• Shared Core: com.lifetrack.shared", fontWeight = FontWeight.SemiBold)
                Text("• Target Platform: Android 14 (API 34)", style = MaterialTheme.typography.bodyMedium)
                Text("• UI Framework: Jetpack Compose + Material 3", style = MaterialTheme.typography.bodyMedium)
                Text("• Unidirectional Data Flow: UI → Action → TasksViewModel → UseCase → Repository → DataSource", style = MaterialTheme.typography.bodyMedium)
                Text("• Security Boundary: Android Keystore Hardware-backed TEE", style = MaterialTheme.typography.bodyMedium)
                Text("• Synchronization: Delta Outbox Abstraction (Phase 4 Ready)", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
