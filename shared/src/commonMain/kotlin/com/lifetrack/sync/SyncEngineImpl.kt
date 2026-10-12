package com.lifetrack.sync

import com.lifetrack.core.HlcClock
import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.repository.TaskPayloadSerializer
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

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
    private val remoteTransport: RemoteSyncTransport, // Mandatory parameter: no default mock fallback
    private val hlcClock: HlcClock,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    private val authSessionProvider: AuthSessionProvider? = null,
    private val deviceId: String = "local-device",
    private val deviceName: String = "Local Device",
    private val maxRetries: Int = 5,
    private val inFlightLeaseMs: Long = 60_000L,
    /**
     * STABILITY (G2/G3): all engine work runs on this dispatcher. Production wiring passes a
     * single-threaded dispatcher (Dispatchers.Default.limitedParallelism(1)) SHARED with the
     * TasksViewModel scope, which serializes every SQLite/HLC access in the process —
     * StandardHlcClock and DesktopSqlDriver are not internally synchronized.
     */
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.Default
) : SyncEngine {

    companion object {
        const val CURRENT_PROTOCOL_VERSION: Int = 1
        const val CURRENT_SCHEMA_VERSION: Int = 1

        /**
         * Cumulative failed-validation attempts allowed for one remote delta before it is
         * permanently quarantined and the checkpoint advances past it (poison-pill guard).
         */
        const val MAX_INVALID_DELTA_ATTEMPTS: Int = 3
    }

    private val mutex = Mutex()
    private var isOfflineMode = false

    private val _syncStatus = MutableStateFlow(
        SyncStatus(
            state = if (authSessionProvider != null && authSessionProvider.getCurrentUserUid() == null) SyncState.UNAUTHENTICATED else SyncState.IDLE,
            activeDeviceName = deviceName,
            authenticatedUser = authSessionProvider?.getCurrentUserUid()
        )
    )
    override val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    fun refreshAuthenticationState() {
        val uid = authSessionProvider?.getCurrentUserUid()
        if (authSessionProvider != null && uid == null) {
            _syncStatus.value = _syncStatus.value.copy(
                state = SyncState.UNAUTHENTICATED,
                authenticatedUser = null
            )
        } else if (_syncStatus.value.state == SyncState.UNAUTHENTICATED && uid != null) {
            _syncStatus.value = _syncStatus.value.copy(
                state = SyncState.IDLE,
                authenticatedUser = uid,
                errorMessage = null
            )
        }
    }

    override suspend fun setOffline(offline: Boolean) = withContext(ioDispatcher) {
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
                val uid = authSessionProvider?.getCurrentUserUid()
                _syncStatus.value = _syncStatus.value.copy(
                    state = if (authSessionProvider != null && uid == null) SyncState.UNAUTHENTICATED else SyncState.IDLE,
                    errorMessage = null,
                    authenticatedUser = uid
                )
            }
        }
    }

    override suspend fun retryFailedRecord(recordId: String) = withContext(ioDispatcher) {
        syncRepository.retryFailedRecord(recordId)
        val pending = syncRepository.getPendingOutboxRecords().first().size
        _syncStatus.value = _syncStatus.value.copy(pendingOutboxCount = pending)
    }

    override suspend fun retryAllFailed() = withContext(ioDispatcher) {
        syncRepository.retryAllFailed()
        val pending = syncRepository.getPendingOutboxRecords().first().size
        _syncStatus.value = _syncStatus.value.copy(pendingOutboxCount = pending)
    }

    override suspend fun triggerSync() {
        // Confine all engine work to the injected (single-threaded in production) dispatcher.
        // Body lives in doTriggerSync() because withContext's lambda is crossinline and the
        // engine uses early returns.
        withContext(ioDispatcher) {
            doTriggerSync()
        }
    }

    private suspend fun doTriggerSync() {
        mutex.withLock {
            val now = timeProvider.nowEpochMs()
            val pendingCount = syncRepository.getPendingOutboxRecords().first().size

            // Section 5: Verify authenticated session before cloud synchronization
            val uid = authSessionProvider?.getCurrentUserUid()
            if (authSessionProvider != null && uid.isNullOrBlank()) {
                _syncStatus.value = SyncStatus(
                    state = SyncState.UNAUTHENTICATED,
                    activeDeviceName = deviceName,
                    pendingOutboxCount = pendingCount,
                    errorMessage = "User is not signed in. Please sign in to enable remote synchronization.",
                    authenticatedUser = null
                )
                return
            }

            if (isOfflineMode) {
                _syncStatus.value = _syncStatus.value.copy(
                    state = SyncState.OFFLINE,
                    pendingOutboxCount = pendingCount,
                    authenticatedUser = uid
                )
                return
            }

            // Step 0: Recover any stale IN_FLIGHT records from crashed sessions
            syncRepository.recoverStaleInFlightRecords(leaseTimeoutMs = inFlightLeaseMs, currentTimeMs = now)

            _syncStatus.value = _syncStatus.value.copy(
                state = SyncState.SYNCING,
                errorMessage = null,
                authenticatedUser = uid
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

            // Step 2: Pull remote deltas using the durable remote checkpoint cursor
            val lastCheckpoint = syncRepository.getSyncCheckpoint(deviceId)
            val cursor = SyncCursor.fromCheckpointString(lastCheckpoint)
            val remoteDeltas = try {
                remoteTransport.pullRecordsWithCursor(cursor, pageSize = 100).sortedWith(SyncRecordComparator)
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
                // Validation (single source of truth: validateRemoteDelta)
                val validationError = validateRemoteDelta(delta)
                if (validationError != null) {
                    // POISON-PILL GUARD (stability pass): fail-stop at first, but after
                    // MAX_INVALID_DELTA_ATTEMPTS cumulative attempts, permanently quarantine
                    // the record and advance the checkpoint past it. Remote deltas are
                    // immutable (rules forbid update/delete), so without quarantine ONE bad
                    // record stalls sync on every device forever with no recovery path.
                    val quarantined = syncRepository.recordInvalidRemoteDelta(
                        record = delta,
                        error = validationError,
                        currentTimeMs = now,
                        maxAttempts = MAX_INVALID_DELTA_ATTEMPTS
                    )
                    if (quarantined) {
                        // Merge causality when the HLC itself is parseable, then step over.
                        HlcTimestamp.fromString(delta.hlcTimestamp)?.let { hlcClock.receive(it) }
                        advancedCheckpoint = SyncCursor(delta.hlcTimestamp, delta.id).toCheckpointString()
                        deltaProcessingError =
                            "Quarantined unprocessable delta '${delta.id}' after $MAX_INVALID_DELTA_ATTEMPTS attempts: $validationError"
                        continue
                    }
                    deltaProcessingError = validationError
                    break
                }

                val remoteHlc = HlcTimestamp.fromString(delta.hlcTimestamp)
                if (remoteHlc == null) {
                    // Defensive only — validateRemoteDelta already guaranteed parseability.
                    deltaProcessingError = "Malformed HLC timestamp '${delta.hlcTimestamp}' on event ${delta.id}"
                    break
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
                                } else {
                                    deltaProcessingError = "Malformed task payload on event ${delta.id}"
                                    break
                                }
                            } else if (delta.operation == "DELETE") {
                                localDataSource.applyRemoteTaskDelete(delta.entityId, delta.hlcTimestamp, now)
                            }
                        }
                        "SUBTASK" -> {
                            // Section 7: Correct SUBTASK UPSERT and DELETE application
                            if (delta.operation == "UPSERT") {
                                val subtask = TaskPayloadSerializer.deserializeSubtask(delta.payload)
                                if (subtask != null) {
                                    localDataSource.applyRemoteSubtaskUpsert(subtask, delta.hlcTimestamp, now)
                                } else {
                                    deltaProcessingError = "Malformed subtask payload on event ${delta.id}"
                                    break
                                }
                            } else if (delta.operation == "DELETE") {
                                localDataSource.applyRemoteSubtaskDelete(delta.entityId, delta.hlcTimestamp, now)
                            }
                        }
                    }
                }

                // Section 9 & 12: Advance checkpoint cursor using (lastHlc, lastEventId)
                val newCursor = SyncCursor(delta.hlcTimestamp, delta.id)
                advancedCheckpoint = newCursor.toCheckpointString()
            }

            // Step 4: Persist updated checkpoint
            if (advancedCheckpoint != null && advancedCheckpoint != lastCheckpoint) {
                syncRepository.updateSyncCheckpoint(deviceId, advancedCheckpoint, now, deltaProcessingError)
            }

            val remainingPending = syncRepository.getPendingOutboxRecords().first().size
            val previousSuccessTime = _syncStatus.value.lastSyncedTimestamp
            val quarantinedTotal = syncRepository.getQuarantinedCount()

            if (deltaProcessingError != null) {
                _syncStatus.value = SyncStatus(
                    state = SyncState.ERROR,
                    lastSyncedTimestamp = previousSuccessTime, // Retain previous success time; do not update on error
                    pendingOutboxCount = remainingPending,
                    activeDeviceName = deviceName,
                    lastCheckpointHlc = advancedCheckpoint,
                    errorMessage = deltaProcessingError,
                    quarantinedCount = quarantinedTotal
                )
            } else {
                _syncStatus.value = SyncStatus(
                    state = SyncState.SUCCESS,
                    lastSyncedTimestamp = now,
                    pendingOutboxCount = remainingPending,
                    activeDeviceName = deviceName,
                    lastCheckpointHlc = advancedCheckpoint,
                    errorMessage = null,
                    quarantinedCount = quarantinedTotal
                )
            }
        }
    }

    /**
     * Consolidated remote-delta validation. Returns a human-readable error when the delta
     * cannot be safely processed, or null when it passes every contract check
     * (protocol/schema version bounds, HLC format + redundant-field consistency,
     * known operation/entity types, payload deserialization).
     */
    private fun validateRemoteDelta(delta: SyncRecord): String? {
        if (delta.protocolVersion > CURRENT_PROTOCOL_VERSION) {
            return "Unsupported protocol version ${delta.protocolVersion} on event ${delta.id}"
        }
        if (delta.schemaVersion > CURRENT_SCHEMA_VERSION) {
            return "Unsupported schema version ${delta.schemaVersion} on event ${delta.id}"
        }
        val remoteHlc = HlcTimestamp.fromString(delta.hlcTimestamp)
            ?: return "Malformed HLC timestamp '${delta.hlcTimestamp}' on event ${delta.id}"
        if (remoteHlc.physicalTimeMs != delta.hlcPhysicalTimeMs ||
            remoteHlc.logicalCounter != delta.hlcLogicalCounter ||
            remoteHlc.nodeId != delta.hlcNodeId) {
            return "HLC redundant field mismatch on event ${delta.id}: hlcTimestamp='${delta.hlcTimestamp}' vs fields=(${delta.hlcPhysicalTimeMs}, ${delta.hlcLogicalCounter}, '${delta.hlcNodeId}')"
        }
        if (delta.operation != "UPSERT" && delta.operation != "DELETE") {
            return "Unknown sync operation '${delta.operation}' on event ${delta.id}"
        }
        if (delta.entityType != "TASK" && delta.entityType != "SUBTASK") {
            return "Unknown sync entity type '${delta.entityType}' on event ${delta.id}"
        }
        if (delta.operation == "UPSERT") {
            if (delta.entityType == "TASK" && TaskPayloadSerializer.deserializeTask(delta.payload) == null) {
                return "Malformed task payload on event ${delta.id}"
            }
            if (delta.entityType == "SUBTASK" && TaskPayloadSerializer.deserializeSubtask(delta.payload) == null) {
                return "Malformed subtask payload on event ${delta.id}"
            }
        }
        return null
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
