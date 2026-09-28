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
    val errorMessage: String? = null
)

data class SyncRecord(
    val id: String,
    val entityType: String,
    val entityId: String,
    val operation: String, // UPSERT or DELETE
    val payloadEncrypted: ByteArray,
    val hlcTimestamp: String,
    val createdAt: Long,
    val retryCount: Int = 0,
    val lastError: String? = null,
    val status: String = "PENDING"
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as SyncRecord

        if (id != other.id) return false
        if (entityType != other.entityType) return false
        if (entityId != other.entityId) return false
        if (operation != other.operation) return false
        if (!payloadEncrypted.contentEquals(other.payloadEncrypted)) return false
        if (hlcTimestamp != other.hlcTimestamp) return false
        if (createdAt != other.createdAt) return false
        if (retryCount != other.retryCount) return false
        if (lastError != other.lastError) return false
        if (status != other.status) return false

        return true
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + entityType.hashCode()
        result = 31 * result + entityId.hashCode()
        result = 31 * result + operation.hashCode()
        result = 31 * result + payloadEncrypted.contentHashCode()
        result = 31 * result + hlcTimestamp.hashCode()
        result = 31 * result + createdAt.hashCode()
        result = 31 * result + retryCount.hashCode()
        result = 31 * result + (lastError?.hashCode() ?: 0)
        result = 31 * result + status.hashCode()
        return result
    }
}

/**
 * Architectural abstraction for the multi-device sync engine.
 */
interface SyncEngine {
    val syncStatus: StateFlow<SyncStatus>
    suspend fun triggerSync()
    suspend fun setOffline(offline: Boolean)
}

/**
 * Remote transport contract for sending and receiving delta sync packets.
 */
interface RemoteSyncTransport {
    suspend fun pushRecords(records: List<SyncRecord>): List<String> // Returns IDs of successfully synced records
    suspend fun pullRecords(sinceHlc: String?): List<SyncRecord>
}

/**
 * Local outbox queue abstraction for offline delta synchronization.
 */
interface SyncRepository {
    fun getPendingOutboxRecords(): Flow<List<SyncRecord>>
    suspend fun enqueueRecord(record: SyncRecord)
    suspend fun removeRecords(recordIds: List<String>)
    suspend fun getHlcMaxTimestamp(): String?
    suspend fun updateRecordStatus(recordId: String, status: String, retryCount: Int, errorMessage: String? = null)
    suspend fun getAllRecords(): List<SyncRecord>
}
