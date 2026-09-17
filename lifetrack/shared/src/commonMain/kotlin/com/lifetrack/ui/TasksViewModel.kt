package com.lifetrack.ui

import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskStatus
import com.lifetrack.domain.repository.TaskRepository
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import com.lifetrack.domain.usecase.ToggleTaskUseCase
import com.lifetrack.utility.IdGenerator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TasksUiState(
    val tasks: List<Task> = emptyList(),
    val filteredTasks: List<Task> = emptyList(),
    val isLoading: Boolean = true,
    val selectedCategory: TaskCategory? = null,
    val searchQuery: String = "",
    val completedCount: Int = 0,
    val pendingCount: Int = 0,
    val errorMessage: String? = null
)

sealed interface TasksUiAction {
    data class QuickCreateTask(val naturalLanguageInput: String) : TasksUiAction
    data class ToggleCompletion(val taskId: String) : TasksUiAction
    data class DeleteTask(val taskId: String) : TasksUiAction
    data class AddSubtask(val taskId: String, val title: String) : TasksUiAction
    data class FilterByCategory(val category: TaskCategory?) : TasksUiAction
    data class Search(val query: String) : TasksUiAction
    object ClearError : TasksUiAction
}

class TasksViewModel(
    private val getTasksUseCase: GetTasksUseCase,
    private val createTaskUseCase: CreateTaskUseCase,
    private val toggleTaskUseCase: ToggleTaskUseCase,
    private val taskRepository: TaskRepository,
    private val coroutineScope: CoroutineScope
) {
    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    private val categoryFilterFlow = MutableStateFlow<TaskCategory?>(null)
    private val searchQueryFlow = MutableStateFlow("")

    init {
        observeTasks()
    }

    private fun observeTasks() {
        combine(
            getTasksUseCase(),
            categoryFilterFlow,
            searchQueryFlow
        ) { allTasks, category, query ->
            val filtered = allTasks.filter { task ->
                val matchesCategory = category == null || task.category == category
                val matchesQuery = query.isBlank() ||
                        task.title.contains(query, ignoreCase = true) ||
                        (task.description?.contains(query, ignoreCase = true) == true) ||
                        task.tags.any { it.contains(query, ignoreCase = true) }
                matchesCategory && matchesQuery
            }
            val completed = allTasks.count { it.isCompleted }
            val pending = allTasks.size - completed

            TasksUiState(
                tasks = allTasks,
                filteredTasks = filtered,
                isLoading = false,
                selectedCategory = category,
                searchQuery = query,
                completedCount = completed,
                pendingCount = pending,
                errorMessage = null
            )
        }.catch { err ->
            _uiState.update { it.copy(isLoading = false, errorMessage = err.message ?: "Failed to load tasks") }
        }.onEach { state ->
            _uiState.value = state
        }.launchIn(coroutineScope)
    }

    fun onAction(action: TasksUiAction) {
        when (action) {
            is TasksUiAction.QuickCreateTask -> quickCreate(action.naturalLanguageInput)
            is TasksUiAction.ToggleCompletion -> toggleTask(action.taskId)
            is TasksUiAction.DeleteTask -> deleteTask(action.taskId)
            is TasksUiAction.AddSubtask -> addSubtask(action.taskId, action.title)
            is TasksUiAction.FilterByCategory -> filterByCategory(action.category)
            is TasksUiAction.Search -> search(action.query)
            is TasksUiAction.ClearError -> _uiState.update { it.copy(errorMessage = null) }
        }
    }

    private fun quickCreate(input: String) {
        if (input.isBlank()) return
        val parsed = ParseNaturalLanguageTaskUseCase.parse(input)
        val now = 1710000000000L
        val newTask = Task(
            id = IdGenerator.newId("task"),
            title = parsed.title,
            priority = parsed.priority,
            category = parsed.category,
            estimatedMinutes = parsed.estimatedMinutes,
            recurrence = parsed.recurrence,
            tags = parsed.tags,
            dueDate = if (parsed.relativeDayOffset != null) "2026-09-17" else null,
            status = TaskStatus.TODO,
            createdAt = now,
            updatedAt = now
        )
        coroutineScope.launch {
            try {
                createTaskUseCase(newTask)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    private fun toggleTask(taskId: String) {
        coroutineScope.launch {
            try {
                toggleTaskUseCase(taskId)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    private fun deleteTask(taskId: String) {
        coroutineScope.launch {
            try {
                taskRepository.deleteTask(taskId)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    private fun addSubtask(taskId: String, title: String) {
        if (title.isBlank()) return
        coroutineScope.launch {
            try {
                val subtask = Subtask(
                    id = IdGenerator.newId("sub"),
                    taskId = taskId,
                    title = title.trim(),
                    completed = false,
                    updatedAt = 1710000000000L
                )
                taskRepository.addSubtask(taskId, subtask)
            } catch (e: Exception) {
                _uiState.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    private fun filterByCategory(category: TaskCategory?) {
        categoryFilterFlow.value = category
    }

    private fun search(query: String) {
        searchQueryFlow.value = query
    }
}
