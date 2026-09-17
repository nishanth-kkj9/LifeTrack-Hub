package com.lifetrack.ui

import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskFilterState
import com.lifetrack.domain.model.TaskMetrics
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskRecurrence
import com.lifetrack.domain.usecase.AddSubtaskUseCase
import com.lifetrack.domain.usecase.CreateTaskUseCase
import com.lifetrack.domain.usecase.DeleteSubtaskUseCase
import com.lifetrack.domain.usecase.DeleteTaskUseCase
import com.lifetrack.domain.usecase.GetTaskMetricsUseCase
import com.lifetrack.domain.usecase.GetTasksUseCase
import com.lifetrack.domain.usecase.ParseNaturalLanguageTaskUseCase
import com.lifetrack.domain.usecase.ToggleSubtaskUseCase
import com.lifetrack.domain.usecase.ToggleTaskCompletionUseCase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
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

sealed interface TasksUiAction {
    data class SubmitNaturalLanguage(val input: String) : TasksUiAction
    data class SelectCategory(val category: TaskCategory?) : TasksUiAction
    data class Search(val query: String) : TasksUiAction
    data class ToggleCompletion(val taskId: String) : TasksUiAction
    data class DeleteTask(val taskId: String) : TasksUiAction
    data class AddSubtask(val taskId: String, val title: String) : TasksUiAction
    data class ToggleSubtask(val taskId: String, val subtaskId: String) : TasksUiAction
    data class DeleteSubtask(val taskId: String, val subtaskId: String) : TasksUiAction
    object ClearFeedback : TasksUiAction
}

@OptIn(ExperimentalCoroutinesApi::class)
class TasksViewModel(
    private val getTasksUseCase: GetTasksUseCase,
    private val createTaskUseCase: CreateTaskUseCase,
    private val toggleTaskCompletionUseCase: ToggleTaskCompletionUseCase,
    private val deleteTaskUseCase: DeleteTaskUseCase,
    private val addSubtaskUseCase: AddSubtaskUseCase,
    private val toggleSubtaskUseCase: ToggleSubtaskUseCase,
    private val deleteSubtaskUseCase: DeleteSubtaskUseCase,
    private val getTaskMetricsUseCase: GetTaskMetricsUseCase,
    private val parseNaturalLanguageTaskUseCase: ParseNaturalLanguageTaskUseCase = ParseNaturalLanguageTaskUseCase(),
    private val viewModelScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
) {
    private val _filterState = MutableStateFlow(TaskFilterState())
    private val _naturalLanguageInput = MutableStateFlow("")
    private val _userFeedbackMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<TasksUiState> = _filterState.flatMapLatest { filter ->
        combine(
            getTasksUseCase(filter),
            getTaskMetricsUseCase(),
            _naturalLanguageInput,
            _userFeedbackMessage
        ) { tasks, metrics, nlpInput, feedback ->
            TasksUiState(
                tasks = tasks,
                metrics = metrics,
                filterState = filter,
                naturalLanguageInput = nlpInput,
                isLoading = false,
                userFeedbackMessage = feedback
            )
        }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = TasksUiState(isLoading = true)
    )

    fun onAction(action: TasksUiAction) {
        when (action) {
            is TasksUiAction.SubmitNaturalLanguage -> submitNaturalLanguageTask(action.input)
            is TasksUiAction.SelectCategory -> onCategorySelected(action.category ?: TaskCategory.ALL)
            is TasksUiAction.Search -> onSearchQueryChanged(action.query)
            is TasksUiAction.ToggleCompletion -> toggleTaskCompletion(action.taskId)
            is TasksUiAction.DeleteTask -> deleteTask(action.taskId)
            is TasksUiAction.AddSubtask -> addSubtask(action.taskId, action.title)
            is TasksUiAction.ToggleSubtask -> toggleSubtask(action.taskId, action.subtaskId)
            is TasksUiAction.DeleteSubtask -> deleteSubtask(action.taskId, action.subtaskId)
            is TasksUiAction.ClearFeedback -> clearFeedbackMessage()
        }
    }

    fun onCategorySelected(category: TaskCategory) {
        _filterState.update { it.copy(selectedCategory = category) }
    }

    fun onSearchQueryChanged(query: String) {
        _filterState.update { it.copy(searchQuery = query) }
    }

    fun onNaturalLanguageInputChanged(input: String) {
        _naturalLanguageInput.value = input
    }

    fun submitNaturalLanguageTask(inputOverride: String? = null) {
        val rawInput = (inputOverride ?: _naturalLanguageInput.value).trim()
        if (rawInput.isBlank()) return

        viewModelScope.launch {
            val draft = parseNaturalLanguageTaskUseCase(rawInput)
            createTaskUseCase(
                title = draft.title,
                category = draft.category,
                priority = draft.priority,
                estimatedMinutes = draft.estimatedMinutes,
                recurrence = draft.recurrence,
                tags = draft.tags
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
        dueDate: String? = null,
        dueTime: String? = null,
        estimatedMinutes: Int? = null,
        recurrence: TaskRecurrence = TaskRecurrence.NONE,
        tags: List<String> = emptyList(),
        isStarred: Boolean = false,
        subtasks: List<Subtask> = emptyList()
    ) {
        viewModelScope.launch {
            createTaskUseCase(
                title = title,
                description = description,
                category = category,
                priority = priority,
                dueDate = dueDate,
                dueTime = dueTime,
                estimatedMinutes = estimatedMinutes,
                recurrence = recurrence,
                tags = tags,
                isStarred = isStarred,
                subtasks = subtasks
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

    fun addSubtask(taskId: String, title: String) {
        if (title.isBlank()) return
        viewModelScope.launch {
            addSubtaskUseCase(taskId, title)
        }
    }

    fun toggleSubtask(taskId: String, subtaskId: String) {
        viewModelScope.launch {
            toggleSubtaskUseCase(taskId, subtaskId)
        }
    }

    fun deleteSubtask(taskId: String, subtaskId: String) {
        viewModelScope.launch {
            deleteSubtaskUseCase(taskId, subtaskId)
        }
    }

    fun clearFeedbackMessage() {
        _userFeedbackMessage.value = null
    }
}
