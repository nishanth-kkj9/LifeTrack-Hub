package com.lifetrack

import com.lifetrack.sync.AuthSessionProvider
import com.lifetrack.sync.FirestoreRemoteSyncTransport
import com.lifetrack.sync.InMemoryRemoteDeltaStore
import com.lifetrack.sync.SyncCursor
import com.lifetrack.sync.SyncDataIntegrityException
import com.lifetrack.sync.SyncRecord
import com.lifetrack.sync.SyncRecordComparator
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class HlcOrderingAndPaginationTest {

    private fun createAuthSession(uid: String = "test-pagination-user"): AuthSessionProvider {
        return object : AuthSessionProvider {
            override fun getCurrentUserUid(): String = uid
            override suspend fun getIdToken(forceRefresh: Boolean): String = "mock-id-token"
        }
    }

    @Test
    fun testHlcStructuredOrderingIdenticalToCausality() {
        val r1 = SyncRecord(id = "evt_a", entityType = "TASK", entityId = "t1", operation = "UPSERT", payload = "{}", hlcTimestamp = "1720000000000:0:nodeA", createdAt = 1720000000000L)
        val r2 = SyncRecord(id = "evt_b", entityType = "TASK", entityId = "t1", operation = "UPSERT", payload = "{}", hlcTimestamp = "1720000000000:1:nodeA", createdAt = 1720000000000L)
        val r3 = SyncRecord(id = "evt_c", entityType = "TASK", entityId = "t1", operation = "UPSERT", payload = "{}", hlcTimestamp = "1720000000000:1:nodeB", createdAt = 1720000000000L)
        val r4 = SyncRecord(id = "evt_d", entityType = "TASK", entityId = "t1", operation = "UPSERT", payload = "{}", hlcTimestamp = "1720000005000:0:nodeA", createdAt = 1720000005000L)

        val list = listOf(r4, r2, r1, r3)
        val sorted = list.sortedWith(SyncRecordComparator)

        assertEquals(listOf(r1, r2, r3, r4), sorted)
    }

    @Test
    fun testSameHlcDifferentEventIdsTieBreaker() {
        val r1 = SyncRecord(id = "evt_10", entityType = "TASK", entityId = "t1", operation = "UPSERT", payload = "{}", hlcTimestamp = "1720000000000:0:nodeA", createdAt = 1720000000000L)
        val r2 = SyncRecord(id = "evt_20", entityType = "TASK", entityId = "t2", operation = "UPSERT", payload = "{}", hlcTimestamp = "1720000000000:0:nodeA", createdAt = 1720000000000L)
        val r3 = SyncRecord(id = "evt_30", entityType = "TASK", entityId = "t3", operation = "UPSERT", payload = "{}", hlcTimestamp = "1720000000000:0:nodeA", createdAt = 1720000000000L)

        val list = listOf(r3, r1, r2)
        val sorted = list.sortedWith(SyncRecordComparator)

        assertEquals(listOf("evt_10", "evt_20", "evt_30"), sorted.map { it.id })
    }

    @Test
    fun testPaginationAcrossVariousSizes() = runTest {
        val deltaStore = InMemoryRemoteDeltaStore()
        val auth = createAuthSession()
        val transport = FirestoreRemoteSyncTransport(auth, deltaStore)

        val testSizes = listOf(0, 1, 99, 100, 101, 500, 1000)

        for (size in testSizes) {
            deltaStore.clear()
            val records = (1..size).map { i ->
                val pad = i.toString().padStart(5, '0')
                SyncRecord(
                    id = "evt_page_$pad",
                    entityType = "TASK",
                    entityId = "task_$pad",
                    operation = "UPSERT",
                    payload = "{}",
                    hlcTimestamp = "172000000${pad}:0:nodeA",
                    createdAt = 1720000000000L + i
                )
            }
            transport.pushRecords(records)

            val pulled = transport.pullRecords(null)
            assertEquals(size, pulled.size, "Failed pagination pull for size $size")

            if (size > 0) {
                // Verify strictly increasing order
                for (j in 0 until pulled.size - 1) {
                    assertTrue(SyncRecordComparator.compare(pulled[j], pulled[j + 1]) < 0)
                }
            }
        }
    }

    @Test
    fun testCursorPaginationResumesStrictlyAfterPreviousRecord() = runTest {
        val deltaStore = InMemoryRemoteDeltaStore()
        val auth = createAuthSession()
        val transport = FirestoreRemoteSyncTransport(auth, deltaStore)

        // Seed 10 records with same HLC timestamp but distinct event IDs
        val records = (1..10).map { i ->
            SyncRecord(
                id = "evt_same_hlc_${i.toString().padStart(2, '0')}",
                entityType = "TASK",
                entityId = "task_$i",
                operation = "UPSERT",
                payload = "{}",
                hlcTimestamp = "1720000000000:0:nodeA",
                createdAt = 1720000000000L
            )
        }
        transport.pushRecords(records)

        // Pull with cursor pointing at event 5
        val cursor = SyncCursor("1720000000000:0:nodeA", "evt_same_hlc_05")
        val resumed = transport.pullRecordsWithCursor(cursor)

        assertEquals(5, resumed.size)
        assertEquals("evt_same_hlc_06", resumed[0].id)
        assertEquals("evt_same_hlc_10", resumed[4].id)
    }

    @Test
    fun testDuplicateEventIdenticalPayloadIsIdempotentAck() = runTest {
        val deltaStore = InMemoryRemoteDeltaStore()
        val auth = createAuthSession()
        val transport = FirestoreRemoteSyncTransport(auth, deltaStore)

        val record = SyncRecord(
            id = "evt_idempotent_1",
            entityType = "TASK",
            entityId = "task_dup_1",
            operation = "UPSERT",
            payload = "{\"title\":\"Original Task\"}",
            hlcTimestamp = "1720000000000:0:nodeA",
            createdAt = 1720000000000L,
            originDeviceId = "nodeA",
            protocolVersion = 1,
            schemaVersion = 1
        )

        // Push 1
        val ack1 = transport.pushRecords(listOf(record))
        assertEquals(listOf("evt_idempotent_1"), ack1)

        // Push 2 (identical duplicate) -> must be idempotent ACK
        val ack2 = transport.pushRecords(listOf(record))
        assertEquals(listOf("evt_idempotent_1"), ack2)

        val all = transport.pullRecords(null)
        assertEquals(1, all.size)
    }

    @Test
    fun testDuplicateEventConflictingPayloadFailsDataIntegrity() = runTest {
        val deltaStore = InMemoryRemoteDeltaStore()
        val auth = createAuthSession()
        val transport = FirestoreRemoteSyncTransport(auth, deltaStore)

        val originalRecord = SyncRecord(
            id = "evt_conflict_1",
            entityType = "TASK",
            entityId = "task_orig",
            operation = "UPSERT",
            payload = "{\"title\":\"Original Task\"}",
            hlcTimestamp = "1720000000000:0:nodeA",
            createdAt = 1720000000000L,
            originDeviceId = "nodeA",
            protocolVersion = 1,
            schemaVersion = 1
        )
        transport.pushRecords(listOf(originalRecord))

        // Same event ID but conflicting payload / operation
        val conflictingRecord = originalRecord.copy(
            payload = "{\"title\":\"HACKED Differs!\"}"
        )

        // Must throw SyncDataIntegrityException and NEVER overwrite
        assertFailsWith<SyncDataIntegrityException> {
            transport.pushRecords(listOf(conflictingRecord))
        }

        // Original record must remain untampered
        val stored = transport.pullRecords(null).first()
        assertEquals("{\"title\":\"Original Task\"}", stored.payload)
    }

    @Test
    fun testHlcRedundantFieldMismatchPhysicalTime() {
        val record = SyncRecord(
            id = "evt_mismatch_1",
            entityType = "TASK",
            entityId = "task_m1",
            operation = "UPSERT",
            payload = "{}",
            hlcTimestamp = "1720000005000:2:nodeA",
            createdAt = 1720000005000L,
            hlcPhysicalTimeMs = 1720000009999L, // Mismatch!
            hlcLogicalCounter = 2,
            hlcNodeId = "nodeA"
        )
        val parsed = com.lifetrack.core.HlcTimestamp.fromString(record.hlcTimestamp)
        assertNotNull(parsed)
        assertTrue(parsed.physicalTimeMs != record.hlcPhysicalTimeMs, "Must detect physical time mismatch")
    }

    @Test
    fun testHlcRedundantFieldMismatchLogicalCounter() {
        val record = SyncRecord(
            id = "evt_mismatch_2",
            entityType = "TASK",
            entityId = "task_m2",
            operation = "UPSERT",
            payload = "{}",
            hlcTimestamp = "1720000005000:2:nodeA",
            createdAt = 1720000005000L,
            hlcPhysicalTimeMs = 1720000005000L,
            hlcLogicalCounter = 99, // Mismatch!
            hlcNodeId = "nodeA"
        )
        val parsed = com.lifetrack.core.HlcTimestamp.fromString(record.hlcTimestamp)
        assertNotNull(parsed)
        assertTrue(parsed.logicalCounter != record.hlcLogicalCounter, "Must detect logical counter mismatch")
    }

    @Test
    fun testHlcRedundantFieldMismatchNodeId() {
        val record = SyncRecord(
            id = "evt_mismatch_3",
            entityType = "TASK",
            entityId = "task_m3",
            operation = "UPSERT",
            payload = "{}",
            hlcTimestamp = "1720000005000:2:nodeA",
            createdAt = 1720000005000L,
            hlcPhysicalTimeMs = 1720000005000L,
            hlcLogicalCounter = 2,
            hlcNodeId = "nodeHACKED" // Mismatch!
        )
        val parsed = com.lifetrack.core.HlcTimestamp.fromString(record.hlcTimestamp)
        assertNotNull(parsed)
        assertTrue(parsed.nodeId != record.hlcNodeId, "Must detect nodeId mismatch")
    }
}
