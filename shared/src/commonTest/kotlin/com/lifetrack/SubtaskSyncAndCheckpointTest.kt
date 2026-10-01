package com.lifetrack

import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.TaskDatabaseSchema
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.repository.TaskPayloadSerializer
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.sync.AuthSessionProvider
import com.lifetrack.sync.FirestoreRemoteSyncTransport
import com.lifetrack.sync.InMemoryRemoteDeltaStore
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

class SubtaskSyncAndCheckpointTest {

    private val timeProvider = TestTimeProvider(1720000000000L)

    private fun createAuthSession(uid: String = "test-user-subtask"): AuthSessionProvider {
        return object : AuthSessionProvider {
            override fun getCurrentUserUid(): String = uid
            override suspend fun getIdToken(forceRefresh: Boolean): String = "token-$uid"
        }
    }

    @Test
    fun testRemoteSubtaskUpsertAndRemoteSubtaskDeleteAppliedLocally() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = com.lifetrack.sync.PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeSubtaskA", timeProvider)
        val deltaStore = InMemoryRemoteDeltaStore()

        val auth = createAuthSession()
        val transport = FirestoreRemoteSyncTransport(auth, deltaStore)

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = transport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeSubtaskA"
        )

        // 1. Prepare parent task locally
        val parentTask = Task(id = "parent-task-1", title = "Parent Task for Subtask Sync", category = TaskCategory.STUDY)
        localDataSource.applyRemoteTaskUpsert(parentTask, "1720000000000:0:nodeRemote", timeProvider.nowEpochMs())

        // 2. Put a remote SUBTASK UPSERT delta into remote store
        val subtask = Subtask(
            id = "subtask-remote-1",
            taskId = "parent-task-1",
            title = "Solve Exercise 5.1",
            completed = false,
            sortOrder = 1
        )
        val subtaskUpsertRecord = SyncRecord(
            id = "evt_subtask_upsert_1",
            entityType = "SUBTASK",
            entityId = "subtask-remote-1",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeSubtask(subtask),
            hlcTimestamp = "1720000001000:0:nodeRemote",
            createdAt = 1720000001000L,
            originDeviceId = "nodeRemote",
            protocolVersion = 1,
            schemaVersion = 1
        )
        deltaStore.saveDelta("test-user-subtask", subtaskUpsertRecord)

        // Trigger sync
        syncEngine.triggerSync()

        // Verify SUBTASK UPSERT applied locally!
        val taskWithSubtasks = localDataSource.getTaskById("parent-task-1")
        assertNotNull(taskWithSubtasks)
        assertEquals(1, taskWithSubtasks.subtasks.size)
        assertEquals("subtask-remote-1", taskWithSubtasks.subtasks[0].id)
        assertEquals("Solve Exercise 5.1", taskWithSubtasks.subtasks[0].title)
        assertFalse(taskWithSubtasks.subtasks[0].completed)

        // Verify entity sync metadata recorded for SUBTASK
        val meta = localDataSource.getEntitySyncMetadata("SUBTASK", "subtask-remote-1")
        assertNotNull(meta)
        assertEquals("1720000001000:0:nodeRemote", meta.hlcTimestamp)
        assertFalse(meta.isDeleted)

        // 3. Now put a remote SUBTASK DELETE delta
        val subtaskDeleteRecord = SyncRecord(
            id = "evt_subtask_delete_1",
            entityType = "SUBTASK",
            entityId = "subtask-remote-1",
            operation = "DELETE",
            payload = "",
            hlcTimestamp = "1720000002000:0:nodeRemote",
            createdAt = 1720000002000L,
            originDeviceId = "nodeRemote",
            protocolVersion = 1,
            schemaVersion = 1
        )
        deltaStore.saveDelta("test-user-subtask", subtaskDeleteRecord)

        // Trigger sync
        syncEngine.triggerSync()

        // Verify SUBTASK DELETE tombstone applied: task subtask list does not contain deleted subtask
        val taskAfterDelete = localDataSource.getTaskById("parent-task-1")
        assertNotNull(taskAfterDelete)
        assertEquals(0, taskAfterDelete.subtasks.size)

        val deleteMeta = localDataSource.getEntitySyncMetadata("SUBTASK", "subtask-remote-1")
        assertNotNull(deleteMeta)
        assertTrue(deleteMeta.isDeleted)
    }

    @Test
    fun testCheckpointDoesNotAdvancePastMalformedSubtask() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = com.lifetrack.sync.PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeErrCheck", timeProvider)
        val deltaStore = InMemoryRemoteDeltaStore()

        val auth = createAuthSession()
        val transport = FirestoreRemoteSyncTransport(auth, deltaStore)

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = transport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeErrCheck"
        )

        // 1. Delta 1: Valid task
        val validTask = Task(id = "valid-task-chk", title = "Valid Task Before Error", category = TaskCategory.PERSONAL)
        val validDelta = SyncRecord(
            id = "evt_chk_1",
            entityType = "TASK",
            entityId = "valid-task-chk",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeTask(validTask),
            hlcTimestamp = "1720000001000:0:nodeRemote",
            createdAt = 1720000001000L
        )
        deltaStore.saveDelta("test-user-subtask", validDelta)

        // 2. Delta 2: Malformed subtask (corrupted non-JSON and non-pipe payload)
        val badSubtaskDelta = SyncRecord(
            id = "evt_chk_2_corrupt",
            entityType = "SUBTASK",
            entityId = "bad-sub-1",
            operation = "UPSERT",
            payload = "{corrupted-not-valid-json",
            hlcTimestamp = "1720000002000:0:nodeRemote",
            createdAt = 1720000002000L
        )
        deltaStore.saveDelta("test-user-subtask", badSubtaskDelta)

        // 3. Delta 3: Valid subtask that should NOT be reached or advanced past
        val validSubtask3 = Subtask(id = "sub-3", taskId = "valid-task-chk", title = "Subtask 3", completed = false)
        val validDelta3 = SyncRecord(
            id = "evt_chk_3",
            entityType = "SUBTASK",
            entityId = "sub-3",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeSubtask(validSubtask3),
            hlcTimestamp = "1720000003000:0:nodeRemote",
            createdAt = 1720000003000L
        )
        deltaStore.saveDelta("test-user-subtask", validDelta3)

        // Trigger sync
        syncEngine.triggerSync()

        val status = syncEngine.syncStatus.value
        assertEquals(SyncState.ERROR, status.state)
        assertTrue(status.errorMessage?.contains("Malformed subtask payload") == true)

        // Valid task 1 was applied
        assertNotNull(localDataSource.getTaskById("valid-task-chk"))

        // Subtask 3 was NOT applied because processing halted at event 2
        val task = localDataSource.getTaskById("valid-task-chk")
        assertTrue(task?.subtasks.isNullOrEmpty())

        // Checkpoint must be advanced ONLY up to event 1, NEVER past event 2 or 3!
        val checkpoint = syncRepo.getSyncCheckpoint("nodeErrCheck")
        assertNotNull(checkpoint)
        assertTrue(checkpoint.contains("evt_chk_1"), "Checkpoint must be stopped at evt_chk_1")
        assertFalse(checkpoint.contains("evt_chk_2"), "Checkpoint must never advance to malformed event")
        assertFalse(checkpoint.contains("evt_chk_3"), "Checkpoint must never advance past malformed event")
    }

    @Test
    fun testPartialBatch50Applied51stMalformedCheckpointSafety() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = com.lifetrack.sync.PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("nodeBatchTest", timeProvider)
        val deltaStore = InMemoryRemoteDeltaStore()

        val auth = createAuthSession()
        val transport = FirestoreRemoteSyncTransport(auth, deltaStore)

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = transport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "nodeBatchTest"
        )

        // Generate 50 valid tasks
        for (i in 1..50) {
            val t = Task(id = "task-batch-$i", title = "Batch Task $i", category = TaskCategory.PROJECT)
            val hlc = "172000000${1000 + i}:0:nodeRemote"
            val record = SyncRecord(
                id = "evt_batch_$i",
                entityType = "TASK",
                entityId = "task-batch-$i",
                operation = "UPSERT",
                payload = TaskPayloadSerializer.serializeTask(t),
                hlcTimestamp = hlc,
                createdAt = 1720000000000L + i
            )
            deltaStore.saveDelta("test-user-subtask", record)
        }

        // 51st event is malformed
        val badRecord51 = SyncRecord(
            id = "evt_batch_51_bad",
            entityType = "TASK",
            entityId = "task-batch-51",
            operation = "UPSERT",
            payload = "{corrupt-invalid-json-payload",
            hlcTimestamp = "1720000001051:0:nodeRemote",
            createdAt = 1720000000051L
        )
        deltaStore.saveDelta("test-user-subtask", badRecord51)

        syncEngine.triggerSync()

        val status = syncEngine.syncStatus.value
        assertEquals(SyncState.ERROR, status.state)

        // All 50 valid tasks must be applied
        val allTasks = localDataSource.observeTasks().first()
        assertEquals(50, allTasks.size)

        // Checkpoint must advance strictly up to event 50
        val persistedCheckpoint = syncRepo.getSyncCheckpoint("nodeBatchTest")
        assertNotNull(persistedCheckpoint)
        assertTrue(persistedCheckpoint.contains("evt_batch_50"), "Checkpoint must be stopped at event 50")
        assertFalse(persistedCheckpoint.contains("evt_batch_51"), "Checkpoint must not include event 51")

        // lastSuccessfulSyncTime must NOT be updated because overall sync ended in ERROR
        assertNull(status.lastSyncedTimestamp, "lastSuccessfulSyncTime must not be updated on error")
    }
}
