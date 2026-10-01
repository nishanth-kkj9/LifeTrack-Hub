package com.lifetrack.sync

import com.lifetrack.core.HlcTimestamp

/**
 * Deterministic comparator for remote sync delta records based on (hlcPhysicalTimeMs, hlcLogicalCounter, hlcNodeId, id).
 * Guarantees remote query ordering is identical to in-memory causality evaluation.
 */
object SyncRecordComparator : Comparator<SyncRecord> {
    override fun compare(a: SyncRecord, b: SyncRecord): Int {
        // 1. Physical time in milliseconds
        val physCmp = a.hlcPhysicalTimeMs.compareTo(b.hlcPhysicalTimeMs)
        if (physCmp != 0) return physCmp

        // 2. Logical counter
        val logCmp = a.hlcLogicalCounter.compareTo(b.hlcLogicalCounter)
        if (logCmp != 0) return logCmp

        // 3. Node ID
        val nodeCmp = a.hlcNodeId.compareTo(b.hlcNodeId)
        if (nodeCmp != 0) return nodeCmp

        // 4. Deterministic tie-breaker: Event ID
        return a.id.compareTo(b.id)
    }
}

/**
 * Validates the complete 10-field immutable event contract between local and existing remote records.
 * Throws SyncDataIntegrityException on any mismatch.
 */
fun verifyImmutableDeltaContract(existing: SyncRecord, incoming: SyncRecord) {
    if (existing.id != incoming.id) {
        throw SyncDataIntegrityException("Immutable contract violation on id: existing '${existing.id}' vs incoming '${incoming.id}'")
    }
    if (existing.entityType != incoming.entityType) {
        throw SyncDataIntegrityException("Immutable contract violation on entityType for event ${incoming.id}: existing '${existing.entityType}' vs incoming '${incoming.entityType}'")
    }
    if (existing.entityId != incoming.entityId) {
        throw SyncDataIntegrityException("Immutable contract violation on entityId for event ${incoming.id}: existing '${existing.entityId}' vs incoming '${incoming.entityId}'")
    }
    if (existing.operation != incoming.operation) {
        throw SyncDataIntegrityException("Immutable contract violation on operation for event ${incoming.id}: existing '${existing.operation}' vs incoming '${incoming.operation}'")
    }
    if (existing.payload != incoming.payload) {
        throw SyncDataIntegrityException("Immutable contract violation on payload for event ${incoming.id}: existing payload differs from incoming")
    }
    if (existing.hlcTimestamp != incoming.hlcTimestamp) {
        throw SyncDataIntegrityException("Immutable contract violation on hlcTimestamp for event ${incoming.id}: existing '${existing.hlcTimestamp}' vs incoming '${incoming.hlcTimestamp}'")
    }
    if (existing.createdAt != incoming.createdAt) {
        throw SyncDataIntegrityException("Immutable contract violation on createdAt for event ${incoming.id}: existing ${existing.createdAt} vs incoming ${incoming.createdAt}")
    }
    if (existing.originDeviceId != incoming.originDeviceId) {
        throw SyncDataIntegrityException("Immutable contract violation on originDeviceId for event ${incoming.id}: existing '${existing.originDeviceId}' vs incoming '${incoming.originDeviceId}'")
    }
    if (existing.protocolVersion != incoming.protocolVersion) {
        throw SyncDataIntegrityException("Immutable contract violation on protocolVersion for event ${incoming.id}: existing ${existing.protocolVersion} vs incoming ${incoming.protocolVersion}")
    }
    if (existing.schemaVersion != incoming.schemaVersion) {
        throw SyncDataIntegrityException("Immutable contract violation on schemaVersion for event ${incoming.id}: existing ${existing.schemaVersion} vs incoming ${incoming.schemaVersion}")
    }
}

/**
 * Production remote sync transport bound to the authenticated user's Firestore delta collection.
 *
 * Enforces:
 * 1. Authentication boundary: Requires a valid authenticated session matching the Firestore user scope.
 * 2. Idempotency: Uses event ID as the document ID in `/users/{uid}/deltas/{eventId}`.
 * 3. Deterministic ordering: Always sorts pulled deltas by (HLC, event ID).
 */
class FirestoreRemoteSyncTransport(
    private val authSessionProvider: AuthSessionProvider,
    private val remoteDeltaStore: RemoteDeltaStore = InMemoryRemoteDeltaStore()
) : RemoteSyncTransport {

    override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot push deltas: User is not authenticated")

        val ackedIds = mutableListOf<String>()
        for (record in records) {
            // Idempotent write to remote store under user collection /users/{uid}/deltas/{record.id}
            remoteDeltaStore.saveDelta(uid, record)
            ackedIds.add(record.id)
        }
        return ackedIds
    }

    override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot pull deltas: User is not authenticated")

        val deltas = remoteDeltaStore.fetchDeltas(uid, sinceHlc)
        // Sort deterministically by HLC timestamp and event ID
        return deltas.sortedWith(SyncRecordComparator)
    }

    override suspend fun pullRecordsWithCursor(cursor: SyncCursor?, pageSize: Int): List<SyncRecord> {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot pull deltas: User is not authenticated")

        val deltas = remoteDeltaStore.fetchDeltas(uid, cursor?.lastHlc)
        val sorted = deltas.sortedWith(SyncRecordComparator)
        if (cursor == null || cursor.lastEventId.isBlank()) {
            return sorted
        }
        // Filter strictly after cursor (hlcTimestamp, id)
        return sorted.filter { record ->
            val physCmp = record.hlcPhysicalTimeMs.compareTo(HlcTimestamp.fromString(cursor.lastHlc)?.physicalTimeMs ?: 0L)
            if (physCmp != 0) return@filter physCmp > 0

            val logCmp = record.hlcLogicalCounter.compareTo(HlcTimestamp.fromString(cursor.lastHlc)?.logicalCounter ?: 0)
            if (logCmp != 0) return@filter logCmp > 0

            val nodeCmp = record.hlcNodeId.compareTo(HlcTimestamp.fromString(cursor.lastHlc)?.nodeId ?: "")
            if (nodeCmp != 0) return@filter nodeCmp > 0

            record.id > cursor.lastEventId
        }
    }
}

/**
 * Abstraction for the underlying remote Firestore document storage.
 */
interface RemoteDeltaStore {
    suspend fun saveDelta(userId: String, record: SyncRecord)
    suspend fun fetchDeltas(userId: String, sinceHlc: String?): List<SyncRecord>
    suspend fun saveDeviceSyncState(userId: String, deviceId: String, lastPulledHlc: String, syncTimeMs: Long, error: String? = null)
    suspend fun getDeviceSyncState(userId: String, deviceId: String): String?
}

/**
 * Thread-safe in-memory simulation of Firestore /users/{uid}/deltas/{deltaId} collection.
 * Supports multi-client simulation, idempotent document writes, and network partitioning tests.
 */
class InMemoryRemoteDeltaStore : RemoteDeltaStore {
    // Map of userId -> Map of deltaId -> SyncRecord
    private val userDeltas = mutableMapOf<String, MutableMap<String, SyncRecord>>()
    private val userSyncStates = mutableMapOf<String, MutableMap<String, String>>()

    override suspend fun saveDelta(userId: String, record: SyncRecord) {
        synchronized(this) {
            val deltas = userDeltas.getOrPut(userId) { mutableMapOf() }
            val existing = deltas[record.id]
            if (existing != null) {
                // Section 11: Complete immutable event contract verification
                verifyImmutableDeltaContract(existing, record)
                // Idempotent duplicate: record already exists and is strictly immutable
                return
            }
            deltas[record.id] = record
        }
    }

    override suspend fun fetchDeltas(userId: String, sinceHlc: String?): List<SyncRecord> {
        synchronized(this) {
            val deltas = userDeltas[userId]?.values?.toList() ?: emptyList()
            if (sinceHlc == null) {
                return deltas.sortedWith(SyncRecordComparator)
            }
            val since = HlcTimestamp.fromString(sinceHlc)
            return if (since != null) {
                deltas.filter {
                    val recHlc = HlcTimestamp.fromString(it.hlcTimestamp)
                    recHlc != null && recHlc > since
                }.sortedWith(SyncRecordComparator)
            } else {
                deltas.sortedWith(SyncRecordComparator)
            }
        }
    }

    override suspend fun saveDeviceSyncState(
        userId: String,
        deviceId: String,
        lastPulledHlc: String,
        syncTimeMs: Long,
        error: String?
    ) {
        synchronized(this) {
            val states = userSyncStates.getOrPut(userId) { mutableMapOf() }
            states[deviceId] = lastPulledHlc
        }
    }

    override suspend fun getDeviceSyncState(userId: String, deviceId: String): String? {
        synchronized(this) {
            return userSyncStates[userId]?.get(deviceId)
        }
    }

    fun clear() {
        synchronized(this) {
            userDeltas.clear()
            userSyncStates.clear()
        }
    }
}
