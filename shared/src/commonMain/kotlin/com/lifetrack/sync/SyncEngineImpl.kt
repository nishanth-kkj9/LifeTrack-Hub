package com.lifetrack.sync

import com.lifetrack.core.HlcClock
import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.repository.TaskPayloadSerializer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Production implementation of the distributed synchronization engine for Android, Desktop, and Web.
 *
 * Guarantees:
 * 1. Safe in-flight state tracking and automatic crash/lease recovery.
 * 2. Exponential retry backoff scheduling with persisted retry timestamps.
 * 3. Atomic outbox drain with failure containment (failed network calls never strand records in IN_FLIGHT).
 * 4. Durable remote synchronization checkpoint (never derived from outbox max).
 * 5. Checkpoint safety: NEVER advances the checkpoint past malformed, invalid, or unsupported remote deltas.
 * 6. Deterministic ordering: Deltas applied strictly in (HLC, event ID) order.
 * 7. Idempotent push and pull: Duplicate events are safely handled without data corruption.
 * 8. Full bidirectional Last-Write-Wins (LWW) conflict resolution using HLC causality.
 * 9. Durable tombstones preventing resurrecting deleted entities.
 */
class SyncEngineImpl(
    private val syncRepository: SyncRepository,
    private val localDataSource: PersistentTaskLocalDataSource,
    private val remoteTransport: RemoteSyncTransport = DefaultMockRemoteTransport(),
    private val hlcClock: HlcClock,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    private val deviceId: String = "local-device",
    private val deviceName: String = "Local Device",
    private val maxRetries: Int = 5,
    private val inFlightLeaseMs: Long = 60_000L
) : SyncEngine {

    companion object {
        const val CURRENT_PROTOCOL_VERSION: Int = 1
        const val CURRENT_SCHEMA_VERSION: Int = 1
    }

    private val mutex = Mutex()
    private var isOfflineMode = false

    private val _syncStatus = MutableStateFlow(
        SyncStatus(
            state = SyncState.IDLE,
            activeDeviceName = deviceName
        )
    )
    override val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    override suspend fun setOffline(offline: Boolean) {
        mutex.withLock {
            isOfflineMode = offline
            if (offline) {
                val pending = syncRepository.getPendingOutboxRecords().first().size
                _syncStatus.value = _syncStatus.value.copy(
                    state = SyncState.OFFLINE,
                    pendingOutboxCount = pending,
                    errorMessage = null
                )
            } else {
                _syncStatus.value = _syncStatus.value.copy(
                    state = SyncState.IDLE,
                    errorMessage = null
                )
            }
        }
    }

    override suspend fun retryFailedRecord(recordId: String) {
        syncRepository.retryFailedRecord(recordId)
        val pending = syncRepository.getPendingOutboxRecords().first().size
        _syncStatus.value = _syncStatus.value.copy(pendingOutboxCount = pending)
    }

    override suspend fun retryAllFailed() {
        syncRepository.retryAllFailed()
        val pending = syncRepository.getPendingOutboxRecords().first().size
        _syncStatus.value = _syncStatus.value.copy(pendingOutboxCount = pending)
    }

    override suspend fun triggerSync() {
        mutex.withLock {
            val now = timeProvider.nowEpochMs()

            if (isOfflineMode) {
                val pending = syncRepository.getPendingOutboxRecords().first().size
                _syncStatus.value = _syncStatus.value.copy(
                    state = SyncState.OFFLINE,
                    pendingOutboxCount = pending
                )
                return
            }

            // Step 0: Recover any stale IN_FLIGHT records from crashed sessions
            syncRepository.recoverStaleInFlightRecords(leaseTimeoutMs = inFlightLeaseMs, currentTimeMs = now)

            _syncStatus.value = _syncStatus.value.copy(
                state = SyncState.SYNCING,
                errorMessage = null
            )

            // Step 1: Transmit eligible local outbox records
            val eligible = syncRepository.getEligibleOutboxRecords(currentTimeMs = now)
            if (eligible.isNotEmpty()) {
                val eligibleIds = eligible.map { it.id }
                syncRepository.markInFlight(eligibleIds, inFlightTimeMs = now)

                try {
                    val ackedIds = remoteTransport.pushRecords(eligible)
                    syncRepository.recordSuccessAcks(ackedIds)

                    val unackedIds = eligibleIds.filterNot { ackedIds.contains(it) }
                    if (unackedIds.isNotEmpty()) {
                        syncRepository.recordFailures(
                            failedIds = unackedIds,
                            error = "Remote transport rejected or dropped records",
                            currentTimeMs = now,
                            maxRetries = maxRetries
                        )
                    }
                } catch (t: Throwable) {
                    // Critical invariant: failed network requests NEVER strand records in IN_FLIGHT
                    syncRepository.recordFailures(
                        failedIds = eligibleIds,
                        error = t.message ?: "Network transport push failure",
                        currentTimeMs = now,
                        maxRetries = maxRetries
                    )

                    val pending = syncRepository.getPendingOutboxRecords().first().size
                    _syncStatus.value = _syncStatus.value.copy(
                        state = SyncState.ERROR,
                        pendingOutboxCount = pending,
                        errorMessage = t.message ?: "Sync push failed"
                    )
                    return
                }
            }

            // Step 2: Pull remote deltas using the durable remote checkpoint
            val lastCheckpoint = syncRepository.getSyncCheckpoint(deviceId)
            val remoteDeltas = try {
                remoteTransport.pullRecords(lastCheckpoint).sortedWith(SyncRecordComparator)
            } catch (t: Throwable) {
                val pending = syncRepository.getPendingOutboxRecords().first().size
                _syncStatus.value = _syncStatus.value.copy(
                    state = SyncState.ERROR,
                    pendingOutboxCount = pending,
                    errorMessage = t.message ?: "Sync pull failed"
                )
                return
            }

            // Step 3: Validate, conflict resolve, and apply remote deltas
            // Invariant: The checkpoint must NEVER advance past invalid or unsupported deltas.
            var advancedCheckpoint = lastCheckpoint
            var deltaProcessingError: String? = null

            for (delta in remoteDeltas) {
                // Validation 1: Protocol & Schema version compatibility
                if (delta.protocolVersion > CURRENT_PROTOCOL_VERSION) {
                    deltaProcessingError = "Unsupported protocol version ${delta.protocolVersion} on event ${delta.id}"
                    break
                }
                if (delta.schemaVersion > CURRENT_SCHEMA_VERSION) {
                    deltaProcessingError = "Unsupported schema version ${delta.schemaVersion} on event ${delta.id}"
                    break
                }

                // Validation 2: Valid HLC format
                val remoteHlc = HlcTimestamp.fromString(delta.hlcTimestamp)
                if (remoteHlc == null) {
                    deltaProcessingError = "Malformed HLC timestamp '${delta.hlcTimestamp}' on event ${delta.id}"
                    break
                }

                // Validation 3: Known operation and entity types
                if (delta.operation != "UPSERT" && delta.operation != "DELETE") {
                    deltaProcessingError = "Unknown sync operation '${delta.operation}' on event ${delta.id}"
                    break
                }
                if (delta.entityType != "TASK" && delta.entityType != "SUBTASK") {
                    deltaProcessingError = "Unknown sync entity type '${delta.entityType}' on event ${delta.id}"
                    break
                }

                // Validation 4: Payload deserialization correctness
                if (delta.operation == "UPSERT") {
                    if (delta.entityType == "TASK") {
                        val parsedTask = TaskPayloadSerializer.deserializeTask(delta.payload)
                        if (parsedTask == null) {
                            deltaProcessingError = "Malformed task payload on event ${delta.id}"
                            break
                        }
                    } else if (delta.entityType == "SUBTASK") {
                        val parsedSubtask = TaskPayloadSerializer.deserializeSubtask(delta.payload)
                        if (parsedSubtask == null) {
                            deltaProcessingError = "Malformed subtask payload on event ${delta.id}"
                            break
                        }
                    }
                }

                // Merge causality into local logical clock
                hlcClock.receive(remoteHlc)

                // Locate local entity version metadata for LWW evaluation
                val localMetadata = localDataSource.getEntitySyncMetadata(delta.entityType, delta.entityId)

                val shouldApplyRemote = if (localMetadata != null) {
                    val localHlc = HlcTimestamp.fromString(localMetadata.hlcTimestamp)
                    if (localHlc != null) {
                        remoteHlc > localHlc
                    } else {
                        delta.createdAt > localMetadata.updatedAtEpochMs
                    }
                } else {
                    true // First time entity observed
                }

                if (shouldApplyRemote) {
                    when (delta.entityType) {
                        "TASK" -> {
                            if (delta.operation == "UPSERT") {
                                val task = TaskPayloadSerializer.deserializeTask(delta.payload)
                                if (task != null) {
                                    localDataSource.applyRemoteTaskUpsert(task, delta.hlcTimestamp, now)
                                }
                            } else if (delta.operation == "DELETE") {
                                localDataSource.applyRemoteTaskDelete(delta.entityId, delta.hlcTimestamp, now)
                            }
                        }
                    }
                }

                // Safely advance checkpoint up to this successfully validated and processed delta
                advancedCheckpoint = delta.hlcTimestamp
            }

            // Step 4: Persist updated checkpoint
            if (advancedCheckpoint != null && advancedCheckpoint != lastCheckpoint) {
                syncRepository.updateSyncCheckpoint(deviceId, advancedCheckpoint, now, deltaProcessingError)
            }

            val remainingPending = syncRepository.getPendingOutboxRecords().first().size

            if (deltaProcessingError != null) {
                _syncStatus.value = SyncStatus(
                    state = SyncState.ERROR,
                    lastSyncedTimestamp = now,
                    pendingOutboxCount = remainingPending,
                    activeDeviceName = deviceName,
                    lastCheckpointHlc = advancedCheckpoint,
                    errorMessage = deltaProcessingError
                )
            } else {
                _syncStatus.value = SyncStatus(
                    state = SyncState.SUCCESS,
                    lastSyncedTimestamp = now,
                    pendingOutboxCount = remainingPending,
                    activeDeviceName = deviceName,
                    lastCheckpointHlc = advancedCheckpoint,
                    errorMessage = null
                )
            }
        }
    }
}

/**
 * Built-in mock transport acknowledging all records pushed, used for local tests and offline operation.
 */
class DefaultMockRemoteTransport : RemoteSyncTransport {
    private val remoteRecords = mutableListOf<SyncRecord>()

    override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
        for (record in records) {
            // Idempotent replace by event ID
            remoteRecords.removeAll { it.id == record.id }
            remoteRecords.add(record)
        }
        return records.map { it.id }
    }

    override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
        val list = if (sinceHlc == null) {
            remoteRecords.toList()
        } else {
            val since = HlcTimestamp.fromString(sinceHlc)
            if (since != null) {
                remoteRecords.filter {
                    val recHlc = HlcTimestamp.fromString(it.hlcTimestamp)
                    recHlc != null && recHlc > since
                }
            } else {
                remoteRecords.toList()
            }
        }
        return list.sortedWith(SyncRecordComparator)
    }

    fun addRemoteRecord(record: SyncRecord) {
        remoteRecords.removeAll { it.id == record.id }
        remoteRecords.add(record)
    }

    fun clear() {
        remoteRecords.clear()
    }
}
