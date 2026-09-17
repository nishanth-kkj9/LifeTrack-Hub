package com.lifetrack

import com.lifetrack.data.local.InMemoryTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
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
        val dataSource = InMemoryTaskLocalDataSource()
        val repository = TaskRepositoryImpl(dataSource)

        val newTask = Task(
            id = "test_1",
            title = "Test Task",
            category = TaskCategory.ACADEMIC,
            priority = TaskPriority.HIGH,
            status = TaskStatus.PENDING
        )

        repository.insertTask(newTask)

        val fetched = repository.getTaskById("test_1")
        assertNotNull(fetched)
        assertEquals("Test Task", fetched.title)
        assertEquals(TaskStatus.PENDING, fetched.status)

        val toggled = repository.toggleTaskCompletion("test_1")
        assertNotNull(toggled)
        assertEquals(TaskStatus.COMPLETED, toggled.status)

        val metrics = repository.observeTaskMetrics().first()
        assertTrue(metrics.completedCount >= 1)
    }

    @Test
    fun testTaskDeletion() = runTest {
        val dataSource = InMemoryTaskLocalDataSource()
        val repository = TaskRepositoryImpl(dataSource)

        val newTask = Task(
            id = "test_del",
            title = "Task To Delete",
            category = TaskCategory.PERSONAL,
            priority = TaskPriority.LOW,
            status = TaskStatus.PENDING
        )

        repository.insertTask(newTask)
        val deleted = repository.deleteTask("test_del")
        assertTrue(deleted)

        val after = repository.getTaskById("test_del")
        assertEquals(null, after)
    }
}
