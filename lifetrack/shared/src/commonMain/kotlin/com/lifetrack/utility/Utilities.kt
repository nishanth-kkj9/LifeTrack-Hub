package com.lifetrack.utility

import kotlin.random.Random

object IdGenerator {
    private val charPool: List<Char> = ('a'..'z') + ('0'..'9')

    fun newId(prefix: String = ""): String {
        val randomString = (1..16)
            .map { Random.nextInt(0, charPool.size).let { charPool[it] } }
            .joinToString("")
        return if (prefix.isNotEmpty()) "$prefix-$randomString" else randomString
    }
}

/**
 * Hybrid Logical Clock (HLC) structure for conflict-free causal ordering.
 */
data class HlcTimestamp(
    val logicalTime: Long,
    val counter: Int,
    val nodeIdentifier: String
) : Comparable<HlcTimestamp> {
    override fun compareTo(other: HlcTimestamp): Int {
        val timeCmp = logicalTime.compareTo(other.logicalTime)
        if (timeCmp != 0) return timeCmp
        val counterCmp = counter.compareTo(other.counter)
        if (counterCmp != 0) return counterCmp
        return nodeIdentifier.compareTo(other.nodeIdentifier)
    }

    override fun toString(): String {
        return "$logicalTime-$counter-$nodeIdentifier"
    }

    companion object {
        fun parse(serialized: String): HlcTimestamp? {
            val parts = serialized.split("-")
            if (parts.size < 3) return null
            val time = parts[0].toLongOrNull() ?: return null
            val counter = parts[1].toIntOrNull() ?: return null
            val node = parts.subList(2, parts.size).joinToString("-")
            return HlcTimestamp(time, counter, node)
        }
    }
}
