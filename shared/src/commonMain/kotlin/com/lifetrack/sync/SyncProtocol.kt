package com.lifetrack.sync

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

enum class SyncState {
    IDLE,
    SYNCING,
    OFFLINE,
    ERROR,
    SUCCESS
}

data class SyncStatus(
    val state: SyncState = SyncState.IDLE,
    val lastSyncedTimestamp: Long? = null,
    val pendingOutboxCount: Int = 0,
    val activeDeviceName: String = "Local Device",
    val lastCheckpointHlc: String? = null,
    val errorMessage: String? = null
)

/**
 * Single sync-outbox mutation event adhering to the Phase 2C canonical delta contract.
 *
 * Contract fields:
 * - id: Deterministic event ID / idempotency key.
 * - entityType: Target entity type (e.g. "TASK", "SUBTASK").
 * - entityId: Target entity identifier.
 * - operation: "UPSERT" or "DELETE".
 * - payload: Serialized delta payload.
 * - hlcTimestamp: Hybrid Logical Clock timestamp.
 * - createdAt: Epoch timestamp in milliseconds.
 * - originDeviceId: Stable unique identifier of the originating device.
 * - protocolVersion: Protocol wire version (currently 1).
 * - schemaVersion: Entity payload schema version (currently 1).
 */
data class SyncRecord(
    val id: String,
    val entityType: String,
    val entityId: String,
    val operation: String, // "UPSERT" or "DELETE"
    val payload: String,
    val hlcTimestamp: String,
    val createdAt: Long,
    val originDeviceId: String = "unknown-device",
    val protocolVersion: Int = 1,
    val schemaVersion: Int = 1,
    val status: String = "PENDING", // "PENDING", "IN_FLIGHT", "FAILED"
    val inFlightAt: Long? = null,
    val retryCount: Int = 0,
    val nextRetryAt: Long = 0L,
    val lastError: String? = null
) {
    /**
     * Backward-compatibility accessor for tests or legacy code expecting byte array.
     */
    val payloadEncrypted: ByteArray
        get() = payload.encodeToByteArray()

    val hlcPhysicalTimeMs: Long
        get() = com.lifetrack.core.HlcTimestamp.fromString(hlcTimestamp)?.physicalTimeMs ?: createdAt

    val hlcLogicalCounter: Int
        get() = com.lifetrack.core.HlcTimestamp.fromString(hlcTimestamp)?.logicalCounter ?: 0

    val hlcNodeId: String
        get() = com.lifetrack.core.HlcTimestamp.fromString(hlcTimestamp)?.nodeId ?: originDeviceId
}

/**
 * Hard protocol data integrity violation error, e.g. when a duplicate event ID
 * is encountered remotely with a differing immutable payload.
 */
class SyncDataIntegrityException(message: String) : Exception(message)

/**
 * Deterministic remote sync cursor based on (lastHlc, lastEventId) to avoid pagination
 * ambiguity when multiple records share the exact same HLC timestamp.
 */
data class SyncCursor(
    val lastHlc: String,
    val lastEventId: String = ""
) {
    fun toCheckpointString(): String = if (lastEventId.isNotBlank()) "$lastHlc|$lastEventId" else lastHlc

    companion object {
        fun fromCheckpointString(str: String?): SyncCursor? {
            if (str.isNullOrBlank()) return null
            val parts = str.split("|")
            return if (parts.size >= 2) {
                SyncCursor(parts[0], parts[1])
            } else {
                SyncCursor(parts[0], "")
            }
        }
    }
}

/**
 * Boundary contract supplying the authenticated user session for remote cloud transport.
 */
interface AuthSessionProvider {
    fun getCurrentUserUid(): String?
    suspend fun getIdToken(forceRefresh: Boolean = false): String? = null
    fun getIdTokenSync(): String? = null
}

/**
 * Architectural abstraction for the multi-device sync engine.
 */
interface SyncEngine {
    val syncStatus: StateFlow<SyncStatus>
    suspend fun triggerSync()
    suspend fun setOffline(offline: Boolean)
    suspend fun retryFailedRecord(recordId: String)
    suspend fun retryAllFailed()
}

/**
 * Remote transport contract for sending and receiving delta sync packets.
 */
interface RemoteSyncTransport {
    suspend fun pushRecords(records: List<SyncRecord>): List<String>
    suspend fun pullRecords(sinceHlc: String?): List<SyncRecord>
    suspend fun pullRecordsWithCursor(cursor: SyncCursor?, pageSize: Int = 100): List<SyncRecord> {
        return pullRecords(cursor?.lastHlc)
    }
}

/**
 * Local outbox queue and durable sync-state abstraction.
 */
interface SyncRepository {
    fun getPendingOutboxRecords(): Flow<List<SyncRecord>>
    suspend fun getEligibleOutboxRecords(currentTimeMs: Long): List<SyncRecord>
    suspend fun enqueueRecord(record: SyncRecord)
    suspend fun markInFlight(recordIds: List<String>, inFlightTimeMs: Long)
    suspend fun recoverStaleInFlightRecords(leaseTimeoutMs: Long, currentTimeMs: Long)
    suspend fun recordSuccessAcks(acknowledgedIds: List<String>)
    suspend fun recordFailures(failedIds: List<String>, error: String, currentTimeMs: Long, maxRetries: Int = 5)
    suspend fun retryFailedRecord(recordId: String)
    suspend fun retryAllFailed()
    suspend fun getSyncCheckpoint(deviceId: String): String?
    suspend fun updateSyncCheckpoint(deviceId: String, lastPulledHlc: String, syncTimeMs: Long, error: String? = null)
    suspend fun getAllRecords(): List<SyncRecord>
}
