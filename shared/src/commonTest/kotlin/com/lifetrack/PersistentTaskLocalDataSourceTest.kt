package com.lifetrack

import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PersistentTaskLocalDataSourceTest {

    private val timeProvider = TestTimeProvider(1710000000000L)

    @Test
    fun testSchemaInitializationAndSeeding() = runTest {
        val driver = MemorySqlDriver()
        val dataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = true)

        val tasks = dataSource.observeTasks().first()
        assertTrue(tasks.isNotEmpty(), "Default seed tasks must be loaded when database is empty")
        assertEquals(4, tasks.size)

        val firstTask = tasks.first { it.id == "seed-task-1" }
        assertEquals(TaskCategory.VTU, firstTask.category)
        assertEquals(TaskPriority.URGENT, firstTask.priority)
        assertEquals(3, firstTask.subtasks.size)
    }

    @Test
    fun testCanonicalTaskPersistenceWithoutBlobs() = runTest {
        val driver = MemorySqlDriver()
        val dataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)

        val task = Task(
            id = "task-custom-101",
            title = "Hardware Interfacing Assignment",
            description = "Interfacing 8255 PPI with 8051 for stepper motor control",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.HIGH,
            status = TaskStatus.TODO,
            dueDate = "2026-09-25",
            dueTime = "16:00",
            dueDateEpochMs = 1711382400000L,
            completedAtEpochMs = null,
            estimatedMinutes = 150,
            actualMinutes = 30,
            isStarred = true,
            recurrence = TaskRecurrence.WEEKLY,
            subtasks = listOf(
                Subtask(id = "sub-101-a", taskId = "task-custom-101", title = "Write C assembly routine", completed = true, sortOrder = 1),
                Subtask(id = "sub-101-b", taskId = "task-custom-101", title = "Simulate in Proteus", completed = false, sortOrder = 2)
            ),
            tags = listOf("vtu", "microcontroller", "lab"),
            isSyncPending = true,
            isDeleted = false,
            createdAtEpochMs = 1710000000000L,
            updatedAtEpochMs = 1710000000000L,
            subjectId = "21CS54",
            examId = "cie-2",
            notes = "Reference textbook chapter 7"
        )

        dataSource.upsertTask(task)

        val retrieved = dataSource.getTaskById("task-custom-101")
        assertNotNull(retrieved)
        assertEquals("task-custom-101", retrieved.id)
        assertEquals("Hardware Interfacing Assignment", retrieved.title)
        assertEquals(TaskCategory.ACADEMIC, retrieved.category)
        assertEquals(TaskPriority.HIGH, retrieved.priority)
        assertEquals(TaskStatus.TODO, retrieved.status)
        assertEquals("2026-09-25", retrieved.dueDate)
        assertEquals("16:00", retrieved.dueTime)
        assertEquals(150, retrieved.estimatedMinutes)
        assertEquals(30, retrieved.actualMinutes)
        assertTrue(retrieved.isStarred)
        assertEquals(TaskRecurrence.WEEKLY, retrieved.recurrence)
        assertEquals(listOf("vtu", "microcontroller", "lab"), retrieved.tags)
        assertEquals("21CS54", retrieved.subjectId)
        assertEquals("cie-2", retrieved.examId)
        assertEquals("Reference textbook chapter 7", retrieved.notes)
        assertEquals(2, retrieved.subtasks.size)
        assertEquals("Write C assembly routine", retrieved.subtasks[0].title)
        assertTrue(retrieved.subtasks[0].completed)
        assertEquals("Simulate in Proteus", retrieved.subtasks[1].title)
        assertFalse(retrieved.subtasks[1].completed)
    }

    @Test
    fun testSubtaskMutationsAndRelationalIntegrity() = runTest {
        val driver = MemorySqlDriver()
        val dataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)

        val parentTask = Task(
            id = "parent-task-1",
            title = "Semester Project Milestone 1",
            category = TaskCategory.PROJECT,
            createdAtEpochMs = 1710000000000L,
            updatedAtEpochMs = 1710000000000L
        )
        dataSource.upsertTask(parentTask)

        // Add subtasks
        val sub1 = Subtask(id = "sub-1", taskId = "parent-task-1", title = "Design ER diagram", completed = false, sortOrder = 1)
        val sub2 = Subtask(id = "sub-2", taskId = "parent-task-1", title = "Draft API specification", completed = false, sortOrder = 2)

        val updatedAfterSub1 = dataSource.upsertSubtask(sub1)
        assertNotNull(updatedAfterSub1)
        assertEquals(1, updatedAfterSub1.subtasks.size)

        val updatedAfterSub2 = dataSource.upsertSubtask(sub2)
        assertNotNull(updatedAfterSub2)
        assertEquals(2, updatedAfterSub2.subtasks.size)

        // Toggle subtask 1
        val toggledSub1 = sub1.copy(completed = true)
        dataSource.upsertSubtask(toggledSub1)

        val retrievedAfterToggle = dataSource.getTaskById("parent-task-1")
        assertNotNull(retrievedAfterToggle)
        assertTrue(retrievedAfterToggle.subtasks.first { it.id == "sub-1" }.completed)
        assertFalse(retrievedAfterToggle.subtasks.first { it.id == "sub-2" }.completed)

        // Delete subtask 2
        dataSource.deleteSubtask("parent-task-1", "sub-2")

        val retrievedAfterDelete = dataSource.getTaskById("parent-task-1")
        assertNotNull(retrievedAfterDelete)
        assertEquals(1, retrievedAfterDelete.subtasks.size)
        assertEquals("sub-1", retrievedAfterDelete.subtasks[0].id)
    }

    @Test
    fun testSoftDeleteTaskCascadesToSubtasks() = runTest {
        val driver = MemorySqlDriver()
        val dataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)

        val task = Task(
            id = "task-delete-me",
            title = "Obsolete Task",
            category = TaskCategory.PERSONAL,
            subtasks = listOf(
                Subtask(id = "sub-del-1", taskId = "task-delete-me", title = "Sub item 1"),
                Subtask(id = "sub-del-2", taskId = "task-delete-me", title = "Sub item 2")
            )
        )
        dataSource.upsertTask(task)

        assertNotNull(dataSource.getTaskById("task-delete-me"))
        val tasksBefore = dataSource.observeTasks().first()
        assertEquals(1, tasksBefore.size)

        val deleted = dataSource.deleteTask("task-delete-me")
        assertTrue(deleted)

        assertNull(dataSource.getTaskById("task-delete-me"))
        val tasksAfter = dataSource.observeTasks().first()
        assertEquals(0, tasksAfter.size)
    }

    @Test
    fun testPersistenceSurvivesCloseAndReopen() = runTest {
        // Shared underlying storage driver simulating persistent database on disk
        val driver = MemorySqlDriver()

        // Phase 1: Open database, write data, verify
        var dataSource: PersistentTaskLocalDataSource? = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val task = Task(
            id = "task-persistent-restart",
            title = "Database Durability Verification",
            description = "Ensuring local storage survives restart cycles intact",
            category = TaskCategory.VTU,
            priority = TaskPriority.URGENT,
            subtasks = listOf(
                Subtask(id = "sub-restart-1", taskId = "task-persistent-restart", title = "Step 1: Write record", completed = true),
                Subtask(id = "sub-restart-2", taskId = "task-persistent-restart", title = "Step 2: Restart instance", completed = false)
            )
        )
        dataSource!!.upsertTask(task)

        val beforeClose = dataSource.getTaskById("task-persistent-restart")
        assertNotNull(beforeClose)
        assertEquals("Database Durability Verification", beforeClose.title)

        // Close data source
        dataSource = null

        // Phase 2: Reopen from the exact same storage driver
        val reopenedDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val afterReopen = reopenedDataSource.getTaskById("task-persistent-restart")

        assertNotNull(afterReopen, "Task must survive closing and reopening the database")
        assertEquals("task-persistent-restart", afterReopen.id)
        assertEquals("Database Durability Verification", afterReopen.title)
        assertEquals(TaskCategory.VTU, afterReopen.category)
        assertEquals(TaskPriority.URGENT, afterReopen.priority)
        assertEquals(2, afterReopen.subtasks.size)
        assertTrue(afterReopen.subtasks[0].completed)
        assertFalse(afterReopen.subtasks[1].completed)

        val listFromReopened = reopenedDataSource.observeTasks().first()
        assertEquals(1, listFromReopened.size)
        assertEquals("task-persistent-restart", listFromReopened[0].id)
    }
}
