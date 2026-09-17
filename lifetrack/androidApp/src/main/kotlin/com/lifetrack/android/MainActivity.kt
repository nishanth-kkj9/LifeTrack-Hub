package com.lifetrack.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.lifecycleScope
import com.lifetrack.android.ui.AndroidMainScreen
import com.lifetrack.ui.TasksViewModel
import com.lifetrack.ui.theme.LifeTrackTheme

class MainActivity : ComponentActivity() {

    private lateinit var tasksViewModel: TasksViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val app = application as LifeTrackApp
        tasksViewModel = TasksViewModel(
            getTasksUseCase = app.getTasksUseCase,
            createTaskUseCase = app.createTaskUseCase,
            toggleTaskUseCase = app.toggleTaskUseCase,
            taskRepository = app.taskRepository,
            coroutineScope = lifecycleScope
        )

        setContent {
            LifeTrackTheme {
                AndroidMainScreen(tasksViewModel = tasksViewModel)
            }
        }
    }
}
