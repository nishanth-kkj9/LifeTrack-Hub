package com.lifetrack

import com.lifetrack.core.HlcTimestamp
import com.lifetrack.core.PlatformIdGenerator
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TestIdGenerator
import com.lifetrack.core.TestTimeProvider
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FoundationAbstractionsTest {

    @Test
    fun testTimeProviders() {
        val testTime = TestTimeProvider(1710000000000L)
        assertEquals(1710000000000L, testTime.nowEpochMs())
        testTime.currentEpochMs = 1710000050000L
        assertEquals(1710000050000L, testTime.nowEpochMs())

        val systemTime = SystemTimeProvider()
        assertTrue(systemTime.nowEpochMs() > 1700000000000L)
    }

    @Test
    fun testTestIdGeneratorDeterministic() {
        val generator = TestIdGenerator()
        assertEquals("1", generator.generateId())
        assertEquals("2", generator.generateId())
        assertEquals("task_3", generator.generateId("task"))
    }

    @Test
    fun testPlatformIdGeneratorUniquenessAndPrefix() {
        val timeProvider = TestTimeProvider(1710000000000L)
        val generator = PlatformIdGenerator(timeProvider)

        val id1 = generator.generateId("task")
        val id2 = generator.generateId("task")

        assertTrue(id1.startsWith("task_"))
        assertTrue(id2.startsWith("task_"))
        assertNotEquals(id1, id2)
    }

    @Test
    fun testHlcTimestampOrderingAndSerialization() {
        val ts1 = HlcTimestamp(1000L, 0, "nodeA")
        val ts2 = HlcTimestamp(1000L, 1, "nodeA")
        val ts3 = HlcTimestamp(1000L, 1, "nodeB")
        val ts4 = HlcTimestamp(1001L, 0, "nodeA")

        assertTrue(ts1 < ts2)
        assertTrue(ts2 < ts3)
        assertTrue(ts3 < ts4)

        val str = ts2.toString()
        assertEquals("1000:1:nodeA", str)

        val parsed = HlcTimestamp.fromString(str)
        assertNotNull(parsed)
        assertEquals(ts2, parsed)

        assertNull(HlcTimestamp.fromString("invalid"))
        assertNull(HlcTimestamp.fromString("1000:notanumber:nodeA"))
    }
}
