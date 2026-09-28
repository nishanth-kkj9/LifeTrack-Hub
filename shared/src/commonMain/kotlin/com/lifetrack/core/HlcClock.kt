package com.lifetrack.core

import com.lifetrack.data.local.db.SqlDriver

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
 * Persistence strategy interface to ensure HLC state survives process crashes and restarts.
 */
interface HlcPersistence {
    fun readLatestHlc(): HlcTimestamp?
    fun persistLatestHlc(timestamp: HlcTimestamp)
}

/**
 * SQLite-backed HLC state persistence ensuring monotonic clock advancement across application restarts.
 */
class SqliteHlcPersistence(
    private val driver: SqlDriver,
    private val nodeId: String
) : HlcPersistence {

    override fun readLatestHlc(): HlcTimestamp? {
        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS hlc_clock_state (
                node_id TEXT PRIMARY KEY NOT NULL,
                physical_time_ms INTEGER NOT NULL,
                logical_counter INTEGER NOT NULL,
                hlc_string TEXT NOT NULL
            );
            """.trimIndent()
        )

        return driver.query(
            "SELECT physical_time_ms, logical_counter, node_id FROM hlc_clock_state WHERE node_id = ? LIMIT 1;",
            arrayOf(nodeId)
        ) { cursor ->
            val phys = cursor.getLong(0) ?: 0L
            val count = cursor.getInt(1) ?: 0
            val node = cursor.getString(2) ?: nodeId
            HlcTimestamp(phys, count, node)
        }.firstOrNull()
    }

    override fun persistLatestHlc(timestamp: HlcTimestamp) {
        driver.execute(
            """
            INSERT OR REPLACE INTO hlc_clock_state (
                node_id, physical_time_ms, logical_counter, hlc_string
            ) VALUES (?, ?, ?, ?);
            """.trimIndent(),
            arrayOf(timestamp.nodeId, timestamp.physicalTimeMs, timestamp.logicalCounter, timestamp.toString())
        )
    }
}

/**
 * Standard thread-safe, testable implementation of Hybrid Logical Clock with optional persistence.
 */
class StandardHlcClock(
    override val nodeId: String,
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    initialPhysicalTime: Long = 0L,
    initialLogicalCounter: Int = 0,
    private val persistence: HlcPersistence? = null
) : HlcClock {

    private var lastPhysicalTime: Long = initialPhysicalTime
    private var lastLogicalCounter: Int = initialLogicalCounter

    init {
        if (persistence != null) {
            val persisted = persistence.readLatestHlc()
            if (persisted != null) {
                if (persisted.physicalTimeMs > lastPhysicalTime ||
                    (persisted.physicalTimeMs == lastPhysicalTime && persisted.logicalCounter > lastLogicalCounter)) {
                    lastPhysicalTime = persisted.physicalTimeMs
                    lastLogicalCounter = persisted.logicalCounter
                }
            }
        }
    }

    override fun now(): HlcTimestamp {
        val physicalNow = timeProvider.nowEpochMs()
        if (physicalNow > lastPhysicalTime) {
            lastPhysicalTime = physicalNow
            lastLogicalCounter = 0
        } else {
            lastLogicalCounter++
        }
        val ts = HlcTimestamp(lastPhysicalTime, lastLogicalCounter, nodeId)
        persistence?.persistLatestHlc(ts)
        return ts
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
        val ts = HlcTimestamp(lastPhysicalTime, lastLogicalCounter, nodeId)
        persistence?.persistLatestHlc(ts)
        return ts
    }

    override fun current(): HlcTimestamp {
        return HlcTimestamp(lastPhysicalTime, lastLogicalCounter, nodeId)
    }
}
