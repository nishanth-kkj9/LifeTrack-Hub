package com.lifetrack.core

import kotlin.random.Random

/**
 * Identifier generation abstraction for offline-first entity creation across Android and Desktop.
 */
interface IdGenerator {
    fun generateId(prefix: String = ""): String
}

/**
 * Multiplatform pseudo-random identifier generator combining epoch timestamp with pseudo-random entropy.
 * Format: [prefix_]<timestamp_hex>_<random_entropy_hex>
 *
 * Ordering: Monotonically increasing by creation millisecond when sorted lexicographically.
 * Entropy: 48 bits of pseudo-random entropy generated via Kotlin standard PRNG (Random.Default).
 * Note: Uses standard pseudo-random entropy suitable for local/offline-first identification and collision resistance.
 */
class PlatformIdGenerator(
    private val timeProvider: TimeProvider = SystemTimeProvider(),
    private val random: Random = Random.Default
) : IdGenerator {

    override fun generateId(prefix: String): String {
        val timestampHex = timeProvider.nowEpochMs().toString(16)
        val entropy1 = (random.nextLong() and Long.MAX_VALUE).toString(16).padStart(8, '0').take(8)
        val entropy2 = random.nextInt(0, 0x10000).toString(16).padStart(4, '0')
        val rawId = "${timestampHex}_${entropy1}${entropy2}"
        return if (prefix.isNotBlank()) "${prefix.trimEnd('_')}_$rawId" else rawId
    }

    companion object {
        private val defaultInstance = PlatformIdGenerator()

        fun newId(prefix: String = ""): String = defaultInstance.generateId(prefix)
    }
}

/**
 * Test ID generator with deterministic sequential numbering.
 */
class TestIdGenerator(
    private var counter: Long = 1L
) : IdGenerator {
    override fun generateId(prefix: String): String {
        val id = (counter++).toString()
        return if (prefix.isNotBlank()) "${prefix}_$id" else id
    }
}
