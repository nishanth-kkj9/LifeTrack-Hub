package com.lifetrack.android

import android.app.Application
import com.lifetrack.core.PlatformIdGenerator
import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.StandardSyncEventIdGenerator
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.data.local.AndroidSqlDriver
import com.lifetrack.data.local.PersistentTaskLocalDataSource
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
import com.lifetrack.sync.PersistentSyncRepository
import com.lifetrack.sync.SyncEngine
import com.lifetrack.sync.SyncEngineImpl
import com.lifetrack.sync.SyncRepository
import com.lifetrack.ui.TasksViewModel

class LifeTrackApp : Application() {

    lateinit var secureKeyStorage: SecureKeyStorage
        private set

    lateinit var taskRepository: TaskRepository
        private set

    lateinit var syncRepository: SyncRepository
        private set

    lateinit var syncEngine: SyncEngine
        private set

    lateinit var tasksViewModel: TasksViewModel
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        val timeProvider = SystemTimeProvider()
        val idGenerator = PlatformIdGenerator(timeProvider)

        secureKeyStorage = AndroidSecureKeyStorage()

        // Single coherent local SQLite driver
        val driver = AndroidSqlDriver(this)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider)
        val syncRepo = PersistentSyncRepository(driver)

        val deviceIdentityProvider = com.lifetrack.core.PersistentDeviceIdentityProvider(driver, "android", idGenerator)
        val deviceId = deviceIdentityProvider.getDeviceId()

        val hlcPersistence = com.lifetrack.core.SqliteHlcPersistence(driver, deviceId)
        val hlcClock = StandardHlcClock(deviceId, timeProvider, persistence = hlcPersistence)
        val syncEventIdGenerator = StandardSyncEventIdGenerator(idGenerator)

        taskRepository = TaskRepositoryImpl(
            localDataSource = localDataSource,
            timeProvider = timeProvider,
            syncRepository = syncRepo,
            hlcClock = hlcClock,
            syncEventIdGenerator = syncEventIdGenerator
        )

        syncRepository = syncRepo
        syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = deviceId,
            deviceName = "Android Device"
        )

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
