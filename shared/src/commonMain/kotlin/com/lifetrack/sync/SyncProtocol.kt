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
}

/**
 * Boundary contract supplying the authenticated user session for remote cloud transport.
 */
interface AuthSessionProvider {
    fun getCurrentUserUid(): String?
    fun getIdToken(): String? = null
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
