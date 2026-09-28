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
 * Single sync-outbox mutation event.
 * Note on encryption: In Phase 2B.1, payload is serialized plaintext representing
 * task/subtask delta records. Cryptographic payload encryption is explicitly deferred to Phase 3.
 */
data class SyncRecord(
    val id: String,
    val entityType: String,
    val entityId: String,
    val operation: String, // "UPSERT" or "DELETE"
    val payload: String,
    val hlcTimestamp: String,
    val createdAt: Long,
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
