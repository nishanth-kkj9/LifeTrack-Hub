package com.lifetrack

import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema
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
import com.lifetrack.sync.WinnerType
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class SyncEngineTest {

    private val testTimeProvider = TestTimeProvider(1720000000000L)

    @Test
    fun testOutboxRecordPersistenceAndRecovery() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)

        val syncRepo = PersistentSyncRepository(driver)

        val record1 = SyncRecord(
            id = "sync-rec-1",
            entityType = "TASK",
            entityId = "task-alpha",
            operation = "UPSERT",
            payloadEncrypted = "payload-alpha".encodeToByteArray(),
            hlcTimestamp = "1720000000000:0:device-1",
            createdAt = 1720000000000L
        )

        syncRepo.enqueueRecord(record1)

        val initialPending = syncRepo.getPendingOutboxRecords().first()
        assertEquals(1, initialPending.size)
        assertEquals("sync-rec-1", initialPending[0].id)
        assertEquals("PENDING", initialPending[0].status)

        // Simulate crash / restart with fresh repository over same driver
        val recoveredRepo = PersistentSyncRepository(driver)
        val recoveredPending = recoveredRepo.getPendingOutboxRecords().first()
        assertEquals(1, recoveredPending.size)
        assertEquals("sync-rec-1", recoveredPending[0].id)
        assertEquals("TASK", recoveredPending[0].entityType)
    }

    @Test
    fun testDatabaseMigrationV1ToV2() = runTest {
        val driver = MemorySqlDriver()

        // 1. Manually setup Schema Version 1
        driver.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);")
        driver.execute("INSERT INTO schema_version (version) VALUES (1);")
        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                due_date TEXT,
                due_time TEXT,
                due_date_epoch_ms INTEGER,
                completed_at_epoch_ms INTEGER,
                estimated_minutes INTEGER,
                actual_minutes INTEGER,
                is_starred INTEGER NOT NULL DEFAULT 0,
                recurrence TEXT NOT NULL DEFAULT 'NONE',
                tags TEXT NOT NULL DEFAULT '',
                is_sync_pending INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at_epoch_ms INTEGER NOT NULL,
                updated_at_epoch_ms INTEGER NOT NULL,
                subject_id TEXT,
                exam_id TEXT,
                notes TEXT
            );
            """.trimIndent()
        )

        // Seed a task in v1
        driver.execute(
            """
            INSERT INTO tasks (id, title, category, priority, status, is_starred, recurrence, tags, is_sync_pending, is_deleted, created_at_epoch_ms, updated_at_epoch_ms)
            VALUES (?, ?, ?, ?, ?, 0, 'NONE', '', 0, 0, 100, 100);
            """.trimIndent(),
            arrayOf("task-v1-seed", "Existing Task in V1", "VTU", "HIGH", "TODO")
        )

        // 2. Run schema initialization - should trigger migration 1 -> 2
        TaskDatabaseSchema.initializeSchema(driver)

        // 3. Verify schema version is now 2
        val currentVer = driver.query("SELECT version FROM schema_version LIMIT 1;") {
            it.getInt(0) ?: 0
        }.first()
        assertEquals(2, currentVer)

        // 4. Verify existing task preserved
        val tasks = driver.query("SELECT id, title FROM tasks WHERE id = ?;", arrayOf("task-v1-seed")) {
            it.getString(0) to it.getString(1)
        }
        assertEquals(1, tasks.size)
        assertEquals("Existing Task in V1", tasks[0].second)

        // 5. Verify sync_outbox table is functional
        val syncRepo = PersistentSyncRepository(driver)
        syncRepo.enqueueRecord(
            SyncRecord(
                id = "mig-test-1",
                entityType = "TASK",
                entityId = "task-v1-seed",
                operation = "UPSERT",
                payloadEncrypted = "mig-data".encodeToByteArray(),
                hlcTimestamp = "1720000000000:0:node-1",
                createdAt = 1720000000000L
            )
        )
        val outbox = syncRepo.getPendingOutboxRecords().first()
        assertEquals(1, outbox.size)
    }

    @Test
    fun testTaskRepositoryOutboxIntegration() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)

        val localDataSource = PersistentTaskLocalDataSource(driver, testTimeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val repository = TaskRepositoryImpl(
            localDataSource = localDataSource,
            timeProvider = testTimeProvider,
            syncRepository = syncRepo,
            nodeId = "test-node"
        )

        // 1. Save Task -> should enqueue UPSERT
        val task = Task(
            id = "task-outbox-1",
            title = "Signals and Systems Lab",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.URGENT,
            status = TaskStatus.TODO,
            dueDate = "2026-10-01",
            createdAtEpochMs = 1720000000000L,
            updatedAtEpochMs = 1720000000000L
        )
        repository.saveTask(task)

        var pending = syncRepo.getPendingOutboxRecords().first()
        assertEquals(1, pending.size)
        assertEquals("TASK", pending[0].entityType)
        assertEquals("task-outbox-1", pending[0].entityId)
        assertEquals("UPSERT", pending[0].operation)

        // 2. Add subtask -> should enqueue SUBTASK UPSERT
        repository.addSubtask("task-outbox-1", Subtask(id = "sub-1", taskId = "task-outbox-1", title = "Write MATLAB script", completed = false))
        pending = syncRepo.getPendingOutboxRecords().first()
        assertEquals(2, pending.size)

        // 3. Toggle completion -> should enqueue UPSERT
        repository.toggleTaskCompletion("task-outbox-1")
        pending = syncRepo.getPendingOutboxRecords().first()
        assertEquals(3, pending.size)

        // 4. Delete task -> should enqueue DELETE
        repository.deleteTask("task-outbox-1")
        pending = syncRepo.getPendingOutboxRecords().first()
        assertEquals(4, pending.size)
        assertEquals("DELETE", pending.last().operation)
    }

    @Test
    fun testSyncEngineTriggerSyncAndDrain() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)

        val syncRepo = PersistentSyncRepository(driver)
        val remoteTransport = DefaultMockRemoteTransport()
        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            remoteTransport = remoteTransport,
            timeProvider = testTimeProvider,
            deviceName = "MacBook-Pro"
        )

        assertEquals(SyncState.IDLE, syncEngine.syncStatus.value.state)

        // Enqueue 2 records
        syncRepo.enqueueRecord(
            SyncRecord(
                id = "rec-1",
                entityType = "TASK",
                entityId = "task-1",
                operation = "UPSERT",
                payloadEncrypted = "data-1".encodeToByteArray(),
                hlcTimestamp = "1720000000000:0:macbook",
                createdAt = 1720000000000L
            )
        )
        syncRepo.enqueueRecord(
            SyncRecord(
                id = "rec-2",
                entityType = "TASK",
                entityId = "task-2",
                operation = "UPSERT",
                payloadEncrypted = "data-2".encodeToByteArray(),
                hlcTimestamp = "1720000000000:1:macbook",
                createdAt = 1720000000001L
            )
        )

        assertEquals(2, syncRepo.getPendingOutboxRecords().first().size)

        // Trigger sync
        syncEngine.triggerSync()

        val status = syncEngine.syncStatus.value
        assertEquals(SyncState.SUCCESS, status.state)
        assertEquals(0, status.pendingOutboxCount)
        assertEquals(1720000000000L, status.lastSyncedTimestamp)

        // Outbox drained
        val remaining = syncRepo.getPendingOutboxRecords().first()
        assertEquals(0, remaining.size)
    }

    @Test
    fun testOfflineModeQueuingAndOnlineDrain() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)

        val syncRepo = PersistentSyncRepository(driver)
        val remoteTransport = DefaultMockRemoteTransport()
        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            remoteTransport = remoteTransport,
            timeProvider = testTimeProvider
        )

        // Go offline
        syncEngine.setOffline(true)
        assertEquals(SyncState.OFFLINE, syncEngine.syncStatus.value.state)

        // Enqueue records while offline
        syncRepo.enqueueRecord(
            SyncRecord(
                id = "offline-rec-1",
                entityType = "TASK",
                entityId = "task-offline",
                operation = "UPSERT",
                payloadEncrypted = "offline-data".encodeToByteArray(),
                hlcTimestamp = "1720000000000:0:device-off",
                createdAt = 1720000000000L
            )
        )

        // Attempting sync while offline should be blocked
        syncEngine.triggerSync()
        assertEquals(SyncState.OFFLINE, syncEngine.syncStatus.value.state)
        assertEquals(1, syncRepo.getPendingOutboxRecords().first().size)

        // Reconnect online
        syncEngine.setOffline(false)
        assertEquals(SyncState.IDLE, syncEngine.syncStatus.value.state)

        // Trigger sync should now drain outbox
        syncEngine.triggerSync()
        assertEquals(SyncState.SUCCESS, syncEngine.syncStatus.value.state)
        assertEquals(0, syncRepo.getPendingOutboxRecords().first().size)
    }

    @Test
    fun testLastWriteWinsConflictResolution() {
        val driver = MemorySqlDriver()
        val syncRepo = PersistentSyncRepository(driver)
        val syncEngine = SyncEngineImpl(syncRepo)

        // Scenario 1: Remote higher physical time -> Remote wins
        val local1 = SyncRecord(
            id = "loc-1",
            entityType = "TASK",
            entityId = "t-1",
            operation = "UPSERT",
            payloadEncrypted = "local".encodeToByteArray(),
            hlcTimestamp = "1000:0:nodeA",
            createdAt = 1000L
        )
        val remote1 = SyncRecord(
            id = "rem-1",
            entityType = "TASK",
            entityId = "t-1",
            operation = "UPSERT",
            payloadEncrypted = "remote".encodeToByteArray(),
            hlcTimestamp = "2000:0:nodeB",
            createdAt = 2000L
        )
        val res1 = syncEngine.resolveConflict(local1, remote1)
        assertEquals(WinnerType.REMOTE, res1.winnerType)
        assertEquals("rem-1", res1.winner.id)

        // Scenario 2: Local higher physical time -> Local wins
        val local2 = local1.copy(hlcTimestamp = "3000:0:nodeA")
        val res2 = syncEngine.resolveConflict(local2, remote1)
        assertEquals(WinnerType.LOCAL, res2.winnerType)

        // Scenario 3: Same physical time, higher logical counter wins
        val local3 = SyncRecord(
            id = "loc-3",
            entityType = "TASK",
            entityId = "t-1",
            operation = "UPSERT",
            payloadEncrypted = "local".encodeToByteArray(),
            hlcTimestamp = "5000:1:nodeA",
            createdAt = 5000L
        )
        val remote3 = SyncRecord(
            id = "rem-3",
            entityType = "TASK",
            entityId = "t-1",
            operation = "UPSERT",
            payloadEncrypted = "remote".encodeToByteArray(),
            hlcTimestamp = "5000:2:nodeB",
            createdAt = 5000L
        )
        val res3 = syncEngine.resolveConflict(local3, remote3)
        assertEquals(WinnerType.REMOTE, res3.winnerType)
    }

    @Test
    fun testTransientFailureAndRetryCounter() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)

        val syncRepo = PersistentSyncRepository(driver)

        // Failing transport that simulates network error
        val failingTransport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
                throw RuntimeException("Network timeout 504")
            }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> = emptyList()
        }

        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            remoteTransport = failingTransport,
            timeProvider = testTimeProvider
        )

        syncRepo.enqueueRecord(
            SyncRecord(
                id = "fail-rec-1",
                entityType = "TASK",
                entityId = "t-err",
                operation = "UPSERT",
                payloadEncrypted = "err".encodeToByteArray(),
                hlcTimestamp = "1720000000000:0:node-1",
                createdAt = 1720000000000L
            )
        )

        syncEngine.triggerSync()

        val status = syncEngine.syncStatus.value
        assertEquals(SyncState.ERROR, status.state)
        assertEquals("Network timeout 504", status.errorMessage)
        assertEquals(1, status.pendingOutboxCount)
    }
}
