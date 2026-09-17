package com.lifetrack

import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.repository.TaskRepositoryImpl
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskFilterState
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.usecase.GetTasksUseCase
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

class TaskFilterUseCasesTest {

    @Test
    fun testTaskFilteringByAllDimensions() = runTest {
        val timeProvider = TestTimeProvider(1710000000000L)
        val driver = MemorySqlDriver()
        val dataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val repository = TaskRepositoryImpl(dataSource, timeProvider)
        val getTasksUseCase = GetTasksUseCase(repository)

        val task1 = Task(
            id = "t1",
            title = "VTU Computer Networks Lab",
            description = "NS2 simulations",
            category = TaskCategory.VTU,
            priority = TaskPriority.URGENT,
            status = TaskStatus.TODO,
            tags = listOf("lab", "vtu")
        )
        val task2 = Task(
            id = "t2",
            title = "Gym Workout Session",
            description = "Leg day",
            category = TaskCategory.HEALTH,
            priority = TaskPriority.MEDIUM,
            status = TaskStatus.TODO,
            tags = listOf("fitness")
        )
        val task3 = Task(
            id = "t3",
            title = "Pay Semester Fee",
            description = "College fee portal",
            category = TaskCategory.FINANCE,
            priority = TaskPriority.HIGH,
            status = TaskStatus.COMPLETED,
            completedAtEpochMs = 1710000000000L,
            tags = listOf("fees")
        )

        repository.saveTask(task1)
        repository.saveTask(task2)
        repository.saveTask(task3)

        // Default filter: showCompleted = true, all categories
        val defaultList = getTasksUseCase().first()
        assertEquals(3, defaultList.size)

        // Filter: showCompleted = false
        val pendingOnly = getTasksUseCase(TaskFilterState(showCompleted = false)).first()
        assertEquals(2, pendingOnly.size)

        // Filter by category: VTU
        val vtuOnly = getTasksUseCase(TaskFilterState(selectedCategory = TaskCategory.VTU)).first()
        assertEquals(1, vtuOnly.size)
        assertEquals("t1", vtuOnly[0].id)

        // Filter by priority: URGENT
        val urgentOnly = getTasksUseCase(TaskFilterState(selectedPriority = TaskPriority.URGENT)).first()
        assertEquals(1, urgentOnly.size)
        assertEquals("t1", urgentOnly[0].id)

        // Filter by status: COMPLETED
        val completedOnly = getTasksUseCase(TaskFilterState(selectedStatus = TaskStatus.COMPLETED)).first()
        assertEquals(1, completedOnly.size)
        assertEquals("t3", completedOnly[0].id)

        // Search by query: "Leg day"
        val searchResult = getTasksUseCase(TaskFilterState(searchQuery = "leg day")).first()
        assertEquals(1, searchResult.size)
        assertEquals("t2", searchResult[0].id)

        // Search by tag: "vtu"
        val tagSearchResult = getTasksUseCase(TaskFilterState(searchQuery = "vtu")).first()
        assertEquals(1, tagSearchResult.size)
        assertEquals("t1", tagSearchResult[0].id)
    }
}
