package com.lifetrack.data.local

import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

interface TaskLocalDataSource {
    fun observeTasks(): Flow<List<Task>>
    suspend fun getTaskById(id: String): Task?
    suspend fun insertTask(task: Task): Task
    suspend fun updateTask(task: Task): Task
    suspend fun deleteTask(id: String): Boolean
}

class InMemoryTaskLocalDataSource : TaskLocalDataSource {
    private val _tasks = MutableStateFlow<List<Task>>(seedInitialTasks())
    val tasksFlow: Flow<List<Task>> = _tasks.asStateFlow()

    override fun observeTasks(): Flow<List<Task>> = tasksFlow

    override suspend fun getTaskById(id: String): Task? {
        return _tasks.value.find { it.id == id }
    }

    override suspend fun insertTask(task: Task): Task {
        _tasks.update { current ->
            listOf(task) + current.filterNot { it.id == task.id }
        }
        return task
    }

    override suspend fun updateTask(task: Task): Task {
        _tasks.update { current ->
            current.map { if (it.id == task.id) task else it }
        }
        return task
    }

    override suspend fun deleteTask(id: String): Boolean {
        var found = false
        _tasks.update { current ->
            val filtered = current.filterNot { 
                if (it.id == id) {
                    found = true
                    true
                } else false
            }
            filtered
        }
        return found
    }

    companion object {
        fun seedInitialTasks(): List<Task> = listOf(
            Task(
                id = "task_vtu_01",
                title = "VTU Computer Networks Lab Record Submission",
                description = "Complete simulation graphs for NS2 Part B experiments",
                category = TaskCategory.VTU,
                priority = TaskPriority.URGENT,
                status = TaskStatus.PENDING,
                estimatedMinutes = 120,
                tags = listOf("vtu", "lab", "cn")
            ),
            Task(
                id = "task_acad_02",
                title = "Review Microcontroller Architecture Chapter 4",
                description = "8051 timers, counters and serial interrupts",
                category = TaskCategory.ACADEMIC,
                priority = TaskPriority.HIGH,
                status = TaskStatus.PENDING,
                estimatedMinutes = 90,
                tags = listOf("exam", "theory")
            ),
            Task(
                id = "task_fin_03",
                title = "College Semester Exam Fee Payment",
                description = "Online portal payment receipt verification",
                category = TaskCategory.FINANCE,
                priority = TaskPriority.HIGH,
                status = TaskStatus.COMPLETED,
                estimatedMinutes = 15,
                tags = listOf("fees", "vtu")
            ),
            Task(
                id = "task_dev_04",
                title = "KMP Architecture Windows & Android Verification",
                description = "Validate shared ViewModel, repositories, and UI parity",
                category = TaskCategory.WORK,
                priority = TaskPriority.URGENT,
                status = TaskStatus.IN_PROGRESS,
                estimatedMinutes = 45,
                tags = listOf("architecture", "kmp")
            )
        )
    }
}
