package com.lifetrack.domain.usecase

import com.lifetrack.domain.model.Task
import com.lifetrack.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow

class GetTasksUseCase(private val repository: TaskRepository) {
    operator fun invoke(): Flow<List<Task>> = repository.getTasks()
}

class CreateTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(task: Task) {
        require(task.title.isNotBlank()) { "Task title cannot be blank" }
        repository.saveTask(task)
    }
}

class ToggleTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(taskId: String) {
        repository.toggleTaskCompletion(taskId)
    }
}
