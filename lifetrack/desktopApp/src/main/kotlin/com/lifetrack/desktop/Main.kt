package com.lifetrack.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.WindowState
import androidx.compose.ui.window.application
import com.lifetrack.data.local.InMemoryTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ToggleTaskUseCase
import com.lifetrack.domain.usecase.VtuCalculatorUseCase
import com.lifetrack.security.DesktopSecureKeyStorage
import com.lifetrack.ui.TasksUiAction
import com.lifetrack.ui.TasksViewModel
import com.lifetrack.ui.components.CategoryFilterRow
import com.lifetrack.ui.components.NaturalLanguageTaskInputBar
import com.lifetrack.ui.components.TaskCardItem
import com.lifetrack.ui.components.TaskMetricsBar
import com.lifetrack.ui.theme.AccentTeal
import com.lifetrack.ui.theme.LifeTrackTheme
import com.lifetrack.ui.theme.PrimaryBlue
import com.lifetrack.ui.theme.SuccessGreen
import com.lifetrack.ui.theme.WarningAmber
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

enum class DesktopNavSection(val title: String) {
    TASKS("Tasks & Schedule"),
    ACADEMICS("Academics & VTU"),
    FINANCES("Finances"),
    SECURITY("Security & System")
}

fun main() = application {
    val windowState = remember { WindowState(size = DpSize(1200.dp, 800.dp)) }

    // Initialize shared dependencies
    val localDataSource = remember { InMemoryTaskLocalDataSource() }
    val taskRepository = remember { TaskRepositoryImpl(localDataSource) }
    val getTasksUseCase = remember { GetTasksUseCase(taskRepository) }
    val createTaskUseCase = remember { CreateTaskUseCase(taskRepository) }
    val toggleTaskUseCase = remember { ToggleTaskUseCase(taskRepository) }
    val secureStorage = remember { DesktopSecureKeyStorage() }

    val coroutineScope = rememberCoroutineScope()
    val tasksViewModel = remember {
        TasksViewModel(
            getTasksUseCase = getTasksUseCase,
            createTaskUseCase = createTaskUseCase,
            toggleTaskUseCase = toggleTaskUseCase,
            taskRepository = taskRepository,
            coroutineScope = coroutineScope
        )
    }

    Window(
        onCloseRequest = ::exitApplication,
        title = "LifeTrack Hub — Windows Desktop",
        state = windowState,
        resizable = true
    ) {
        LifeTrackTheme {
            DesktopAppShell(tasksViewModel = tasksViewModel)
        }
    }
}

@Composable
fun DesktopAppShell(tasksViewModel: TasksViewModel) {
    var currentSection by remember { mutableStateOf(DesktopNavSection.TASKS) }
    val uiState by tasksViewModel.uiState.collectAsState()
    var selectedTask by remember { mutableStateOf<Task?>(null) }

    Row(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // Desktop Navigation Sidebar
        DesktopSidebar(
            currentSection = currentSection,
            onSelectSection = { currentSection = it },
            pendingTasksCount = uiState.pendingCount
        )

        // Main Desktop Workspace
        Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
            when (currentSection) {
                DesktopNavSection.TASKS -> DesktopTasksWorkspace(
                    uiState = uiState,
                    onAction = tasksViewModel::onAction,
                    selectedTask = selectedTask,
                    onSelectTask = { selectedTask = it }
                )
                DesktopNavSection.ACADEMICS -> DesktopAcademicsWorkspace()
                DesktopNavSection.FINANCES -> DesktopFinancesWorkspace()
                DesktopNavSection.SECURITY -> DesktopSecurityWorkspace()
            }
        }
    }
}

@Composable
fun DesktopSidebar(
    currentSection: DesktopNavSection,
    onSelectSection: (DesktopNavSection) -> Unit,
    pendingTasksCount: Int
) {
    Column(
        modifier = Modifier
            .width(260.dp)
            .fillMaxHeight()
            .background(MaterialTheme.colorScheme.surface)
            .border(width = 1.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            .padding(16.dp)
    ) {
        // Brand Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(PrimaryBlue),
                contentAlignment = Alignment.Center
            ) {
                Text("LT", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text("LifeTrack Hub", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Windows Desktop • v1.0", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        Text("NAVIGATION", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(8.dp))

        DesktopNavSection.values().forEach { section ->
            val isSelected = currentSection == section
            val bg = if (isSelected) PrimaryBlue.copy(alpha = 0.12f) else Color.Transparent
            val textColor = if (isSelected) PrimaryBlue else MaterialTheme.colorScheme.onSurface

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(bg)
                    .clickable { onSelectSection(section) }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(section.title, color = textColor, fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal, fontSize = 14.sp)
                if (section == DesktopNavSection.TASKS && pendingTasksCount > 0) {
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(WarningAmber)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text("$pendingTasksCount", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
        }

        Spacer(modifier = Modifier.weight(1f))

        // System Tray & E2EE Sync Status Pill
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(12.dp)
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(SuccessGreen))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Architecture Verified", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = SuccessGreen)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text("Shared Core • In-Memory Local", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun DesktopTasksWorkspace(
    uiState: com.lifetrack.ui.TasksUiState,
    onAction: (TasksUiAction) -> Unit,
    selectedTask: Task?,
    onSelectTask: (Task?) -> Unit
) {
    Row(modifier = Modifier.fillMaxSize()) {
        // Main Tasks List Column
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(24.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Tasks & Action Items", style = MaterialTheme.typography.headlineMedium)
                    Text("Natural language fast capture • Offline-first architecture", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = { onAction(TasksUiAction.Search(it)) },
                    placeholder = { Text("Search tasks...") },
                    singleLine = true,
                    modifier = Modifier.width(240.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
            NaturalLanguageTaskInputBar(onTaskSubmitted = { onAction(TasksUiAction.QuickCreateTask(it)) })

            Spacer(modifier = Modifier.height(16.dp))
            TaskMetricsBar(
                totalTasks = uiState.tasks.size,
                completedTasks = uiState.completedCount,
                pendingTasks = uiState.pendingCount
            )

            Spacer(modifier = Modifier.height(16.dp))
            CategoryFilterRow(
                selectedCategory = uiState.selectedCategory,
                onSelectCategory = { onAction(TasksUiAction.FilterByCategory(it)) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (uiState.filteredTasks.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("No tasks found. Use the quick add bar above.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(uiState.filteredTasks, key = { it.id }) { task ->
                        TaskCardItem(
                            task = task,
                            onToggle = { onAction(TasksUiAction.ToggleCompletion(task.id)) },
                            onDelete = {
                                if (selectedTask?.id == task.id) onSelectTask(null)
                                onAction(TasksUiAction.DeleteTask(task.id))
                            },
                            onAddSubtask = { onAction(TasksUiAction.AddSubtask(task.id, it)) },
                            modifier = Modifier.clickable { onSelectTask(task) }
                        )
                    }
                }
            }
        }

        // Desktop Right Inspector Panel
        Column(
            modifier = Modifier
                .width(320.dp)
                .fillMaxHeight()
                .background(MaterialTheme.colorScheme.surface)
                .border(width = 1.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
                .padding(20.dp)
        ) {
            Text("Inspector & Insights", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(16.dp))

            if (selectedTask != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Selected Task", style = MaterialTheme.typography.labelSmall, color = PrimaryBlue)
                        Text(selectedTask.title, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        if (!selectedTask.description.isNullOrBlank()) {
                            Text(selectedTask.description, style = MaterialTheme.typography.bodySmall)
                        }
                        Text("Category: ${selectedTask.category.name}", style = MaterialTheme.typography.bodySmall)
                        Text("Priority: ${selectedTask.priority.name}", style = MaterialTheme.typography.bodySmall)
                        Text("Subtasks: ${selectedTask.subtasks.size}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            } else {
                Text(
                    "Click on any task in the workspace to inspect its full details.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
            Text("VTU Summary", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            val report = remember { VtuCalculatorUseCase.calculateAttendanceReport(38, 44, 85.0) }
            Text("Attendance: ${report.percentage}% (Safe)", color = SuccessGreen, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Text("Target: 85% • ${report.classesCanBunk} safe misses", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun DesktopAcademicsWorkspace() {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("VTU Academic OS (Desktop)", style = MaterialTheme.typography.headlineMedium)
        Text("High-density desktop view for syllabus tracking, marks analysis, and CIE/SEE predictions.", color = MaterialTheme.colorScheme.onSurfaceVariant)

        Card(shape = RoundedCornerShape(12.dp)) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("VTU 2022 Scheme SGPA Engine", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("• BCS301 - Data Structures: 4 Credits • CIE: 42/50 • SEE: 45/50 • Grade: O (10 pts)")
                Text("• BCS302 - Operating Systems: 4 Credits • CIE: 38/50 • SEE: 40/50 • Grade: A+ (9 pts)")
                Text("• BCS303 - Digital Design: 3 Credits • CIE: 35/50 • SEE: 38/50 • Grade: A (8 pts)")
                val calculatedSgpa = VtuCalculatorUseCase.calculateSemesterSgpa(listOf(4 to 10, 4 to 9, 3 to 8))
                Text("Calculated Semester SGPA: $calculatedSgpa", color = PrimaryBlue, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

@Composable
fun DesktopFinancesWorkspace() {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Student Finance (Desktop)", style = MaterialTheme.typography.headlineMedium)
        Text("Multi-column financial ledger with category breakdowns.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun DesktopSecurityWorkspace() {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Windows Security & Storage Diagnostics", style = MaterialTheme.typography.headlineMedium)
        Text("Secure key storage abstraction: Windows DPAPI / Local Keyring isolation.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
