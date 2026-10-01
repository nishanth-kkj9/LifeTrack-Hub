package com.lifetrack

import com.lifetrack.core.json.JsonArray
import com.lifetrack.core.json.JsonObject
import com.lifetrack.core.json.JsonParser
import com.lifetrack.core.json.JsonPrimitive
import com.lifetrack.data.repository.TaskPayloadSerializer
import com.lifetrack.domain.model.Subtask
import com.lifetrack.domain.model.Task
import com.lifetrack.domain.model.TaskCategory
import com.lifetrack.domain.model.TaskPriority
import com.lifetrack.domain.model.TaskStatus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class JsonParserRoundTripTest {

    @Test
    fun testJsonParserWithSpecialCharacters() {
        val jsonStr = """
            {
                "title": "Study \"Algorithms\" & \\Data Structures\\",
                "notes": "Line 1\nLine 2\tTabbed | pipe",
                "emoji": "Rocket 🚀 and Graduation 🎓",
                "count": 42,
                "active": true,
                "nullable": null,
                "tags": ["cs", "vtu", "sem5"]
            }
        """.trimIndent()

        val parsed = JsonParser.parseObject(jsonStr)
        assertEquals("Study \"Algorithms\" & \\Data Structures\\", parsed.getString("title"))
        assertEquals("Line 1\nLine 2\tTabbed | pipe", parsed.getString("notes"))
        assertEquals("Rocket 🚀 and Graduation 🎓", parsed.getString("emoji"))
        assertEquals(42L, parsed.getLong("count"))
        assertEquals(true, parsed.getBoolean("active"))
        assertTrue(parsed.get("nullable")?.asPrimitive()?.isNull == true)

        val tags = parsed.getArray("tags")
        assertNotNull(tags)
        assertEquals(3, tags.size)
        assertEquals("cs", tags.get(0).stringOrNull)
        assertEquals("sem5", tags.get(2).stringOrNull)
    }

    @Test
    fun testTaskPayloadSerializerRoundTripWithSpecialCharacters() {
        val complexTask = Task(
            id = "task-json-spec-1",
            title = "Prepare for \"VTU\" Exams \\ Module 1 & 2",
            description = "Topics:\n1. Dynamic Programming\n2. Graph Traversals (Dijkstra | Bellman-Ford)\nPath: C:\\VTU\\Notes",
            category = TaskCategory.PROJECT,
            priority = TaskPriority.HIGH,
            status = TaskStatus.IN_PROGRESS,
            dueDate = "2026-10-15",
            dueTime = "14:30",
            dueDateEpochMs = 1729000000000L,
            completedAtEpochMs = null,
            estimatedMinutes = 120,
            actualMinutes = 45,
            isStarred = true,
            tags = listOf("vtu", "cbcs-2022", "urgent | vital"),
            notes = "Special: Quotes \"double\" and 'single', backslashes \\\\, newlines \n\n, and emojis: 🚀 🎓 💡",
            isDeleted = false,
            createdAtEpochMs = 1728000000000L,
            updatedAtEpochMs = 1728000010000L
        )

        val serialized = TaskPayloadSerializer.serializeTask(complexTask)
        assertTrue(serialized.startsWith("{"), "Serialized task must be JSON format")

        val deserialized = TaskPayloadSerializer.deserializeTask(serialized)
        assertNotNull(deserialized)

        assertEquals(complexTask.id, deserialized.id)
        assertEquals(complexTask.title, deserialized.title)
        assertEquals(complexTask.description, deserialized.description)
        assertEquals(complexTask.category, deserialized.category)
        assertEquals(complexTask.priority, deserialized.priority)
        assertEquals(complexTask.status, deserialized.status)
        assertEquals(complexTask.dueDate, deserialized.dueDate)
        assertEquals(complexTask.dueTime, deserialized.dueTime)
        assertEquals(complexTask.estimatedMinutes, deserialized.estimatedMinutes)
        assertEquals(complexTask.actualMinutes, deserialized.actualMinutes)
        assertEquals(complexTask.isStarred, deserialized.isStarred)
        assertEquals(complexTask.tags, deserialized.tags)
        assertEquals(complexTask.notes, deserialized.notes)
    }

    @Test
    fun testSubtaskPayloadSerializerRoundTripWithSpecialCharacters() {
        val complexSubtask = Subtask(
            id = "subtask-json-spec-1",
            taskId = "task-json-spec-1",
            title = "Solve \"Knapsack\" problem \\ Memoization | Tabulation \n 💡 Complete",
            completed = true,
            sortOrder = 2,
            estimatedMinutes = 30,
            updatedAtEpochMs = 1728000050000L,
            isDeleted = false
        )

        val serialized = TaskPayloadSerializer.serializeSubtask(complexSubtask)
        assertTrue(serialized.startsWith("{"), "Serialized subtask must be JSON format")

        val deserialized = TaskPayloadSerializer.deserializeSubtask(serialized)
        assertNotNull(deserialized)

        assertEquals(complexSubtask.id, deserialized.id)
        assertEquals(complexSubtask.taskId, deserialized.taskId)
        assertEquals(complexSubtask.title, deserialized.title)
        assertEquals(complexSubtask.completed, deserialized.completed)
        assertEquals(complexSubtask.sortOrder, deserialized.sortOrder)
        assertEquals(complexSubtask.estimatedMinutes, deserialized.estimatedMinutes)
    }

    @Test
    fun testTaskPayloadSerializerBackwardCompatibilityWithLegacyPipeFormat() {
        val legacyPayload = "legacy-1|Legacy \"Title\"|Legacy Description|PERSONAL|MEDIUM|TODO||||||0|NONE|tag1,tag2|1720000000000|1720000000000||||0"
        val parsed = TaskPayloadSerializer.deserializeTask(legacyPayload)
        assertNotNull(parsed)
        assertEquals("legacy-1", parsed.id)
        assertEquals("Legacy \"Title\"", parsed.title)
        assertEquals("Legacy Description", parsed.description)
        assertEquals(TaskCategory.PERSONAL, parsed.category)
    }
}
