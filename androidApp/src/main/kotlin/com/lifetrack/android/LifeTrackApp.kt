package com.lifetrack.android

import android.app.Application
import com.lifetrack.data.local.InMemoryTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.repository.TaskRepository
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.DeleteTaskUseCase
import com.lifetrack.domain.usecase.GetTaskMetricsUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import com.lifetrack.domain.usecase.ToggleTaskCompletionUseCase
import com.lifetrack.security.AndroidSecureKeyStorage
import com.lifetrack.security.SecureKeyStorage
import com.lifetrack.ui.TasksViewModel

class LifeTrackApp : Application() {

    lateinit var secureKeyStorage: SecureKeyStorage
        private set

    lateinit var taskRepository: TaskRepository
        private set

    lateinit var tasksViewModel: TasksViewModel
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        secureKeyStorage = AndroidSecureKeyStorage(this)
        val localDataSource = InMemoryTaskLocalDataSource()
        taskRepository = TaskRepositoryImpl(localDataSource)

        val getTasksUseCase = GetTasksUseCase(taskRepository)
        val createTaskUseCase = CreateTaskUseCase(taskRepository)
        val toggleTaskCompletionUseCase = ToggleTaskCompletionUseCase(taskRepository)
        val deleteTaskUseCase = DeleteTaskUseCase(taskRepository)
        val getTaskMetricsUseCase = GetTaskMetricsUseCase(taskRepository)
        val parseNaturalLanguageTaskUseCase = ParseNaturalLanguageTaskUseCase()

        tasksViewModel = TasksViewModel(
            getTasksUseCase = getTasksUseCase,
            createTaskUseCase = createTaskUseCase,
            toggleTaskCompletionUseCase = toggleTaskCompletionUseCase,
            deleteTaskUseCase = deleteTaskUseCase,
            getTaskMetricsUseCase = getTaskMetricsUseCase,
            parseNaturalLanguageTaskUseCase = parseNaturalLanguageTaskUseCase
        )
    }

    companion object {
        lateinit var instance: LifeTrackApp
            private set
    }
}
