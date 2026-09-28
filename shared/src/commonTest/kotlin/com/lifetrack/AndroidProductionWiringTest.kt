package com.lifetrack

import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.StandardSyncEventIdGenerator
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.sync.PersistentSyncRepository
import com.lifetrack.sync.SyncEngineImpl
import kotlin.test.Test
import kotlin.test.assertNotNull

class AndroidProductionWiringTest {

    @Test
    fun testProductionDependencyGraphWiringIntegrity() {
        val timeProvider = TestTimeProvider()
        val driver = MemorySqlDriver()
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("android-test-node", timeProvider)
        val idGen = StandardSyncEventIdGenerator()

        val taskRepository = TaskRepositoryImpl(
            localDataSource = localDataSource,
            timeProvider = timeProvider,
            syncRepository = syncRepo,
            hlcClock = hlcClock,
            syncEventIdGenerator = idGen
        )

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "android-test-node",
            deviceName = "Android Test Device"
        )

        assertNotNull(taskRepository)
        assertNotNull(syncEngine)
        assertNotNull(syncEngine.syncStatus.value)
    }
}
