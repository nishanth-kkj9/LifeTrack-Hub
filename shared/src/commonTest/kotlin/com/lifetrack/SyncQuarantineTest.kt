package com.lifetrack

import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema
import com.lifetrack.data.repository.TaskPayloadSerializer
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
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * STABILITY (G1): poison-pill quarantine guarantees.
 *
 * Before this feature, a single invalid remote deltas (malformed payload, unknown entity
 * type, or a future protocolVersion) stalled sync PERMANENTLY on every device: the
 * checkpoint never advanced past it and remote deltas are immutable (Firestore rules
 * forbid update/delete), so there was no recovery path at all.
 *
 * Contract verified here:
 *  1. Attempts 1..(MAX-1): classic fail-stop — checkpoint does NOT advance (existing
 *     SubtaskSyncAndCheckpointTest semantics preserved).
 *  2. Attempt MAX: the delta is quarantined (persisted for diagnostics), the checkpoint
 *     steps over it, and subsequent VALID deltas are applied.
 *  3. Quarantined records are counted in SyncStatus and never reprocessed once the
 *     cursor-based pull moves past them; the next clean sync returns to SUCCESS.
 */
class SyncQuarantineTest {

    private val timeProvider = TestTimeProvider(1720000000000L)

    @Test
    fun testPoisonPillQuarantinedAfterMaxAttemptsAndStreamResumes() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val local = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlc = StandardHlcClock("nodeQ", timeProvider)

        val poison = SyncRecord(
            id = "evt_poison",
            entityType = "GHOST_ENTITY", // unknown entity type → always invalid
            entityId = "ghost-1",
            operation = "UPSERT",
            payload = "{}",
            hlcTimestamp = "1720000001000:0:nodeRemote",
            createdAt = 1720000001000L
        )
        val validAfter = SyncRecord(
            id = "evt_after",
            entityType = "TASK",
            entityId = "task-after",
            operation = "UPSERT",
            payload = TaskPayloadSerializer.serializeTask(
                Task(id = "task-after", title = "Valid Task After Poison", category = TaskCategory.STUDY)
            ),
            hlcTimestamp = "1720000002000:0:nodeRemote",
            createdAt = 1720000002000L
        )

        // Cursor-aware transport: behaves like the real Firestore query (strictly-after semantics)
        val transport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> = records.map { it.id }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
                val all = listOf(poison, validAfter)
                if (sinceHlc == null) return all
                val since = HlcTimestamp.fromString(sinceHlc) ?: return all
                return all.filter { rec ->
                    val recHlc = HlcTimestamp.fromString(rec.hlcTimestamp)
                    recHlc != null && recHlc > since
                }
            }
        }

        val engine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = local,
            remoteTransport = transport,
            hlcClock = hlc,
            timeProvider = timeProvider,
            deviceId = "nodeQ"
        )

        // Attempt 1: fail-stop, checkpoint must not exist yet
        engine.triggerSync()
        assertEquals(SyncState.ERROR, engine.syncStatus.value.state)
        assertNull(syncRepo.getSyncCheckpoint("nodeQ"))
        assertEquals(0, syncRepo.getQuarantinedCount())
        assertNull(local.getTaskById("task-after"), "Stream must halt at the poison pill before quarantine")

        // Attempt 2: still fail-stop (attempts < MAX_INVALID_DELTA_ATTEMPTS)
        engine.triggerSync()
        assertNull(syncRepo.getSyncCheckpoint("nodeQ"))
        assertEquals(0, syncRepo.getQuarantinedCount())

        // Attempt 3 (== SyncEngineImpl.MAX_INVALID_DELTA_ATTEMPTS): quarantine + step over
        engine.triggerSync()
        assertEquals(1, syncRepo.getQuarantinedCount(), "Poison pill must be permanently quarantined")
        val checkpoint = syncRepo.getSyncCheckpoint("nodeQ")
        assertNotNull(checkpoint)
        // The checkpoint must have stepped OVER the poison pill — it now points at the
        // last successfully processed delta (evt_after), proving the stream resumed.
        assertTrue(checkpoint.contains("evt_after"), "Checkpoint must advance past the quarantined record, got: $checkpoint")
        assertTrue(
            engine.syncStatus.value.errorMessage?.contains("Quarantined") == true,
            "Status must surface the quarantine action, got: ${engine.syncStatus.value.errorMessage}"
        )

        // The valid record AFTER the poison pill must now be applied
        val applied = local.getTaskById("task-after")
        assertNotNull(applied, "Deltas after a quarantined record must flow again")
        assertEquals("Valid Task After Poison", applied.title)

        // Next sync: cursor is past the poison pill → clean SUCCESS, count preserved
        engine.triggerSync()
        assertEquals(SyncState.SUCCESS, engine.syncStatus.value.state)
        assertNull(engine.syncStatus.value.errorMessage)
        assertEquals(1, engine.syncStatus.value.quarantinedCount)
    }

    @Test
    fun testMalformedPayloadAlsoQuarantines() = runTest {
        val driver = MemorySqlDriver()
        TaskDatabaseSchema.initializeSchema(driver)
        val local = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = PersistentSyncRepository(driver)
        val hlc = StandardHlcClock("nodeQ2", timeProvider)

        val corrupt = SyncRecord(
            id = "evt_corrupt_payload",
            entityType = "TASK",
            entityId = "task-corrupt",
            operation = "UPSERT",
            payload = "{corrupt-invalid-json-payload",
            hlcTimestamp = "1720000001000:0:nodeRemote",
            createdAt = 1720000001000L
        )
        val transport = object : RemoteSyncTransport {
            override suspend fun pushRecords(records: List<SyncRecord>): List<String> = records.map { it.id }
            override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> =
                if (sinceHlc == null) listOf(corrupt) else emptyList()
        }
        val engine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = local,
            remoteTransport = transport,
            hlcClock = hlc,
            timeProvider = timeProvider,
            deviceId = "nodeQ2"
        )

        repeat(SyncEngineImpl.MAX_INVALID_DELTA_ATTEMPTS) { engine.triggerSync() }

        assertEquals(1, syncRepo.getQuarantinedCount())
        val checkpoint = syncRepo.getSyncCheckpoint("nodeQ2")
        assertNotNull(checkpoint)
        // Only the corrupt record existed; after quarantine the checkpoint steps over it.
        assertTrue(checkpoint.contains("evt_corrupt_payload"), "Checkpoint must step over the quarantined record, got: $checkpoint")
        assertEquals(0, local.observeTasks().first().size, "Corrupt payload must never be applied locally")
    }
}
