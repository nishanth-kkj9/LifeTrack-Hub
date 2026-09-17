package com.lifetrack.android

import android.app.Application
import com.lifetrack.core.PlatformIdGenerator
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.data.local.createAndroidTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.repository.TaskRepository
import com.lifetrack.domain.usecase.AddSubtaskUseCase
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.DeleteSubtaskUseCase
import com.lifetrack.domain.usecase.DeleteTaskUseCase
import com.lifetrack.domain.usecase.GetTaskMetricsUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import com.lifetrack.domain.usecase.ToggleSubtaskUseCase
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

        val timeProvider = SystemTimeProvider()
        val idGenerator = PlatformIdGenerator(timeProvider)

        secureKeyStorage = AndroidSecureKeyStorage()
        val localDataSource = createAndroidTaskLocalDataSource(this, timeProvider = timeProvider)
        taskRepository = TaskRepositoryImpl(localDataSource, timeProvider)

        val getTasksUseCase = GetTasksUseCase(taskRepository)
        val createTaskUseCase = CreateTaskUseCase(taskRepository, timeProvider, idGenerator)
        val toggleTaskCompletionUseCase = ToggleTaskCompletionUseCase(taskRepository)
        val deleteTaskUseCase = DeleteTaskUseCase(taskRepository)
        val addSubtaskUseCase = AddSubtaskUseCase(taskRepository, idGenerator, timeProvider)
        val toggleSubtaskUseCase = ToggleSubtaskUseCase(taskRepository)
        val deleteSubtaskUseCase = DeleteSubtaskUseCase(taskRepository)
        val getTaskMetricsUseCase = GetTaskMetricsUseCase(taskRepository)
        val parseNaturalLanguageTaskUseCase = ParseNaturalLanguageTaskUseCase()

        tasksViewModel = TasksViewModel(
            getTasksUseCase = getTasksUseCase,
            createTaskUseCase = createTaskUseCase,
            toggleTaskCompletionUseCase = toggleTaskCompletionUseCase,
            deleteTaskUseCase = deleteTaskUseCase,
            addSubtaskUseCase = addSubtaskUseCase,
            toggleSubtaskUseCase = toggleSubtaskUseCase,
            deleteSubtaskUseCase = deleteSubtaskUseCase,
            getTaskMetricsUseCase = getTaskMetricsUseCase,
            parseNaturalLanguageTaskUseCase = parseNaturalLanguageTaskUseCase
        )
    }

    companion object {
        lateinit var instance: LifeTrackApp
            private set
    }
}
