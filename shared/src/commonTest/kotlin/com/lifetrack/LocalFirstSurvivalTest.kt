package com.lifetrack

import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.StandardSyncEventIdGenerator
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.TaskDatabaseSchema
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.sync.PersistentSyncRepository
import com.lifetrack.sync.RemoteSyncTransport
import com.lifetrack.sync.SyncEngineImpl
import com.lifetrack.sync.SyncRecord
import com.lifetrack.sync.SyncState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class LocalFirstSurvivalTest {

    private val timeProvider = TestTimeProvider(1720000000000L)

    @Test
    fun testNetworkFailureRetainsLocalDataAndOutboxBecomesRetryable() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeLocalFirst", timeProvider)
        val idGen = StandardSyncEventIdGenerator()

        val taskRepo = TaskRepositoryImpl(
            localDataSource = localDataSource,
            timeProvider = timeProvider,
            syncRepository = syncRepo,
            hlcClock = hlcClock,
            syncEventIdGenerator = idGen
        )

        // 1. Create task locally while offline
        val localTask = taskRepo.saveTask(
            Task(id = "offline-task-1", title = "Offline Study Notes", category = TaskCategory.PERSONAL)
        )
        assertNotNull(localTask)
        assertTrue(localTask.isSyncPending)

        // Outbox contains 1 PENDING record
        val pendingOutbox = syncRepo.getPendingOutboxRecords().first()
        assertEquals(1, pendingOutbox.size)
        assertEquals("PENDING", pendingOutbox[0].status)

        // 2. Transport that simulates network failure
        val failingTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                throw java.io.IOException("503 Service Unavailable: No internet connectivity")
            }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> = emptyList()
        }

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = failingTransport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeLocalFirst"
        )

        // 3. Trigger sync -> network failure occurs
        syncEngine.triggerSync()

        // 4. Invariant checks:
        // Local task is NEVER lost or deleted
        val savedTask = localDataSource.getTaskById("offline-task-1")
        assertNotNull(savedTask)
        assertEquals("Offline Study Notes", savedTask.title)

        // Sync status is ERROR
        val status = syncEngine.syncStatus.value
        assertEquals(SyncState.ERROR, status.state)

        // Record status is marked FAILED with backoff, NOT lost
        val allRecords = syncRepo.getAllRecords()
        assertEquals(1, allRecords.size)
        assertEquals("FAILED", allRecords[0].status)
        assertEquals(1, allRecords[0].retryCount)
        assertTrue(allRecords[0].nextRetryAt > timeProvider.nowEpochMs())

        // 5. Simulate backoff time elapse
        timeProvider.advance(10_000L)
        val eligibleForRetry = syncRepo.getEligibleOutboxRecords(timeProvider.nowEpochMs())
        assertEquals(1, eligibleForRetry.size, "Failed record must become eligible for retry after backoff")
    }

    @Test
    fun testCrashWhileInFlightLeaseRecovery() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)

        // Enqueue a record
        val rec = SyncRecord(
            id = "evt_lease_1",
            entityType = "TASK",
            entityId = "task_crash_1",
            operation = "UPSERT",
            payload = "{}",
            hlcTimestamp = "1720000000000:0:nodeA",
            createdAt = 1720000000000L
        )
        syncRepo.enqueueRecord(rec)

        // Mark in-flight
        syncRepo.markInFlight(listOf("evt_lease_1"), inFlightTimeMs = timeProvider.nowEpochMs())

        // Advance past lease timeout (60s)
        timeProvider.advance(70_000L)

        // Recover stale in-flight records
        syncRepo.recoverStaleInFlightRecords(leaseTimeoutMs = 60_000L, currentTimeMs = timeProvider.nowEpochMs())

        // Record must be recovered back to PENDING
        val recovered = syncRepo.getAllRecords().first { it.id == "evt_lease_1" }
        assertEquals("PENDING", recovered.status)
        assertEquals(null, recovered.inFlightAt)
    }
}
