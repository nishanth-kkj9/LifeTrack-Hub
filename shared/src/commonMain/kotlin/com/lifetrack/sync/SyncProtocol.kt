package com.lifetrack.sync

enum class SyncStatus {
    IDLE,
    SYNCING,
    SUCCESS,
    OFFLINE,
    ERROR
}

data class SyncResult(
    val status: SyncStatus,
    val uploadedRecords: Int = 0,
    val downloadedRecords: Int = 0,
    val conflictRecords: Int = 0,
    val errorMessage: String? = null
)

interface SyncManager {
    fun observeSyncStatus(): kotlinx.coroutines.flow.Flow<SyncStatus>
    suspend fun synchronize(): SyncResult
}
