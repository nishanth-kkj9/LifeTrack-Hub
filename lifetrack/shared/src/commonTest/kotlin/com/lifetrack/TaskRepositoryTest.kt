package com.lifetrack

import com.lifetrack.data.local.InMemoryTaskLocalDataSource
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.ToggleTaskUseCase
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TaskRepositoryTest {

    @Test
    fun testCreateAndObserveTaskFlow() = runTest {
        val dataSource = InMemoryTaskLocalDataSource()
        val repository = TaskRepositoryImpl(dataSource)
        val createUseCase = CreateTaskUseCase(repository)

        val initialTasks = repository.getTasks().first()
        val initialCount = initialTasks.size

        val newTask = Task(
            id = "test-task-1",
            title = "Test Phase 1 Architecture",
            priority = TaskPriority.HIGH,
            category = TaskCategory.PROJECT,
            status = TaskStatus.TODO
        )

        createUseCase(newTask)

        val updatedTasks = repository.getTasks().first()
        assertEquals(initialCount + 1, updatedTasks.size)
        assertTrue(updatedTasks.any { it.id == "test-task-1" && it.title == "Test Phase 1 Architecture" })
    }

    @Test
    fun testToggleTaskCompletion() = runTest {
        val dataSource = InMemoryTaskLocalDataSource()
        val repository = TaskRepositoryImpl(dataSource)
        val toggleUseCase = ToggleTaskUseCase(repository)

        val existing = repository.getTasks().first().first()
        val originalStatus = existing.status

        toggleUseCase(existing.id)

        val toggled = repository.getTasks().first().first { it.id == existing.id }
        if (originalStatus == TaskStatus.DONE) {
            assertEquals(TaskStatus.TODO, toggled.status)
        } else {
            assertEquals(TaskStatus.DONE, toggled.status)
            assertTrue(toggled.isCompleted)
        }
    }

    @Test
    fun testAddAndToggleSubtask() = runTest {
        val dataSource = InMemoryTaskLocalDataSource()
        val repository = TaskRepositoryImpl(dataSource)

        val task = repository.getTasks().first().first()
        val subtask = Subtask(
            id = "sub-test-99",
            taskId = task.id,
            title = "Subtask Unit Verification",
            completed = false
        )

        repository.addSubtask(task.id, subtask)

        val withSubtask = repository.getTasks().first().first { it.id == task.id }
        assertTrue(withSubtask.subtasks.any { it.id == "sub-test-99" && !it.completed })

        repository.toggleSubtask(task.id, "sub-test-99")

        val toggledSubtask = repository.getTasks().first().first { it.id == task.id }
        assertTrue(toggledSubtask.subtasks.first { it.id == "sub-test-99" }.completed)
    }
}
