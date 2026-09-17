package com.lifetrack.core

import kotlinx.datetime.Clock

/**
 * Time abstraction for deterministic and testable time operations across KMP platforms.
 */
interface TimeProvider {
    fun nowEpochMs(): Long
}

/**
 * Production system time provider backed by kotlinx-datetime Clock.
 */
class SystemTimeProvider(
    private val clock: Clock = Clock.System
) : TimeProvider {
    override fun nowEpochMs(): Long = clock.now().toEpochMilliseconds()
}

/**
 * Deterministic test time provider for repeatable unit tests.
 */
class TestTimeProvider(
    var currentEpochMs: Long = 1710000000000L
) : TimeProvider {
    override fun nowEpochMs(): Long = currentEpochMs
}
