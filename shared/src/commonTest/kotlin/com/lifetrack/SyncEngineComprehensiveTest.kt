package com.lifetrack

import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.StandardSyncEventIdGenerator
import com.lifetrack.core.TestIdGenerator
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema
import com.lifetrack.data.repository.TaskPayloadSerializer
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.sync.DefaultMockRemoteTransport
import com.lifetrack.sync.PersistentSyncRepository
import com.lifetrack.sync.RemoteSyncTransport
import com.lifetrack.sync.SyncEngineImpl
import com.lifetrack.sync.SyncRecord
import com.lifetrack.sync.SyncState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SyncEngineComprehensiveTest {

    private val timeProvider = TestTimeProvider(1720000000000L)

    @Test
    fun testHlcClockMonotonicOrdering() {
        val clock = StandardHlcClock("nodeA", timeProvider)

        // Multiple calls in same millisecond increment logical counter
        val t1 = clock.now()
        val t2 = clock.now()
        val t3 = clock.now()

        assertEquals(1720000000000L, t1.physicalTimeMs)
        assertEquals(0, t1.logicalCounter)
        assertEquals(1, t2.logicalCounter)
        assertEquals(2, t3.logicalCounter)
        assertTrue(t2 > t1)
        assertTrue(t3 > t2)

        // Advancing physical time resets logical counter to 0
        timeProvider.advance(1000L)
        val t4 = clock.now()
        assertEquals(1720000001000L, t4.physicalTimeMs)
        assertEquals(0, t4.logicalCounter)
        assertTrue(t4 > t3)
    }

    @Test
    fun testHlcClockReceiveMergeLogic() {
        val clock = StandardHlcClock("nodeA", timeProvider)

        // Local at 1720000000000:0:nodeA
        clock.now()

        // Receive remote timestamp from the future: 1720000005000:3:nodeB
        val remoteFuture = HlcTimestamp(1720000005000L, 3, "nodeB")
        val merged1 = clock.receive(remoteFuture)

        // Must advance physical to 1720000005000 and logical to 4
        assertEquals(1720000005000L, merged1.physicalTimeMs)
        assertEquals(4, merged1.logicalCounter)
        assertEquals("nodeA", merged1.nodeId)
        assertTrue(merged1 > remoteFuture)

        // Subsequent local event in the same physical tick continues incrementing
        val nextLocal = clock.now()
        assertEquals(1720000005000L, nextLocal.physicalTimeMs)
        assertEquals(5, nextLocal.logicalCounter)
    }

    @Test
    fun testSyncEventIdUniqueness() {
        val idGen = StandardSyncEventIdGenerator()
        val hlc = HlcTimestamp(1720000000000L, 0, "nodeA")

        val id1 = idGen.generateEventId("task-1", hlc)
        val id2 = idGen.generateEventId("task-1", hlc)
        val id3 = idGen.generateEventId("task-1", hlc.copy(logicalCounter = 1))

        assertTrue(id1.isNotBlank())
        assertTrue(id2.isNotBlank())
        assertTrue(id1 != id2, "Two distinct events must never share the same event ID")
        assertTrue(id1 != id3)
        assertTrue(id1.startsWith("evt_1720000000000_0_nodeA_"))
    }

    @Test
    fun testAtomicTaskOutboxTransactionSuccessAndRollback() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)

        val task = Task(
            id = "t-atomic-1",
            title = "Compiler Design Lab",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.HIGH,
            status = TaskStatus.TODO
        )
        val event = SyncRecord(
            id = "evt-atomic-1",
            entityType = "TASK",
            entityId = "t-atomic-1",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeTask(task),
            hlcTimestamp = "1720000000000:0:nodeA",
            createdAt = 1720000000000L
        )

        // 1. Successful atomic execution
        localDataSource.upsertTaskAtomic(task, event)

        val savedTask = localDataSource.getTaskById("t-atomic-1")
        assertNotNull(savedTask)
        val pendingEvents = syncRepo.getPendingOutboxRecords().first()
        assertEquals(1, pendingEvents.size)
        assertEquals("evt-atomic-1", pendingEvents[0].id)

        // 2. Transaction rollback verification
        var thrown = false
        try {
            driver.transaction {
                driver.execute(
                    "UPDATE tasks SET title = ? WHERE id = ?;",
                    arrayOf("Title modified inside failing tx", "t-atomic-1")
                )
                driver.execute(
                    "INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload, hlc_timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
                    arrayOf("evt-failing", "TASK", "t-atomic-1", "UPSERT", "fail", "1720000000000:1:nodeA", 1720000000000L)
                )
                throw IllegalStateException("Simulated hardware crash during write")
            }
        } catch (_: IllegalStateException) {
            thrown = true
        }

        assertTrue(thrown)
        // Entity title and outbox should both be rolled back!
        val rolledBackTask = localDataSource.getTaskById("t-atomic-1")
        assertEquals("Compiler Design Lab", rolledBackTask?.title)
        val outboxAfterRollback = syncRepo.getPendingOutboxRecords().first()
        assertEquals(1, outboxAfterRollback.size)
        assertEquals("evt-atomic-1", outboxAfterRollback[0].id)
    }

    @Test
    fun testInFlightRecovery() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val syncRepo = PersistentSyncRepository(driver)

        val record = SyncRecord(
            id = "evt-inflight-1",
            entityType = "TASK",
            entityId = "task-1",
            operation = "UPSERT",
            payload = "payload",
            hlcTimestamp = "1720000000000:0:nodeA",
            createdAt = 1720000000000L
        )
        syncRepo.enqueueRecord(record)

        // Mark in flight at t = 1000
        syncRepo.markInFlight(listOf("evt-inflight-1"), inFlightTimeMs = 1000L)
        val recordsInFlight = syncRepo.getAllRecords()
        assertEquals("IN_FLIGHT", recordsInFlight[0].status)

        // Before lease expiration (e.g. at t = 30000 with 60000 lease), it is not recovered
        syncRepo.recoverStaleInFlightRecords(leaseTimeoutMs = 60_000L, currentTimeMs = 30_000L)
        assertEquals("IN_FLIGHT", syncRepo.getAllRecords()[0].status)

        // After lease expiration (e.g. at t = 70000 with 60000 lease), it recovers to PENDING
        syncRepo.recoverStaleInFlightRecords(leaseTimeoutMs = 60_000L, currentTimeMs = 70_000L)
        val recovered = syncRepo.getAllRecords()
        assertEquals("PENDING", recovered[0].status)
    }

    @Test
    fun testRetryBackoffAndFailurePolicy() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val syncRepo = PersistentSyncRepository(driver)

        val record = SyncRecord(
            id = "evt-retry-1",
            entityType = "TASK",
            entityId = "task-1",
            operation = "UPSERT",
            payload = "payload",
            hlcTimestamp = "1720000000000:0:nodeA",
            createdAt = 1720000000000L
        )
        syncRepo.enqueueRecord(record)

        // Attempt 1 failure at t = 1000
        syncRepo.recordFailures(listOf("evt-retry-1"), "Network 503", currentTimeMs = 1000L, maxRetries = 3)
        var row = syncRepo.getAllRecords()[0]
        assertEquals(1, row.retryCount)
        assertEquals("PENDING", row.status)
        assertEquals(2000L, row.nextRetryAt) // 1000 + 1000ms delay

        // Attempt 2 failure at t = 2000
        syncRepo.recordFailures(listOf("evt-retry-1"), "Network 503", currentTimeMs = 2000L, maxRetries = 3)
        row = syncRepo.getAllRecords()[0]
        assertEquals(2, row.retryCount)
        assertEquals("PENDING", row.status)
        assertEquals(4000L, row.nextRetryAt) // 2000 + 2000ms delay

        // Attempt 3 failure -> reaches maxRetries (3) -> transitions to FAILED
        syncRepo.recordFailures(listOf("evt-retry-1"), "Network 503", currentTimeMs = 4000L, maxRetries = 3)
        row = syncRepo.getAllRecords()[0]
        assertEquals(3, row.retryCount)
        assertEquals("FAILED", row.status)
    }

    @Test
    fun testFailedRecordRequeue() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val syncRepo = PersistentSyncRepository(driver)

        val record = SyncRecord(
            id = "evt-failed-1",
            entityType = "TASK",
            entityId = "task-1",
            operation = "UPSERT",
            payload = "payload",
            hlcTimestamp = "1720000000000:0:nodeA",
            createdAt = 1720000000000L
        )
        syncRepo.enqueueRecord(record)
        syncRepo.recordFailures(listOf("evt-failed-1"), "Permanent error", 1000L, maxRetries = 1)
        assertEquals("FAILED", syncRepo.getAllRecords()[0].status)

        // Controlled requeue of single failed record
        syncRepo.retryFailedRecord("evt-failed-1")
        val requeued = syncRepo.getAllRecords()[0]
        assertEquals("PENDING", requeued.status)
        assertEquals(0, requeued.retryCount)
        assertEquals(0L, requeued.nextRetryAt)
        assertNull(requeued.lastError)
    }

    @Test
    fun testNeverLeaveFailedNetworkRequestsStuckInFlight() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeA", timeProvider)

        val failingTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                throw RuntimeException("SocketTimeoutException: Connection aborted")
            }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> = emptyList()
        }

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = failingTransport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeA"
        )

        syncRepo.enqueueRecord(
            SyncRecord(
                id = "evt-net-fail",
                entityType = "TASK",
                entityId = "task-1",
                operation = "UPSERT",
                payload = "payload",
                hlcTimestamp = "1720000000000:0:nodeA",
                createdAt = 1720000000000L
            )
        )

        // Trigger sync with failing network
        syncEngine.triggerSync()

        // Engine reports error
        assertEquals(SyncState.ERROR, syncEngine.syncStatus.value.state)

        // Invariant: record MUST NOT be stuck in IN_FLIGHT
        val record = syncRepo.getAllRecords()[0]
        assertTrue(record.status != "IN_FLIGHT", "Failed network request must never strand records in IN_FLIGHT")
        assertEquals("PENDING", record.status)
        assertEquals(1, record.retryCount)
        assertTrue(record.lastError?.contains("SocketTimeoutException") == true)
    }

    @Test
    fun testBidirectionalRemotePullAndApplication() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeA", timeProvider)

        val remoteTask = Task(
            id = "remote-task-1",
            title = "Digital Signal Processing Assignment",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.URGENT,
            status = TaskStatus.TODO,
            createdAtEpochMs = 1720000000000L,
            updatedAtEpochMs = 1720000000000L
        )

        val mockTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> = records.map { it.id }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
                return listOf(
                    SyncRecord(
                        id = "rem-evt-1",
                        entityType = "TASK",
                        entityId = "remote-task-1",
                        operation = "UPSERT",
                        payload = TaskPayloadSerializer.serializeTask(remoteTask),
                        hlcTimestamp = "1720000005000:0:remoteNode",
                        createdAt = 1720000005000L
                    )
                )
            }
        }

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = mockTransport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeA"
        )

        syncEngine.triggerSync()

        // Verify remote task was applied to local database
        val applied = localDataSource.getTaskById("remote-task-1")
        assertNotNull(applied)
        assertEquals("Digital Signal Processing Assignment", applied.title)
        assertFalse(applied.isSyncPending, "Remote pulled entity must not be marked pending sync")

        // Checkpoint advanced
        val checkpoint = syncRepo.getSyncCheckpoint("nodeA")
        assertEquals("1720000005000:0:remoteNode", checkpoint)
    }

    @Test
    fun testConflictResolutionAndTombstoneRetention() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeA", timeProvider)

        // Local task deleted at HLC 1720000010000:0:nodeA
        val localTask = Task(
            id = "task-tombstone-1",
            title = "Task To Delete",
            category = TaskCategory.PERSONAL,
            isDeleted = true
        )
        localDataSource.upsertTaskAtomic(
            localTask,
            SyncRecord(
                id = "evt-del-1",
                entityType = "TASK",
                entityId = "task-tombstone-1",
                operation = "DELETE",
                payload = "task-tombstone-1",
                hlcTimestamp = "1720000010000:0:nodeA",
                createdAt = 1720000010000L
            )
        )

        // Incoming remote stale edit with older HLC 1720000005000:0:nodeB
        val staleRemoteTask = localTask.copy(title = "Stale Edit Resurrect Attempt", isDeleted = false)
        val staleRecord = SyncRecord(
            id = "evt-stale-remote",
            entityType = "TASK",
            entityId = "task-tombstone-1",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeTask(staleRemoteTask),
            hlcTimestamp = "1720000005000:0:nodeB",
            createdAt = 1720000005000L
        )

        val mockTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> = records.map { it.id }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> = listOf(staleRecord)
        }

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = mockTransport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeA"
        )

        syncEngine.triggerSync()

        // Local tombstone wins! Task must NOT be resurrected!
        val nonDeleted = localDataSource.observeTasks().first()
        assertTrue(nonDeleted.none { it.id == "task-tombstone-1" }, "Stale remote update must not resurrect deleted task")
        val meta = localDataSource.getEntitySyncMetadata("TASK", "task-tombstone-1")
        assertTrue(meta?.isDeleted == true)
    }

    @Test
    fun testAcknowledgmentClearsSyncPending() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeA", timeProvider)

        val taskRepo = TaskRepositoryImpl(
            localDataSource = localDataSource,
            timeProvider = timeProvider,
            syncRepository = syncRepo,
            hlcClock = hlcClock
        )

        val created = taskRepo.saveTask(
            Task(
                id = "task-ack-test",
                title = "Verify Sync Pending Clearing",
                category = TaskCategory.PROJECT
            )
        )
        assertTrue(created.isSyncPending)

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = DefaultMockRemoteTransport(),
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeA"
        )

        // Trigger sync
        syncEngine.triggerSync()

        // After successful remote ACK, isSyncPending on local task MUST be cleared to false
        val afterSync = localDataSource.getTaskById("task-ack-test")
        assertNotNull(afterSync)
        assertFalse(afterSync.isSyncPending, "Task.isSyncPending must be cleared to false upon remote acknowledgment")
        assertEquals(0, syncRepo.getPendingOutboxRecords().first().size)
    }
}
