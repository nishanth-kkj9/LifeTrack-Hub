package com.lifetrack

import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.data.local.DesktopSqlDriver
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.sync.PersistentSyncRepository
import com.lifetrack.sync.SyncRecord
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class DesktopPersistenceTest {

    private fun createTempDbFile(): File {
        val file = File.createTempFile("lifetrack_test_", ".db")
        file.deleteOnExit()
        return file
    }

    @Test
    fun testDesktopRestartPersistence() = runTest {
        val dbFile = createTempDbFile()
        val timeProvider = SystemTimeProvider()

        // 1. Initial write
        val driver1 = DesktopSqlDriver(dbFile)
        val dataSource1 = PersistentTaskLocalDataSource(driver1, timeProvider, seedIfEmpty = false)

        val task = Task(
            id = "desktop-task-1",
            title = "Hardware Interrupts Test",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.HIGH,
            status = TaskStatus.TODO,
            createdAtEpochMs = 1720000000000L,
            updatedAtEpochMs = 1720000000000L
        )
        dataSource1.upsertTask(task)
        driver1.close()

        // 2. Reopen over same file
        val driver2 = DesktopSqlDriver(dbFile)
        val dataSource2 = PersistentTaskLocalDataSource(driver2, timeProvider, seedIfEmpty = false)

        val recovered = dataSource2.getTaskById("desktop-task-1")
        assertNotNull(recovered)
        assertEquals("Hardware Interrupts Test", recovered.title)
        assertEquals(TaskCategory.ACADEMIC, recovered.category)
        driver2.close()
    }

    @Test
    fun testDesktopOutboxPersistenceAcrossRestart() = runTest {
        val dbFile = createTempDbFile()
        val timeProvider = SystemTimeProvider()

        val driver1 = DesktopSqlDriver(dbFile)
        val dataSource1 = PersistentTaskLocalDataSource(driver1, timeProvider, seedIfEmpty = false)
        val syncRepo1 = PersistentSyncRepository(driver1)

        syncRepo1.enqueueRecord(
            SyncRecord(
                id = "evt-durable-1",
                entityType = "TASK",
                entityId = "task-x",
                operation = "UPSERT",
                payload = "task-data-blob",
                hlcTimestamp = "1720000000000:0:desktop-node",
                createdAt = 1720000000000L
            )
        )
        driver1.close()

        // Reopen driver
        val driver2 = DesktopSqlDriver(dbFile)
        val syncRepo2 = PersistentSyncRepository(driver2)

        val recoveredPending = syncRepo2.getPendingOutboxRecords().first()
        assertEquals(1, recoveredPending.size)
        assertEquals("evt-durable-1", recoveredPending[0].id)
        assertEquals("task-x", recoveredPending[0].entityId)
        driver2.close()
    }

    @Test
    fun testDesktopRealSqliteRollbackAtomicity() = runTest {
        val dbFile = createTempDbFile()
        val driver = DesktopSqlDriver(dbFile)
        val dataSource = PersistentTaskLocalDataSource(driver, seedIfEmpty = false)

        var thrown = false
        try {
            driver.transaction {
                driver.execute(
                    """
                    INSERT INTO tasks (
                        id, title, description, category, priority, status,
                        is_starred, recurrence, tags, is_sync_pending, is_deleted,
                        created_at_epoch_ms, updated_at_epoch_ms
                    ) VALUES (?, ?, '', 'VTU', 'HIGH', 'TODO', 0, 'NONE', '', 0, 0, 100, 100);
                    """.trimIndent(),
                    arrayOf("task-should-rollback", "Rollback Test")
                )
                throw RuntimeException("Forced rollback in SQLite transaction")
            }
        } catch (_: RuntimeException) {
            thrown = true
        }

        assertTrue(thrown)
        // Record must not exist in real SQLite database
        val task = dataSource.getTaskById("task-should-rollback")
        assertEquals(null, task, "Real SQLite transaction must roll back uncommitted rows")
        driver.close()
    }

    @Test
    fun testDesktopInFlightCrashRecovery() = runTest {
        val dbFile = createTempDbFile()
        val driver1 = DesktopSqlDriver(dbFile)
        PersistentTaskLocalDataSource(driver1, seedIfEmpty = false)
        val syncRepo1 = PersistentSyncRepository(driver1)

        syncRepo1.enqueueRecord(
            SyncRecord(
                id = "evt-crash-1",
                entityType = "TASK",
                entityId = "task-crash",
                operation = "UPSERT",
                payload = "payload",
                hlcTimestamp = "1720000000000:0:desktop",
                createdAt = 1720000000000L
            )
        )
        // Mark in-flight at time 1000
        syncRepo1.markInFlight(listOf("evt-crash-1"), inFlightTimeMs = 1000L)
        assertEquals("IN_FLIGHT", syncRepo1.getAllRecords()[0].status)

        // Process dies (driver closed)
        driver1.close()

        // Process restarts at time 100000 (well past 60000ms lease)
        val driver2 = DesktopSqlDriver(dbFile)
        val syncRepo2 = PersistentSyncRepository(driver2)
        syncRepo2.recoverStaleInFlightRecords(leaseTimeoutMs = 60_000L, currentTimeMs = 100_000L)

        val recovered = syncRepo2.getAllRecords()[0]
        assertEquals("PENDING", recovered.status)
        assertEquals(null, recovered.inFlightAt)
        driver2.close()
    }
}
