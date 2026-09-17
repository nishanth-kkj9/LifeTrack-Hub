package com.lifetrack.android

import android.app.Application
import com.lifetrack.data.local.InMemoryTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.repository.TaskRepository
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ToggleTaskUseCase
import com.lifetrack.security.AndroidSecureKeyStorage
import com.lifetrack.security.SecureKeyStorage

class LifeTrackApp : Application() {

    lateinit var taskRepository: TaskRepository
        private set

    lateinit var getTasksUseCase: GetTasksUseCase
        private set

    lateinit var createTaskUseCase: CreateTaskUseCase
        private set

    lateinit var toggleTaskUseCase: ToggleTaskUseCase
        private set

    lateinit var secureKeyStorage: SecureKeyStorage
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize shared architecture dependencies
        val localDataSource = InMemoryTaskLocalDataSource()
        taskRepository = TaskRepositoryImpl(localDataSource)
        getTasksUseCase = GetTasksUseCase(taskRepository)
        createTaskUseCase = CreateTaskUseCase(taskRepository)
        toggleTaskUseCase = ToggleTaskUseCase(taskRepository)
        secureKeyStorage = AndroidSecureKeyStorage()
    }

    companion object {
        lateinit var instance: LifeTrackApp
            private set
    }
}
