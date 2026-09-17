package com.lifetrack.ui

import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskFilterState
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.DeleteTaskUseCase
import com.lifetrack.domain.usecase.GetTaskMetricsUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import com.lifetrack.domain.usecase.ToggleTaskCompletionUseCase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TasksUiState(
    val tasks: List<Task> = emptyList(),
    val metrics: TaskMetrics = TaskMetrics(0, 0, 0, 0, 0f),
    val filterState: TaskFilterState = TaskFilterState(),
    val naturalLanguageInput: String = "",
    val isLoading: Boolean = false,
    val userFeedbackMessage: String? = null
)

class TasksViewModel(
    private val getTasksUseCase: GetTasksUseCase,
    private val createTaskUseCase: CreateTaskUseCase,
    private val toggleTaskCompletionUseCase: ToggleTaskCompletionUseCase,
    private val deleteTaskUseCase: DeleteTaskUseCase,
    private val getTaskMetricsUseCase: GetTaskMetricsUseCase,
    private val parseNaturalLanguageTaskUseCase: ParseNaturalLanguageTaskUseCase,
    private val viewModelScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
) {
    private val _filterState = MutableStateFlow(TaskFilterState())
    private val _naturalLanguageInput = MutableStateFlow("")
    private val _userFeedbackMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<TasksUiState> = combine(
        _filterState,
        _naturalLanguageInput,
        _userFeedbackMessage,
        getTaskMetricsUseCase()
    ) { filter, nlpInput, feedback, metrics ->
        Quad(filter, nlpInput, feedback, metrics)
    }.combine(
        _filterState
    ) { quad, filter ->
        quad to filter
    }.combine(
        getTasksUseCase(TaskFilterState())
    ) { (quad, _), rawTasks ->
        val (filter, nlpInput, feedback, metrics) = quad
        val filtered = rawTasks.filter { task ->
            val matchesCat = filter.selectedCategory == TaskCategory.ALL || task.category == filter.selectedCategory
            val matchesSearch = filter.searchQuery.isBlank() ||
                    task.title.contains(filter.searchQuery, ignoreCase = true) ||
                    task.description.contains(filter.searchQuery, ignoreCase = true)
            matchesCat && matchesSearch
        }
        TasksUiState(
            tasks = filtered,
            metrics = metrics,
            filterState = filter,
            naturalLanguageInput = nlpInput,
            isLoading = false,
            userFeedbackMessage = feedback
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = TasksUiState(isLoading = true)
    )

    fun onCategorySelected(category: TaskCategory) {
        _filterState.update { it.copy(selectedCategory = category) }
    }

    fun onSearchQueryChanged(query: String) {
        _filterState.update { it.copy(searchQuery = query) }
    }

    fun onNaturalLanguageInputChanged(input: String) {
        _naturalLanguageInput.value = input
    }

    fun submitNaturalLanguageTask() {
        val input = _naturalLanguageInput.value.trim()
        if (input.isBlank()) return

        viewModelScope.launch {
            val draft = parseNaturalLanguageTaskUseCase(input)
            createTaskUseCase(
                title = draft.title,
                category = draft.category,
                priority = draft.priority,
                estimatedMinutes = draft.estimatedMinutes
            )
            _naturalLanguageInput.value = ""
            _userFeedbackMessage.value = "Created: ${draft.title} (${draft.category.name})"
        }
    }

    fun createTask(
        title: String,
        description: String = "",
        category: TaskCategory = TaskCategory.PERSONAL,
        priority: TaskPriority = TaskPriority.MEDIUM,
        estimatedMinutes: Int? = null
    ) {
        viewModelScope.launch {
            createTaskUseCase(
                title = title,
                description = description,
                category = category,
                priority = priority,
                estimatedMinutes = estimatedMinutes
            )
            _userFeedbackMessage.value = "Created task '$title'"
        }
    }

    fun toggleTaskCompletion(taskId: String) {
        viewModelScope.launch {
            toggleTaskCompletionUseCase(taskId)
        }
    }

    fun deleteTask(taskId: String) {
        viewModelScope.launch {
            deleteTaskUseCase(taskId)
            _userFeedbackMessage.value = "Task deleted"
        }
    }

    fun clearFeedbackMessage() {
        _userFeedbackMessage.value = null
    }

    private data class Quad<A, B, C, D>(val a: A, val b: B, val c: C, val d: D)
}
