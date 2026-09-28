package com.lifetrack.sync

import com.lifetrack.data.local.db.SqlCursor
import com.lifetrack.data.local.db.SqlDriver
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Production-ready durable SyncRepository storing outbox mutations and sync state checkpoints
 * in local SQLite tables.
 *
 * Guarantees:
 * 1. Safe in-flight state tracking and crash recovery.
 * 2. Bounded exponential retry backoff.
 * 3. Manual and batch failed-record requeueing.
 * 4. Automatic entity `is_sync_pending` clearing upon remote ACK ONLY when no other pending
 *    edits remain for the same entity.
 * 5. Durable remote sync checkpoint persistence.
 */
class PersistentSyncRepository(
    private val driver: SqlDriver
) : SyncRepository {

    private val mutex = Mutex()
    private val pendingOutboxFlow = MutableStateFlow<List<SyncRecord>>(emptyList())

    init {
        refreshFlow()
    }

    override fun getPendingOutboxRecords(): Flow<List<SyncRecord>> = kotlinx.coroutines.flow.flow {
        emit(queryPendingRecords())
        pendingOutboxFlow.collect {
            emit(queryPendingRecords())
        }
    }

    override suspend fun getEligibleOutboxRecords(currentTimeMs: Long): List<SyncRecord> = mutex.withLock {
        driver.query(
            """
            SELECT id, entity_type, entity_id, operation, payload,
                   hlc_timestamp, created_at, origin_device_id, protocol_version, schema_version,
                   status, in_flight_at, retry_count, next_retry_at, last_error
            FROM sync_outbox
            WHERE status = 'PENDING' AND next_retry_at <= ?
            ORDER BY created_at ASC;
            """.trimIndent(),
            arrayOf(currentTimeMs)
        ) { cursor ->
            mapCursorToRecord(cursor)
        }
    }

    override suspend fun enqueueRecord(record: SyncRecord): Unit = mutex.withLock {
        driver.execute(
            """
            INSERT OR REPLACE INTO sync_outbox (
                id, entity_type, entity_id, operation, payload,
                hlc_timestamp, created_at, origin_device_id, protocol_version, schema_version,
                status, in_flight_at, retry_count, next_retry_at, last_error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """.trimIndent(),
            arrayOf(
                record.id,
                record.entityType,
                record.entityId,
                record.operation,
                record.payload,
                record.hlcTimestamp,
                record.createdAt,
                record.originDeviceId,
                record.protocolVersion,
                record.schemaVersion,
                record.status,
                record.inFlightAt,
                record.retryCount,
                record.nextRetryAt,
                record.lastError
            )
        )
        refreshFlow()
    }

    override suspend fun markInFlight(recordIds: List<String>, inFlightTimeMs: Long): Unit = mutex.withLock {
        if (recordIds.isEmpty()) return
        driver.transaction {
            for (id in recordIds) {
                driver.execute(
                    "UPDATE sync_outbox SET status = 'IN_FLIGHT', in_flight_at = ? WHERE id = ?;",
                    arrayOf(inFlightTimeMs, id)
                )
            }
        }
        refreshFlow()
    }

    override suspend fun recoverStaleInFlightRecords(leaseTimeoutMs: Long, currentTimeMs: Long): Unit = mutex.withLock {
        val cutoff = currentTimeMs - leaseTimeoutMs
        driver.execute(
            """
            UPDATE sync_outbox
            SET status = 'PENDING', in_flight_at = NULL
            WHERE status = 'IN_FLIGHT' AND (in_flight_at IS NULL OR in_flight_at <= ?);
            """.trimIndent(),
            arrayOf(cutoff)
        )
        refreshFlow()
    }

    override suspend fun recordSuccessAcks(acknowledgedIds: List<String>): Unit = mutex.withLock {
        if (acknowledgedIds.isEmpty()) return
        driver.transaction {
            for (id in acknowledgedIds) {
                // Find entity info
                val entityInfo = driver.query(
                    "SELECT entity_type, entity_id FROM sync_outbox WHERE id = ? LIMIT 1;",
                    arrayOf(id)
                ) { cursor ->
                    cursor.getString(0) to cursor.getString(1)
                }.firstOrNull()

                // Delete acknowledged record first
                driver.execute(
                    "DELETE FROM sync_outbox WHERE id = ?;",
                    arrayOf(id)
                )

                // Critical fix (Requirement 14): Only clear is_sync_pending if NO other outbox events remain for this entity
                if (entityInfo != null && entityInfo.first == "TASK" && entityInfo.second != null) {
                    val remainingCount = driver.query(
                        "SELECT COUNT(*) FROM sync_outbox WHERE entity_type = ? AND entity_id = ?;",
                        arrayOf(entityInfo.first, entityInfo.second)
                    ) { cursor ->
                        cursor.getInt(0) ?: 0
                    }.firstOrNull() ?: 0

                    if (remainingCount == 0) {
                        driver.execute(
                            "UPDATE tasks SET is_sync_pending = 0 WHERE id = ?;",
                            arrayOf(entityInfo.second)
                        )
                    }
                }
            }
        }
        refreshFlow()
    }

    override suspend fun recordFailures(
        failedIds: List<String>,
        error: String,
        currentTimeMs: Long,
        maxRetries: Int
    ): Unit = mutex.withLock {
        if (failedIds.isEmpty()) return
        driver.transaction {
            for (id in failedIds) {
                val currentRetry = driver.query(
                    "SELECT retry_count FROM sync_outbox WHERE id = ? LIMIT 1;",
                    arrayOf(id)
                ) { cursor ->
                    cursor.getInt(0) ?: 0
                }.firstOrNull() ?: 0

                val newRetry = currentRetry + 1
                val delay = minOf(60_000L, 1000L * (1L shl minOf(newRetry - 1, 10)))
                val nextRetryAt = currentTimeMs + delay
                val nextStatus = if (newRetry >= maxRetries) "FAILED" else "PENDING"

                driver.execute(
                    """
                    UPDATE sync_outbox
                    SET retry_count = ?, next_retry_at = ?, last_error = ?, status = ?
                    WHERE id = ?;
                    """.trimIndent(),
                    arrayOf(newRetry, nextRetryAt, error, nextStatus, id)
                )
            }
        }
        refreshFlow()
    }

    override suspend fun retryFailedRecord(recordId: String): Unit = mutex.withLock {
        driver.execute(
            """
            UPDATE sync_outbox
            SET status = 'PENDING', retry_count = 0, next_retry_at = 0, in_flight_at = NULL, last_error = NULL
            WHERE id = ?;
            """.trimIndent(),
            arrayOf(recordId)
        )
        refreshFlow()
    }

    override suspend fun retryAllFailed(): Unit = mutex.withLock {
        driver.execute(
            """
            UPDATE sync_outbox
            SET status = 'PENDING', retry_count = 0, next_retry_at = 0, in_flight_at = NULL, last_error = NULL
            WHERE status = 'FAILED';
            """.trimIndent()
        )
        refreshFlow()
    }

    override suspend fun getSyncCheckpoint(deviceId: String): String? = mutex.withLock {
        driver.query(
            "SELECT last_pulled_hlc FROM sync_state WHERE device_id = ? LIMIT 1;",
            arrayOf(deviceId)
        ) { cursor ->
            cursor.getString(0)
        }.firstOrNull()
    }

    override suspend fun updateSyncCheckpoint(
        deviceId: String,
        lastPulledHlc: String,
        syncTimeMs: Long,
        error: String?
    ): Unit = mutex.withLock {
        driver.execute(
            """
            INSERT OR REPLACE INTO sync_state (
                device_id, last_pulled_hlc, last_successful_sync_time, last_error
            ) VALUES (?, ?, ?, ?);
            """.trimIndent(),
            arrayOf(deviceId, lastPulledHlc, syncTimeMs, error)
        )
    }

    override suspend fun getAllRecords(): List<SyncRecord> = mutex.withLock {
        driver.query(
            """
            SELECT id, entity_type, entity_id, operation, payload,
                   hlc_timestamp, created_at, origin_device_id, protocol_version, schema_version,
                   status, in_flight_at, retry_count, next_retry_at, last_error
            FROM sync_outbox
            ORDER BY created_at ASC;
            """.trimIndent()
        ) { cursor ->
            mapCursorToRecord(cursor)
        }
    }

    private fun refreshFlow() {
        pendingOutboxFlow.value = queryPendingRecords()
    }

    private fun queryPendingRecords(): List<SyncRecord> {
        return driver.query(
            """
            SELECT id, entity_type, entity_id, operation, payload,
                   hlc_timestamp, created_at, origin_device_id, protocol_version, schema_version,
                   status, in_flight_at, retry_count, next_retry_at, last_error
            FROM sync_outbox
            WHERE status = 'PENDING'
            ORDER BY created_at ASC;
            """.trimIndent()
        ) { cursor ->
            mapCursorToRecord(cursor)
        }
    }

    private fun mapCursorToRecord(cursor: SqlCursor): SyncRecord {
        return SyncRecord(
            id = cursor.getString(0) ?: "",
            entityType = cursor.getString(1) ?: "",
            entityId = cursor.getString(2) ?: "",
            operation = cursor.getString(3) ?: "",
            payload = cursor.getString(4) ?: "",
            hlcTimestamp = cursor.getString(5) ?: "",
            createdAt = cursor.getLong(6) ?: 0L,
            originDeviceId = cursor.getString(7) ?: "unknown-device",
            protocolVersion = cursor.getInt(8) ?: 1,
            schemaVersion = cursor.getInt(9) ?: 1,
            status = cursor.getString(10) ?: "PENDING",
            inFlightAt = cursor.getLong(11),
            retryCount = cursor.getInt(12) ?: 0,
            nextRetryAt = cursor.getLong(13) ?: 0L,
            lastError = cursor.getString(14)
        )
    }
}
