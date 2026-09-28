package com.lifetrack

import com.lifetrack.core.DeviceIdentityProvider
import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.PersistentDeviceIdentityProvider
import com.lifetrack.core.SqliteHlcPersistence
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
import com.lifetrack.sync.AuthSessionProvider
import com.lifetrack.sync.DefaultMockRemoteTransport
import com.lifetrack.sync.FirestoreRemoteSyncTransport
import com.lifetrack.sync.InMemoryRemoteDeltaStore
import com.lifetrack.sync.PersistentSyncRepository
import com.lifetrack.sync.RemoteSyncTransport
import com.lifetrack.sync.SyncEngineImpl
import com.lifetrack.sync.SyncRecord
import com.lifetrack.sync.SyncRecordComparator
import com.lifetrack.sync.SyncState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.assertFailsWith

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
    fun testHlcPersistenceAcrossProcessRestarts() {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)

        val persistence1 = SqliteHlcPersistence(driver, "node-restart-test")
        val clock1 = StandardHlcClock("node-restart-test", timeProvider, persistence = persistence1)

        val t1 = clock1.now()
        val t2 = clock1.receive(HlcTimestamp(1720000050000L, 10, "remoteNode"))
        assertEquals(1720000050000L, t2.physicalTimeMs)
        assertEquals(11, t2.logicalCounter)

        // Simulate process termination and restart with timeProvider clock at earlier time
        timeProvider.set(1720000010000L) // Clock skew / physical time appears earlier than highest merged HLC
        val persistence2 = SqliteHlcPersistence(driver, "node-restart-test")
        val clock2 = StandardHlcClock("node-restart-test", timeProvider, persistence = persistence2)

        // First call on new instance must not go backward in logical causality
        val restartedT = clock2.now()
        assertTrue(restartedT.physicalTimeMs >= 1720000050000L)
        assertTrue(restartedT.logicalCounter >= 12)
        assertTrue(restartedT > t2, "Restarted clock must be strictly greater than last persisted state")
    }

    @Test
    fun testDeviceIdentityStabilityAcrossRestarts() {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)

        val provider1 = PersistentDeviceIdentityProvider(driver, "desktop")
        val deviceId1 = provider1.getDeviceId()

        assertTrue(deviceId1.startsWith("desktop_"))
        assertTrue(deviceId1.length > 10)

        // Simulate app restart by constructing new provider on same database
        val provider2 = PersistentDeviceIdentityProvider(driver, "desktop")
        val deviceId2 = provider2.getDeviceId()

        assertEquals(deviceId1, deviceId2, "Device ID must remain stable across app restarts")
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
    fun testMultiplePendingEditsAcknowledgementDoesNotClearSyncPendingEarly() = runTest {
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

        // 1. Initial creation (Event A)
        val task = taskRepo.saveTask(
            Task(
                id = "task-multi-edit",
                title = "Initial Edit A",
                category = TaskCategory.PROJECT
            )
        )
        assertTrue(task.isSyncPending)

        // 2. Second rapid update before sync runs (Event B)
        timeProvider.advance(500L)
        val updatedTask = taskRepo.updateTask(
            task.copy(title = "Second Edit B")
        )
        assertTrue(updatedTask.isSyncPending)

        val pendingRecords = syncRepo.getAllRecords()
        assertEquals(2, pendingRecords.size)
        val eventA = pendingRecords[0].id
        val eventB = pendingRecords[1].id

        // 3. ACK Event A only (e.g. server acknowledged first batch)
        syncRepo.recordSuccessAcks(listOf(eventA))

        // Requirement 14 Verification: Task.isSyncPending MUST REMAIN TRUE because Event B is still pending!
        val taskAfterAckA = localDataSource.getTaskById("task-multi-edit")
        assertNotNull(taskAfterAckA)
        assertTrue(taskAfterAckA.isSyncPending, "isSyncPending must remain true while Event B is still in outbox")

        // 4. Now ACK Event B
        syncRepo.recordSuccessAcks(listOf(eventB))

        // Now that no pending outbox records remain for this task, isSyncPending clears to false
        val taskAfterAckB = localDataSource.getTaskById("task-multi-edit")
        assertNotNull(taskAfterAckB)
        assertFalse(taskAfterAckB.isSyncPending, "isSyncPending must clear to false once all pending edits are ACKed")
    }

    @Test
    fun testNeverAdvanceCheckpointPastInvalidDelta() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeA", timeProvider)

        val validTask1 = Task(id = "task-valid-1", title = "Valid Task 1", category = TaskCategory.STUDY)
        val deltaA = SyncRecord(
            id = "delta-1",
            entityType = "TASK",
            entityId = "task-valid-1",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeTask(validTask1),
            hlcTimestamp = "1720000001000:0:nodeRemote",
            createdAt = 1720000001000L
        )

        // Malformed delta B (corrupted payload or unsupported protocol version)
        val deltaB = SyncRecord(
            id = "delta-2-corrupt",
            entityType = "TASK",
            entityId = "task-corrupt-2",
            operation = "UPSERT",
            payload = "malformed||corrupt",
            hlcTimestamp = "1720000002000:0:nodeRemote",
            createdAt = 1720000002000L,
            protocolVersion = 99 // Unsupported future version
        )

        val validTask3 = Task(id = "task-valid-3", title = "Valid Task 3", category = TaskCategory.FINANCE)
        val deltaC = SyncRecord(
            id = "delta-3",
            entityType = "TASK",
            entityId = "task-valid-3",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeTask(validTask3),
            hlcTimestamp = "1720000003000:0:nodeRemote",
            createdAt = 1720000003000L
        )

        val mockTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> = records.map { it.id }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> = listOf(deltaA, deltaB, deltaC)
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

        // 1. Delta A was applied
        assertNotNull(localDataSource.getTaskById("task-valid-1"))

        // 2. Delta B caused sync to halt and report error
        assertEquals(SyncState.ERROR, syncEngine.syncStatus.value.state)
        assertTrue(syncEngine.syncStatus.value.errorMessage?.contains("Unsupported protocol") == true)

        // 3. Delta C was NOT applied
        assertNull(localDataSource.getTaskById("task-valid-3"))

        // 4. Invariant: Checkpoint MUST STOP at Delta A (1720000001000:0:nodeRemote), NEVER advancing past Delta B!
        val checkpoint = syncRepo.getSyncCheckpoint("nodeA")
        assertEquals("1720000001000:0:nodeRemote", checkpoint)
    }

    @Test
    fun testDeterministicRemoteOrdering() {
        val d1 = SyncRecord(id = "evt-1", entityType = "TASK", entityId = "t1", operation = "UPSERT", payload = "p", hlcTimestamp = "1720000001000:0:nodeA", createdAt = 1L)
        val d2A = SyncRecord(id = "evt-2a", entityType = "TASK", entityId = "t2", operation = "UPSERT", payload = "p", hlcTimestamp = "1720000002000:0:nodeA", createdAt = 2L)
        val d2B = SyncRecord(id = "evt-2b", entityType = "TASK", entityId = "t2", operation = "UPSERT", payload = "p", hlcTimestamp = "1720000002000:0:nodeA", createdAt = 2L)
        val d3 = SyncRecord(id = "evt-3", entityType = "TASK", entityId = "t3", operation = "UPSERT", payload = "p", hlcTimestamp = "1720000003000:0:nodeB", createdAt = 3L)

        val unsorted = listOf(d3, d2B, d1, d2A)
        val sorted = unsorted.sortedWith(SyncRecordComparator)

        assertEquals(listOf(d1, d2A, d2B, d3), sorted)
    }

    @Test
    fun testFirestoreRemoteSyncTransportAuthBoundaryAndIdempotency() = runTest {
        var currentUid: String? = null
        val authProvider = object : AuthSessionProvider {
            override fun getCurrentUserUid(): String? = currentUid
        }

        val remoteStore = InMemoryRemoteDeltaStore()
        val transport = FirestoreRemoteSyncTransport(authProvider, remoteStore)

        val testRecord = SyncRecord(
            id = "evt-idem-1",
            entityType = "TASK",
            entityId = "task-100",
            operation = "UPSERT",
            payload = "payload",
            hlcTimestamp = "1720000001000:0:nodeA",
            createdAt = 1720000001000L
        )

        // 1. Unauthenticated push fails with security exception
        assertFailsWith<IllegalStateException> {
            transport.pushRecords(listOf(testRecord))
        }

        // 2. Authenticate as user-123
        currentUid = "user-123"
        val acks1 = transport.pushRecords(listOf(testRecord))
        assertEquals(listOf("evt-idem-1"), acks1)

        // 3. Duplicate idempotent push of same event ID
        val acks2 = transport.pushRecords(listOf(testRecord))
        assertEquals(listOf("evt-idem-1"), acks2)

        // Remote store must have exactly 1 record for user-123
        val fetched = transport.pullRecords(null)
        assertEquals(1, fetched.size)
        assertEquals("evt-idem-1", fetched[0].id)
    }

    @Test
    fun testRemoteTombstonePreventsStaleResurrection() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeA", timeProvider)

        val localTask = Task(
            id = "task-tombstone-1",
            title = "Deleted Local Task",
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
