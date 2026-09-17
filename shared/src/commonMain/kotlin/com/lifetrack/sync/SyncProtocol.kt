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
    val createdAt: Long
)

/**
 * Architectural abstraction for the multi-device sync engine.
 */
interface SyncEngine {
    val syncStatus: StateFlow<SyncStatus>
    suspend fun triggerSync()
    suspend fun setOffline(offline: Boolean)
}

/**
 * Local outbox queue abstraction for offline delta synchronization.
 */
interface SyncRepository {
    fun getPendingOutboxRecords(): Flow<List<SyncRecord>>
    suspend fun enqueueRecord(record: SyncRecord)
    suspend fun removeRecords(recordIds: List<String>)
    suspend fun getHlcMaxTimestamp(): String?
}
