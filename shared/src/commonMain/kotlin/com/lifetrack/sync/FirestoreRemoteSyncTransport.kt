package com.lifetrack.sync

import com.lifetrack.core.HlcTimestamp

/**
 * Deterministic comparator for remote sync delta records based on (hlcTimestamp, id).
 */
object SyncRecordComparator : Comparator<SyncRecord> {
    override fun compare(a: SyncRecord, b: SyncRecord): Int {
        val hlcA = HlcTimestamp.fromString(a.hlcTimestamp)
        val hlcB = HlcTimestamp.fromString(b.hlcTimestamp)
        if (hlcA != null && hlcB != null) {
            val cmp = hlcA.compareTo(hlcB)
            if (cmp != 0) return cmp
        } else if (a.hlcTimestamp != b.hlcTimestamp) {
            val cmp = a.hlcTimestamp.compareTo(b.hlcTimestamp)
            if (cmp != 0) return cmp
        }
        return a.id.compareTo(b.id)
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
            // Idempotency: writing the same document ID twice stores exactly one document
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
