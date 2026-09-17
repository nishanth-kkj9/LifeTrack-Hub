package com.lifetrack.core

/**
 * Hybrid Logical Clock (HLC) timestamp utility structure for event ordering and future sync readiness.
 *
 * Note: In Phase 2A local persistence, tasks use monotonic epoch timestamps. This utility is provided
 * for deterministic timestamp generation, comparison, and serialization in subsequent distributed sync phases.
 */
data class HlcTimestamp(
    val physicalTimeMs: Long,
    val logicalCounter: Int,
    val nodeId: String
) : Comparable<HlcTimestamp> {

    override fun compareTo(other: HlcTimestamp): Int {
        val physCompare = physicalTimeMs.compareTo(other.physicalTimeMs)
        if (physCompare != 0) return physCompare
        val counterCompare = logicalCounter.compareTo(other.logicalCounter)
        if (counterCompare != 0) return counterCompare
        return nodeId.compareTo(other.nodeId)
    }

    override fun toString(): String {
        return "${physicalTimeMs}:${logicalCounter}:${nodeId}"
    }

    companion object {
        fun fromString(str: String): HlcTimestamp? {
            val parts = str.split(":")
            if (parts.size != 3) return null
            val phys = parts[0].toLongOrNull() ?: return null
            val counter = parts[1].toIntOrNull() ?: return null
            return HlcTimestamp(phys, counter, parts[2])
        }

        fun now(nodeId: String, timeProvider: TimeProvider = SystemTimeProvider()): HlcTimestamp {
            return HlcTimestamp(timeProvider.nowEpochMs(), 0, nodeId)
        }
    }
}
