package com.lifetrack.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetrack.ui.TasksViewModel
import com.lifetrack.ui.components.CategoryFilterRow
import com.lifetrack.ui.components.NaturalLanguageTaskInputBar
import com.lifetrack.ui.components.TaskCardItem
import com.lifetrack.ui.components.TaskMetricsBar
import com.lifetrack.ui.theme.LifeTrackEmeraldPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AndroidMainScreen(
    viewModel: TasksViewModel
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var selectedNavIndex by remember { mutableIntStateOf(0) }

    LaunchedEffect(uiState.userFeedbackMessage) {
        uiState.userFeedbackMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearFeedbackMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "LifeTrack Hub",
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Text(
                            text = "Android Production Core • Phase 1B Architecture",
                            fontSize = 11.sp,
                            color = Color(0xFF64748B)
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
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp
            ) {
                val navItems = listOf("Tasks", "Academics", "Finances", "System")
                navItems.forEachIndexed { index, title ->
                    NavigationBarItem(
                        selected = selectedNavIndex == index,
                        onClick = { selectedNavIndex = index },
                        label = { Text(title, fontSize = 11.sp) },
                        icon = {
                            Text(
                                text = when (index) {
                                    0 -> "✓"
                                    1 -> "🎓"
                                    2 -> "₹"
                                    else -> "⚙"
                                },
                                fontWeight = FontWeight.Bold
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = LifeTrackEmeraldPrimary,
                            selectedTextColor = LifeTrackEmeraldPrimary,
                            indicatorColor = Color(0xFFCCFBF1)
                        )
                    )
                }
            }
        }
    ) { paddingValues ->
        if (selectedNavIndex == 0) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                TaskMetricsBar(metrics = uiState.metrics)

                Spacer(modifier = Modifier.height(12.dp))

                NaturalLanguageTaskInputBar(
                    value = uiState.naturalLanguageInput,
                    onValueChange = viewModel::onNaturalLanguageInputChanged,
                    onSubmit = { viewModel.submitNaturalLanguageTask() }
                )

                Spacer(modifier = Modifier.height(12.dp))

                CategoryFilterRow(
                    selectedCategory = uiState.filterState.selectedCategory,
                    onSelectCategory = viewModel::onCategorySelected
                )

                Spacer(modifier = Modifier.height(12.dp))

                if (uiState.isLoading) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = LifeTrackEmeraldPrimary)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 16.dp)
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
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = when (selectedNavIndex) {
                            1 -> "VTU Academic Module"
                            2 -> "Finance & Ledger Tracker"
                            else -> "Hardware Vault & Sync Status"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Phase 1B: Architecture Foundation (In-Memory Verification Engine)",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
            }
        }
    }
}
