package com.lifetrack

import com.lifetrack.core.TestIdGenerator
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.InMemoryTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class TaskRepositoryTest {

    @Test
    fun testTaskCreationAndToggle() = runTest {
        val timeProvider = TestTimeProvider(1710000000000L)
        val dataSource = InMemoryTaskLocalDataSource(timeProvider)
        val repository = TaskRepositoryImpl(dataSource, timeProvider)

        val newTask = Task(
            id = "test_1",
            title = "Test Task",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.HIGH,
            status = TaskStatus.TODO
        )

        repository.saveTask(newTask)

        val fetched = repository.getTaskById("test_1")
        assertNotNull(fetched)
        assertEquals("Test Task", fetched.title)
        assertEquals(TaskStatus.TODO, fetched.status)

        val toggled = repository.toggleTaskCompletion("test_1")
        assertNotNull(toggled)
        assertEquals(TaskStatus.COMPLETED, toggled.status)
        assertTrue(toggled.isCompleted)

        val metrics = repository.observeTaskMetrics().first()
        assertTrue(metrics.completedCount >= 1)
    }

    @Test
    fun testTaskDeletion() = runTest {
        val timeProvider = TestTimeProvider(1710000000000L)
        val dataSource = InMemoryTaskLocalDataSource(timeProvider)
        val repository = TaskRepositoryImpl(dataSource, timeProvider)

        val newTask = Task(
            id = "test_del",
            title = "Task To Delete",
            category = TaskCategory.PERSONAL,
            priority = TaskPriority.LOW,
            status = TaskStatus.TODO
        )

        repository.saveTask(newTask)
        val deleted = repository.deleteTask("test_del")
        assertTrue(deleted)

        val after = repository.getTaskById("test_del")
        assertEquals(null, after)
    }

    @Test
    fun testSubtaskOperations() = runTest {
        val timeProvider = TestTimeProvider(1710000000000L)
        val dataSource = InMemoryTaskLocalDataSource(timeProvider)
        val repository = TaskRepositoryImpl(dataSource, timeProvider)

        val parentTask = Task(
            id = "parent_task",
            title = "Parent Task with Subtasks",
            category = TaskCategory.VTU,
            priority = TaskPriority.URGENT,
            status = TaskStatus.TODO
        )
        repository.saveTask(parentTask)

        val subtask = Subtask(
            id = "sub_1",
            taskId = "parent_task",
            title = "Subtask 1",
            completed = false
        )
        val updatedParent = repository.addSubtask("parent_task", subtask)
        assertNotNull(updatedParent)
        assertEquals(1, updatedParent.totalSubtasksCount)
        assertEquals(0, updatedParent.completedSubtasksCount)

        val toggledParent = repository.toggleSubtask("parent_task", "sub_1")
        assertNotNull(toggledParent)
        assertEquals(1, toggledParent.completedSubtasksCount)
    }

    @Test
    fun testRepositoryWithPersistentDataSource() = runTest {
        val timeProvider = TestTimeProvider(1710000000000L)
        val driver = com.lifetrack.data.local.db.MemorySqlDriver()
        val dataSource = com.lifetrack.data.local.PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val repository = TaskRepositoryImpl(dataSource, timeProvider)

        val task = Task(
            id = "repo_persist_1",
            title = "Database Migration Verification",
            category = TaskCategory.PROJECT,
            priority = TaskPriority.URGENT,
            status = TaskStatus.TODO
        )
        repository.saveTask(task)

        val retrieved = repository.getTaskById("repo_persist_1")
        assertNotNull(retrieved)
        assertEquals("Database Migration Verification", retrieved.title)
        assertTrue(retrieved.isSyncPending)

        repository.toggleTaskCompletion("repo_persist_1")
        val completed = repository.getTaskById("repo_persist_1")
        assertNotNull(completed)
        assertEquals(TaskStatus.COMPLETED, completed.status)
        assertEquals(1710000000000L, completed.completedAtEpochMs)

        val metrics = repository.observeTaskMetrics().first()
        assertEquals(1, metrics.totalCount)
        assertEquals(1, metrics.completedCount)
        assertEquals(0, metrics.pendingCount)
        assertEquals(100f, metrics.completionRate)
    }
}
