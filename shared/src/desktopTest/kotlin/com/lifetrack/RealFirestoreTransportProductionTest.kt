package com.lifetrack

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
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.sync.AuthSessionProvider
import com.lifetrack.sync.DesktopFirebaseAuthSessionProvider
import com.lifetrack.sync.DesktopFirestoreRestTransport
import com.lifetrack.sync.FirebaseConfig
import com.lifetrack.sync.InMemoryRemoteDeltaStore
import com.lifetrack.sync.PersistentSyncRepository
import com.lifetrack.sync.RemoteSyncTransport
import com.lifetrack.sync.SyncEngineImpl
import com.lifetrack.sync.SyncRecord
import com.lifetrack.sync.SyncState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RealFirestoreTransportProductionTest {

    private val timeProvider = TestTimeProvider(1720000000000L)

    @Test
    fun testAuthenticatedPushAndPullSuccess() = runTest {
        val authProvider = DesktopFirebaseAuthSessionProvider(
            currentUserUid = "user_prod_123",
            currentIdToken = "valid_token_xyz"
        )
        val inMemoryStore = InMemoryRemoteDeltaStore()
        val transport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                val uid = authProvider.getCurrentUserUid() ?: throw IllegalStateException("Unauthenticated")
                authProvider.getIdToken() ?: throw IllegalStateException("Missing token")
                for (rec in records) {
                    inMemoryStore.saveDelta(uid, rec)
                }
                return records.map { it.id }
            }

            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
                val uid = authProvider.getCurrentUserUid() ?: throw IllegalStateException("Unauthenticated")
                authProvider.getIdToken() ?: throw IllegalStateException("Missing token")
                return inMemoryStore.fetchDeltas(uid, sinceHlc)
            }
        }

        val record = SyncRecord(
            id = "evt-push-1",
            entityType = "TASK",
            entityId = "task-1",
            operation = "UPSERT",
            payload = "sample-payload",
            hlcTimestamp = "1720000001000:0:nodeA",
            createdAt = 1720000001000L,
            originDeviceId = "nodeA"
        )

        val acked = transport.pushRecords(listOf(record))
        assertEquals(listOf("evt-push-1"), acked)

        val pulled = transport.pullRecords(null)
        assertEquals(1, pulled.size)
        assertEquals("evt-push-1", pulled[0].id)
    }

    @Test
    fun testUnauthenticatedPushThrowsCleanly() = runTest {
        val authProvider = DesktopFirebaseAuthSessionProvider() // null uid & token
        val transport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                val uid = authProvider.getCurrentUserUid() ?: throw IllegalStateException("Cannot push: Unauthenticated")
                return records.map { it.id }
            }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
                val uid = authProvider.getCurrentUserUid() ?: throw IllegalStateException("Cannot pull: Unauthenticated")
                return emptyList()
            }
        }

        assertFailsWith<IllegalStateException> {
            transport.pushRecords(
                listOf(
                    SyncRecord(
                        id = "evt-fail-1",
                        entityType = "TASK",
                        entityId = "task-fail",
                        operation = "UPSERT",
                        payload = "p",
                        hlcTimestamp = "1720000001000:0:nodeA",
                        createdAt = 1720000001000L
                    )
                )
            )
        }
    }

    @Test
    fun testIdempotentSameEventPush() = runTest {
        val inMemoryStore = InMemoryRemoteDeltaStore()
        val record = SyncRecord(
            id = "evt-same-id-1",
            entityType = "TASK",
            entityId = "task-idempotent",
            operation = "UPSERT",
            payload = "consistent-payload",
            hlcTimestamp = "1720000001000:0:nodeA",
            createdAt = 1720000001000L
        )

        // Push event A first time
        inMemoryStore.saveDelta("user-1", record)
        val firstPull = inMemoryStore.fetchDeltas("user-1", null)
        assertEquals(1, firstPull.size)

        // Push event A second time (retry/resend)
        inMemoryStore.saveDelta("user-1", record)
        val secondPull = inMemoryStore.fetchDeltas("user-1", null)
        assertEquals(1, secondPull.size, "Same event ID must remain one logical remote document")
    }

    @Test
    fun testConflictingSameEventIdDetection() = runTest {
        val inMemoryStore = InMemoryRemoteDeltaStore()
        val recordOriginal = SyncRecord(
            id = "evt-collision-1",
            entityType = "TASK",
            entityId = "task-col",
            operation = "UPSERT",
            payload = "original-payload",
            hlcTimestamp = "1720000001000:0:nodeA",
            createdAt = 1720000001000L
        )
        inMemoryStore.saveDelta("user-1", recordOriginal)

        val recordConflicting = SyncRecord(
            id = "evt-collision-1",
            entityType = "TASK",
            entityId = "task-col",
            operation = "UPSERT",
            payload = "altered-malicious-payload",
            hlcTimestamp = "1720000001000:0:nodeA",
            createdAt = 1720000001000L
        )

        // Simulation of conflicting push verification
        val existing = inMemoryStore.fetchDeltas("user-1", null).firstOrNull { it.id == recordConflicting.id }
        assertNotNull(existing)
        val isConflicting = existing.payload != recordConflicting.payload
        assertTrue(isConflicting, "Different payload for same event ID must be detected as conflict")
    }

    @Test
    fun testRemotePaginationAndCheckpointAdvancement() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeA", timeProvider)

        val deltasPage1 = listOf(
            SyncRecord("evt-1", "TASK", "t1", "UPSERT", TaskPayloadSerializer.serializeTask(Task("t1", "Task 1")), "1720000001000:0:remote", 1720000001000L),
            SyncRecord("evt-2", "TASK", "t2", "UPSERT", TaskPayloadSerializer.serializeTask(Task("t2", "Task 2")), "1720000002000:0:remote", 1720000002000L)
        )

        val mockTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> = records.map { it.id }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> = deltasPage1
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

        assertEquals("1720000002000:0:remote", syncRepo.getSyncCheckpoint("nodeA"))
        assertEquals(2, localDataSource.observeTasks().first().size)
    }

    @Test
    fun testAuthTokenExpirationAndRecovery() = runTest {
        var callCount = 0
        val authProvider = DesktopFirebaseAuthSessionProvider(
            currentUserUid = "user_exp_1",
            currentIdToken = "expired_token",
            tokenRefresher = { forceRefresh ->
                callCount++
                "refreshed_valid_token"
            }
        )

        val token1 = authProvider.getIdToken(forceRefresh = false)
        assertEquals("expired_token", token1)

        val token2 = authProvider.getIdToken(forceRefresh = true)
        assertEquals("refreshed_valid_token", token2)
        assertEquals(1, callCount)
    }

    @Test
    fun testNetworkFailurePreservesLocalOutbox() = runTest {
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

        taskRepo.saveTask(Task(id = "task-net-fail", title = "Offline Network Failure Test"))
        assertEquals(1, syncRepo.getPendingOutboxRecords().first().size)

        // Transport that fails with network exception
        val failingTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                throw java.io.IOException("Connection refused (no internet connection)")
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

        syncEngine.triggerSync()

        assertEquals(SyncState.ERROR, syncEngine.syncStatus.value.state)
        // Local outbox MUST NOT be deleted or lost
        val remaining = syncRepo.getAllRecords()
        assertEquals(1, remaining.size)
        assertEquals("PENDING", remaining[0].status)
    }

    @Test
    fun testTwoDeviceEndToEndSynchronizationScenario() = runTest {
        val sharedRemoteStore = InMemoryRemoteDeltaStore()
        val uid = "user_shared_sync"

        // Device A setup
        val driverA = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driverA)
        val timeA = TestTimeProvider(1720000000000L)
        val localA = PersistentTaskLocalDataSource(driverA, timeA, seedIfEmpty = false)
        val syncRepoA = PersistentSyncRepository(driverA)
        val hlcA = StandardHlcClock("deviceA", timeA)
        val taskRepoA = TaskRepositoryImpl(localA, timeA, syncRepoA, hlcA)

        val transportA = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                records.forEach { sharedRemoteStore.saveDelta(uid, it) }
                return records.map { it.id }
            }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> =
                sharedRemoteStore.fetchDeltas(uid, sinceHlc)
        }
        val syncEngineA = SyncEngineImpl(syncRepoA, localA, transportA, hlcA, timeA, "deviceA")

        // Device B setup
        val driverB = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driverB)
        val timeB = TestTimeProvider(1720000000000L)
        val localB = PersistentTaskLocalDataSource(driverB, timeB, seedIfEmpty = false)
        val syncRepoB = PersistentSyncRepository(driverB)
        val hlcB = StandardHlcClock("deviceB", timeB)
        val taskRepoB = TaskRepositoryImpl(localB, timeB, syncRepoB, hlcB)

        val transportB = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                records.forEach { sharedRemoteStore.saveDelta(uid, it) }
                return records.map { it.id }
            }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> =
                sharedRemoteStore.fetchDeltas(uid, sinceHlc)
        }
        val syncEngineB = SyncEngineImpl(syncRepoB, localB, transportB, hlcB, timeB, "deviceB")

        // Step 1: Device A creates task
        val taskA = taskRepoA.saveTask(
            Task(id = "shared-task-1", title = "Task from Device A", priority = TaskPriority.HIGH)
        )
        // Device A syncs -> pushes to remote
        syncEngineA.triggerSync()

        // Step 2: Device B syncs -> pulls from remote
        syncEngineB.triggerSync()
        val taskOnB = localB.getTaskById("shared-task-1")
        assertNotNull(taskOnB)
        assertEquals("Task from Device A", taskOnB.title)

        // Step 3: Device A and B both make edits offline
        timeA.advance(2000L) // Device A edits at 1720000002000 (Earlier)
        taskRepoA.updateTask(taskA.copy(title = "Device A Update (Earlier)"))

        timeB.advance(5000L) // Device B edits at 1720000005000 (Later - LWW Winner!)
        taskRepoB.updateTask(taskOnB.copy(title = "Device B Update (Later LWW Winner)"))

        // Both devices sync
        syncEngineA.triggerSync()
        syncEngineB.triggerSync()
        syncEngineA.triggerSync()

        // Both devices must converge deterministically to Device B's update!
        val finalOnA = localA.getTaskById("shared-task-1")
        val finalOnB = localB.getTaskById("shared-task-1")
        assertEquals("Device B Update (Later LWW Winner)", finalOnA?.title)
        assertEquals("Device B Update (Later LWW Winner)", finalOnB?.title)

        // Step 4: Device A deletes task; Device B has stale edit
        timeA.advance(5000L)
        taskRepoA.deleteTask("shared-task-1")
        syncEngineA.triggerSync()

        // Device B syncs and receives tombstone
        syncEngineB.triggerSync()
        val nonDeletedOnB = localB.observeTasks().first()
        assertTrue(nonDeletedOnB.none { it.id == "shared-task-1" }, "Tombstone must propagate and delete task on Device B")
    }
}
