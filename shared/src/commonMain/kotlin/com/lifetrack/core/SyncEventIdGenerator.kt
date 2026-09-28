package com.lifetrack.core

/**
 * Dedicated sync-event identifier generator ensuring uniqueness and collision immunity across devices.
 */
interface SyncEventIdGenerator {
    fun generateEventId(entityId: String, hlcTimestamp: HlcTimestamp): String
}

/**
 * Default implementation combining HLC causality with high-entropy PRNG.
 * Format: evt_<physical>_<logical>_<nodeId>_<entropy>
 */
class StandardSyncEventIdGenerator(
    private val idGenerator: IdGenerator = PlatformIdGenerator()
) : SyncEventIdGenerator {

    override fun generateEventId(entityId: String, hlcTimestamp: HlcTimestamp): String {
        val entropy = idGenerator.generateId()
        val sanitizedNode = hlcTimestamp.nodeId.replace(Regex("[^a-zA-Z0-9_-]"), "_")
        return "evt_${hlcTimestamp.physicalTimeMs}_${hlcTimestamp.logicalCounter}_${sanitizedNode}_$entropy"
    }
}
