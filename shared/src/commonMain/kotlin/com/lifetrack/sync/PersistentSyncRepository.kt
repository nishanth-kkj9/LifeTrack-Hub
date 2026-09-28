package com.lifetrack.sync

import com.lifetrack.data.local.db.SqlDriver
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Production-ready durable SyncRepository storing outbox sync mutations in SQLite/relational tables.
 * Guarantees outbox survival across process restarts, crashes, and network disconnects.
 */
class PersistentSyncRepository(
    private val driver: SqlDriver
) : SyncRepository {

    private val mutex = Mutex()
    private val pendingOutboxFlow = MutableStateFlow<List<SyncRecord>>(emptyList())

    init {
        refreshFlow()
    }

    override fun getPendingOutboxRecords(): Flow<List<SyncRecord>> =
        pendingOutboxFlow.asStateFlow()

    override suspend fun enqueueRecord(record: SyncRecord) {
        mutex.withLock {
            val payloadString = record.payloadEncrypted.decodeToString()
            driver.execute(
                """
                INSERT OR REPLACE INTO sync_outbox (
                    id, entity_type, entity_id, operation, payload_encrypted,
                    hlc_timestamp, created_at, retry_count, last_error, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """.trimIndent(),
                arrayOf(
                    record.id,
                    record.entityType,
                    record.entityId,
                    record.operation,
                    payloadString,
                    record.hlcTimestamp,
                    record.createdAt,
                    record.retryCount,
                    record.lastError,
                    record.status
                )
            )
            refreshFlow()
        }
    }

    override suspend fun removeRecords(recordIds: List<String>) {
        if (recordIds.isEmpty()) return
        mutex.withLock {
            driver.transaction {
                for (id in recordIds) {
                    driver.execute(
                        "DELETE FROM sync_outbox WHERE id = ?;",
                        arrayOf(id)
                    )
                }
            }
            refreshFlow()
        }
    }

    override suspend fun updateRecordStatus(
        recordId: String,
        status: String,
        retryCount: Int,
        errorMessage: String?
    ) {
        mutex.withLock {
            driver.execute(
                """
                UPDATE sync_outbox SET status = ?, retry_count = ?, last_error = ? WHERE id = ?;
                """.trimIndent(),
                arrayOf(status, retryCount, errorMessage, recordId)
            )
            refreshFlow()
        }
    }

    override suspend fun getHlcMaxTimestamp(): String? {
        return mutex.withLock {
            val records = queryAllFromDb()
            records.map { it.hlcTimestamp }.maxOrNull()
        }
    }

    override suspend fun getAllRecords(): List<SyncRecord> {
        return mutex.withLock {
            queryAllFromDb()
        }
    }

    private fun refreshFlow() {
        val pending = queryPendingFromDb()
        pendingOutboxFlow.value = pending
    }

    private fun queryPendingFromDb(): List<SyncRecord> {
        return driver.query(
            """
            SELECT id, entity_type, entity_id, operation, payload_encrypted,
                   hlc_timestamp, created_at, retry_count, last_error, status
            FROM sync_outbox
            WHERE status = ?
            ORDER BY created_at ASC;
            """.trimIndent(),
            arrayOf("PENDING")
        ) { cursor ->
            mapCursorToRecord(cursor)
        }
    }

    private fun queryAllFromDb(): List<SyncRecord> {
        return driver.query(
            """
            SELECT id, entity_type, entity_id, operation, payload_encrypted,
                   hlc_timestamp, created_at, retry_count, last_error, status
            FROM sync_outbox
            ORDER BY created_at ASC;
            """.trimIndent()
        ) { cursor ->
            mapCursorToRecord(cursor)
        }
    }

    private fun mapCursorToRecord(cursor: com.lifetrack.data.local.db.SqlCursor): SyncRecord {
        val id = cursor.getString(0).orEmpty()
        val entityType = cursor.getString(1).orEmpty()
        val entityId = cursor.getString(2).orEmpty()
        val operation = cursor.getString(3).orEmpty()
        val payloadStr = cursor.getString(4).orEmpty()
        val hlcTimestamp = cursor.getString(5).orEmpty()
        val createdAt = cursor.getLong(6) ?: 0L
        val retryCount = cursor.getInt(7) ?: 0
        val lastError = cursor.getString(8)
        val status = cursor.getString(9) ?: "PENDING"

        return SyncRecord(
            id = id,
            entityType = entityType,
            entityId = entityId,
            operation = operation,
            payloadEncrypted = payloadStr.encodeToByteArray(),
            hlcTimestamp = hlcTimestamp,
            createdAt = createdAt,
            retryCount = retryCount,
            lastError = lastError,
            status = status
        )
    }
}
