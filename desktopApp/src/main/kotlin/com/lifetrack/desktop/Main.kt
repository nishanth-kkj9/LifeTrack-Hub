package com.lifetrack.desktop

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import com.lifetrack.core.PlatformIdGenerator
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.data.local.createDesktopTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.usecase.AddSubtaskUseCase
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.DeleteSubtaskUseCase
import com.lifetrack.domain.usecase.DeleteTaskUseCase
import com.lifetrack.domain.usecase.GetTaskMetricsUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import com.lifetrack.domain.usecase.ToggleSubtaskUseCase
import com.lifetrack.domain.usecase.ToggleTaskCompletionUseCase
import com.lifetrack.security.DesktopSecureKeyStorage
import com.lifetrack.ui.TasksViewModel
import com.lifetrack.ui.components.CategoryFilterRow
import com.lifetrack.ui.components.NaturalLanguageTaskInputBar
import com.lifetrack.ui.components.TaskCardItem
import com.lifetrack.ui.components.TaskMetricsBar
import com.lifetrack.ui.theme.LifeTrackEmeraldPrimary
import com.lifetrack.ui.theme.LifeTrackTheme

fun main() = application {
    val timeProvider = remember { SystemTimeProvider() }
    val idGenerator = remember { PlatformIdGenerator(timeProvider) }
    val secureStorage = remember { DesktopSecureKeyStorage() }
    val localDataSource = remember { createDesktopTaskLocalDataSource(timeProvider = timeProvider) }
    val taskRepository = remember { TaskRepositoryImpl(localDataSource, timeProvider) }

    val viewModel = remember {
        TasksViewModel(
            getTasksUseCase = GetTasksUseCase(taskRepository),
            createTaskUseCase = CreateTaskUseCase(taskRepository, timeProvider, idGenerator),
            toggleTaskCompletionUseCase = ToggleTaskCompletionUseCase(taskRepository),
            deleteTaskUseCase = DeleteTaskUseCase(taskRepository),
            addSubtaskUseCase = AddSubtaskUseCase(taskRepository, idGenerator, timeProvider),
            toggleSubtaskUseCase = ToggleSubtaskUseCase(taskRepository),
            deleteSubtaskUseCase = DeleteSubtaskUseCase(taskRepository),
            getTaskMetricsUseCase = GetTaskMetricsUseCase(taskRepository),
            parseNaturalLanguageTaskUseCase = ParseNaturalLanguageTaskUseCase()
        )
    }

    Window(
        onCloseRequest = ::exitApplication,
        title = "LifeTrack Hub - Windows Desktop Edition",
        state = rememberWindowState(width = 1100.dp, height = 750.dp)
    ) {
        LifeTrackTheme {
            DesktopAppShell(viewModel)
        }
    }
}

@Composable
fun DesktopAppShell(viewModel: TasksViewModel) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedSection by remember { mutableStateOf("Tasks") }

    Row(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // Desktop Left Navigation Rail
        Column(
            modifier = Modifier
                .width(240.dp)
                .fillMaxHeight()
                .background(Color(0xFF0F172A))
                .padding(20.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF0F766E)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("LT", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text("LifeTrack Hub", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text("Windows Native", color = Color(0xFF94A3B8), fontSize = 11.sp)
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            val sections = listOf("Tasks", "VTU Academics", "Finances & Ledger", "Security & Vault", "Sync Engine")
            sections.forEach { section ->
                val isSelected = section == selectedSection
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { selectedSection = section }
                        .background(if (isSelected) Color(0xFF1E293B) else Color.Transparent)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(if (isSelected) Color(0xFF2DD4BF) else Color(0xFF475569))
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = section,
                        color = if (isSelected) Color.White else Color(0xFF94A3B8),
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        fontSize = 13.sp
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
            }

            Spacer(modifier = Modifier.weight(1f))

            Surface(
                color = Color(0xFF1E293B),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Phase 1B: Architecture Foundation", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Text("In-Memory Verification Engine", color = Color(0xFF94A3B8), fontSize = 10.sp)
                }
            }
        }

        // Divider
        Divider(
            modifier = Modifier.fillMaxHeight().width(1.dp),
            color = Color(0xFFE2E8F0)
        )

        // Main Desktop Workspace
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(28.dp)
        ) {
            if (selectedSection == "Tasks") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Tasks & Productivity",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Unidirectional Flow: Desktop Compose -> ViewModel -> UseCase -> Repository",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                TaskMetricsBar(metrics = uiState.metrics)

                Spacer(modifier = Modifier.height(16.dp))

                NaturalLanguageTaskInputBar(
                    value = uiState.naturalLanguageInput,
                    onValueChange = viewModel::onNaturalLanguageInputChanged,
                    onSubmit = { viewModel.submitNaturalLanguageTask() }
                )

                Spacer(modifier = Modifier.height(16.dp))

                CategoryFilterRow(
                    selectedCategory = uiState.filterState.selectedCategory,
                    onSelectCategory = viewModel::onCategorySelected
                )

                Spacer(modifier = Modifier.height(16.dp))

                if (uiState.isLoading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = LifeTrackEmeraldPrimary)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(uiState.tasks, key = { it.id }) { task ->
                            TaskCardItem(
                                task = task,
                                onToggle = { viewModel.toggleTaskCompletion(task.id) },
                                onDelete = { viewModel.deleteTask(task.id) },
                                onToggleSubtask = { subtaskId -> viewModel.toggleSubtask(task.id, subtaskId) }
                            )
                        }
                    }
                }
            } else {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "$selectedSection Workspace",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Phase 1B: Architecture Foundation (In-Memory Verification Engine)",
                            color = Color.Gray
                        )
                    }
                }
            }
        }
    }
}
