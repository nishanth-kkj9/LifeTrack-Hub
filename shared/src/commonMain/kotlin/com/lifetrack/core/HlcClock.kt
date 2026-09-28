package com.lifetrack.core

/**
 * Hybrid Logical Clock (HLC) contract providing monotonically increasing causality tracking
 * across distributed devices without relying on synchronized physical clocks.
 */
interface HlcClock {
    val nodeId: String

    /**
     * Generates a new causal timestamp for a local event.
     * Guarantees monotonic ordering: successive calls during the same physical millisecond
     * increment the logical counter; advancing physical time resets the counter to 0.
     */
    fun now(): HlcTimestamp

    /**
     * Updates and merges the local logical clock state upon receiving a remote event timestamp.
     * Advances the local physical/logical state according to standard HLC merge semantics.
     */
    fun receive(remoteTimestamp: HlcTimestamp): HlcTimestamp

    /**
     * Returns the current clock state without advancing it.
     */
    fun current(): HlcTimestamp
}

/**
 * Standard thread-safe, testable implementation of Hybrid Logical Clock.
 */
class StandardHlcClock(
    override val nodeId: String,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    initialPhysicalTime: Long = 0L,
    initialLogicalCounter: Int = 0
) : HlcClock {

    private var lastPhysicalTime: Long = initialPhysicalTime
    private var lastLogicalCounter: Int = initialLogicalCounter

    override fun now(): HlcTimestamp {
        val physicalNow = timeProvider.nowEpochMs()
        if (physicalNow > lastPhysicalTime) {
            lastPhysicalTime = physicalNow
            lastLogicalCounter = 0
        } else {
            lastLogicalCounter++
        }
        return HlcTimestamp(lastPhysicalTime, lastLogicalCounter, nodeId)
    }

    override fun receive(remoteTimestamp: HlcTimestamp): HlcTimestamp {
        val physicalNow = timeProvider.nowEpochMs()
        val maxPhysical = maxOf(physicalNow, lastPhysicalTime, remoteTimestamp.physicalTimeMs)

        if (maxPhysical == lastPhysicalTime && maxPhysical == remoteTimestamp.physicalTimeMs) {
            lastLogicalCounter = maxOf(lastLogicalCounter, remoteTimestamp.logicalCounter) + 1
        } else if (maxPhysical == lastPhysicalTime) {
            lastLogicalCounter++
        } else if (maxPhysical == remoteTimestamp.physicalTimeMs) {
            lastLogicalCounter = remoteTimestamp.logicalCounter + 1
        } else {
            lastLogicalCounter = 0
        }

        lastPhysicalTime = maxPhysical
        return HlcTimestamp(lastPhysicalTime, lastLogicalCounter, nodeId)
    }

    override fun current(): HlcTimestamp {
        return HlcTimestamp(lastPhysicalTime, lastLogicalCounter, nodeId)
    }
}
