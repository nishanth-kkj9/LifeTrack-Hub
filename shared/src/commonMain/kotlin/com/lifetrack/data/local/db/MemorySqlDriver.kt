package com.lifetrack.data.local.db

/**
 * Thread-safe multiplatform in-memory SQL driver storing structured relational tables.
 * Used for fast unit testing and platform-independent SQL persistence verification.
 */
class MemorySqlDriver : SqlDriver {

    private val tables = mutableMapOf<String, MutableMap<String, MutableMap<String, Any?>>>()
    private var inTransaction = false
    private var isClosed = false

    override fun execute(sql: String, bindArgs: Array<Any?>) {
        checkNotClosed()
        val trimmed = sql.trim()
        val upper = trimmed.uppercase()

        when {
            upper.startsWith("CREATE TABLE") -> {
                val tableName = extractTableNameFromCreate(trimmed)
                if (tableName.isNotBlank()) {
                    tables.getOrPut(tableName.lowercase()) { mutableMapOf() }
                }
            }
            upper.startsWith("INSERT INTO SCHEMA_VERSION") -> {
                val table = tables.getOrPut("schema_version") { mutableMapOf() }
                val ver = bindArgs.getOrNull(0) ?: 1
                table["1"] = mutableMapOf("version" to ver)
            }
            upper.startsWith("UPDATE SCHEMA_VERSION") -> {
                val table = tables.getOrPut("schema_version") { mutableMapOf() }
                val ver = bindArgs.getOrNull(0) ?: 1
                table["1"] = mutableMapOf("version" to ver)
            }
            upper.startsWith("INSERT OR REPLACE INTO TASKS") || upper.startsWith("INSERT INTO TASKS") -> {
                val table = tables.getOrPut("tasks") { mutableMapOf() }
                val id = bindArgs[0]?.toString() ?: return
                val row = mutableMapOf<String, Any?>(
                    "id" to bindArgs.getOrNull(0),
                    "title" to bindArgs.getOrNull(1),
                    "description" to bindArgs.getOrNull(2),
                    "category" to bindArgs.getOrNull(3),
                    "priority" to bindArgs.getOrNull(4),
                    "status" to bindArgs.getOrNull(5),
                    "due_date" to bindArgs.getOrNull(6),
                    "due_time" to bindArgs.getOrNull(7),
                    "due_date_epoch_ms" to bindArgs.getOrNull(8),
                    "completed_at_epoch_ms" to bindArgs.getOrNull(9),
                    "estimated_minutes" to bindArgs.getOrNull(10),
                    "actual_minutes" to bindArgs.getOrNull(11),
                    "is_starred" to bindArgs.getOrNull(12),
                    "recurrence" to bindArgs.getOrNull(13),
                    "tags" to bindArgs.getOrNull(14),
                    "is_sync_pending" to bindArgs.getOrNull(15),
                    "is_deleted" to bindArgs.getOrNull(16),
                    "created_at_epoch_ms" to bindArgs.getOrNull(17),
                    "updated_at_epoch_ms" to bindArgs.getOrNull(18),
                    "subject_id" to bindArgs.getOrNull(19),
                    "exam_id" to bindArgs.getOrNull(20),
                    "notes" to bindArgs.getOrNull(21)
                )
                table[id] = row
            }
            upper.startsWith("UPDATE TASKS SET") -> {
                val table = tables.getOrPut("tasks") { mutableMapOf() }
                if (upper.contains("IS_DELETED = 1")) {
                    val id = bindArgs.getOrNull(2)?.toString() ?: bindArgs.lastOrNull()?.toString() ?: return
                    val existing = table[id]
                    if (existing != null) {
                        existing["is_deleted"] = 1
                        existing["updated_at_epoch_ms"] = bindArgs.getOrNull(0) ?: bindArgs.getOrNull(1)
                        existing["is_sync_pending"] = 1
                    }
                } else if (upper.contains("STATUS = ?")) {
                    val status = bindArgs[0]?.toString()
                    val completedAt = bindArgs[1] as? Long
                    val updatedAt = bindArgs[2] as? Long
                    val isSyncPending = bindArgs[3]
                    val id = bindArgs[4]?.toString() ?: return
                    val existing = table[id]
                    if (existing != null) {
                        existing["status"] = status
                        existing["completed_at_epoch_ms"] = completedAt
                        existing["updated_at_epoch_ms"] = updatedAt
                        existing["is_sync_pending"] = isSyncPending
                    }
                }
            }
            upper.startsWith("INSERT OR REPLACE INTO SUBTASKS") || upper.startsWith("INSERT INTO SUBTASKS") -> {
                val table = tables.getOrPut("subtasks") { mutableMapOf() }
                val id = bindArgs[0]?.toString() ?: return
                val row = mutableMapOf<String, Any?>(
                    "id" to bindArgs.getOrNull(0),
                    "task_id" to bindArgs.getOrNull(1),
                    "title" to bindArgs.getOrNull(2),
                    "completed" to bindArgs.getOrNull(3),
                    "sort_order" to bindArgs.getOrNull(4),
                    "estimated_minutes" to bindArgs.getOrNull(5),
                    "updated_at_epoch_ms" to bindArgs.getOrNull(6),
                    "is_deleted" to bindArgs.getOrNull(7)
                )
                table[id] = row
            }
            upper.startsWith("UPDATE SUBTASKS SET") -> {
                val table = tables.getOrPut("subtasks") { mutableMapOf() }
                if (upper.contains("IS_DELETED = 1")) {
                    val id = bindArgs.lastOrNull()?.toString() ?: return
                    val existing = table[id]
                    if (existing != null) {
                        existing["is_deleted"] = 1
                        existing["updated_at_epoch_ms"] = bindArgs.getOrNull(0)
                    }
                } else if (upper.contains("COMPLETED = ?")) {
                    val completed = bindArgs[0]
                    val updatedAt = bindArgs[1]
                    val id = bindArgs[2]?.toString() ?: return
                    val existing = table[id]
                    if (existing != null) {
                        existing["completed"] = completed
                        existing["updated_at_epoch_ms"] = updatedAt
                    }
                }
            }
            upper.startsWith("DELETE FROM SUBTASKS WHERE TASK_ID = ?") -> {
                val taskId = bindArgs.getOrNull(0)?.toString()
                if (taskId != null) {
                    val subtasks = tables.getOrPut("subtasks") { mutableMapOf() }
                    val toRemove = subtasks.filterValues { it["task_id"]?.toString() == taskId }.keys
                    toRemove.forEach { subtasks.remove(it) }
                }
            }
        }
    }

    override fun <T> query(sql: String, bindArgs: Array<Any?>, mapper: (SqlCursor) -> T): List<T> {
        checkNotClosed()
        val trimmed = sql.trim()
        val upper = trimmed.uppercase()
        val results = mutableListOf<T>()

        when {
            upper.contains("FROM SCHEMA_VERSION") -> {
                val table = tables["schema_version"] ?: emptyMap()
                val ver = table.values.firstOrNull()?.get("version") ?: 0
                val cursor = MemoryCursor(listOf(listOf(ver)))
                while (cursor.next()) {
                    results.add(mapper(cursor))
                }
            }
            upper.contains("FROM TASKS") -> {
                val taskTable = tables["tasks"] ?: emptyMap()
                val isSingleTask = upper.contains("WHERE ID = ?")
                val filterId = if (isSingleTask) bindArgs.getOrNull(0)?.toString() else null

                val rows = taskTable.values
                    .filter { row ->
                        val matchesId = filterId == null || row["id"]?.toString() == filterId
                        val notDeleted = (row["is_deleted"] as? Number)?.toInt() != 1
                        matchesId && notDeleted
                    }
                    .sortedWith(
                        compareByDescending<Map<String, Any?>> { ((it["is_starred"] as? Number)?.toInt() ?: 0) == 1 }
                            .thenBy { it["status"]?.toString() == "COMPLETED" }
                            .thenByDescending { (it["created_at_epoch_ms"] as? Number)?.toLong() ?: 0L }
                    )

                for (row in rows) {
                    val values = listOf(
                        row["id"], row["title"], row["description"], row["category"],
                        row["priority"], row["status"], row["due_date"], row["due_time"],
                        row["due_date_epoch_ms"], row["completed_at_epoch_ms"],
                        row["estimated_minutes"], row["actual_minutes"],
                        row["is_starred"], row["recurrence"], row["tags"],
                        row["is_sync_pending"], row["is_deleted"],
                        row["created_at_epoch_ms"], row["updated_at_epoch_ms"],
                        row["subject_id"], row["exam_id"], row["notes"]
                    )
                    val cursor = MemoryCursor(listOf(values))
                    while (cursor.next()) {
                        results.add(mapper(cursor))
                    }
                }
            }
            upper.contains("FROM SUBTASKS") -> {
                val subtaskTable = tables["subtasks"] ?: emptyMap()
                val taskId = bindArgs.getOrNull(0)?.toString()

                val rows = subtaskTable.values
                    .filter { row ->
                        val matchesTask = taskId == null || row["task_id"]?.toString() == taskId
                        val notDeleted = (row["is_deleted"] as? Number)?.toInt() != 1
                        matchesTask && notDeleted
                    }
                    .sortedBy { (it["sort_order"] as? Number)?.toInt() ?: 0 }

                for (row in rows) {
                    val values = listOf(
                        row["id"], row["task_id"], row["title"], row["completed"],
                        row["sort_order"], row["estimated_minutes"],
                        row["updated_at_epoch_ms"], row["is_deleted"]
                    )
                    val cursor = MemoryCursor(listOf(values))
                    while (cursor.next()) {
                        results.add(mapper(cursor))
                    }
                }
            }
        }
        return results
    }

    override fun <T> transaction(block: () -> T): T {
        checkNotClosed()
        inTransaction = true
        return try {
            block()
        } finally {
            inTransaction = false
        }
    }

    override fun close() {
        isClosed = true
    }

    private fun checkNotClosed() {
        check(!isClosed) { "Database driver is closed" }
    }

    private fun extractTableNameFromCreate(sql: String): String {
        val parts = sql.split(Regex("""\s+"""))
        val tableIdx = parts.indexOfFirst { it.equals("TABLE", ignoreCase = true) }
        if (tableIdx != -1 && tableIdx + 1 < parts.size) {
            var name = parts[tableIdx + 1]
            if (name.equals("IF", ignoreCase = true) && tableIdx + 3 < parts.size) {
                name = parts[tableIdx + 3]
            }
            return name.replace("(", "").replace(";", "").trim()
        }
        return ""
    }

    private class MemoryCursor(private val rows: List<List<Any?>>) : SqlCursor {
        private var currentIndex = -1

        override fun next(): Boolean {
            currentIndex++
            return currentIndex < rows.size
        }

        override fun getString(columnIndex: Int): String? {
            return rows.getOrNull(currentIndex)?.getOrNull(columnIndex)?.toString()
        }

        override fun getLong(columnIndex: Int): Long? {
            val v = rows.getOrNull(currentIndex)?.getOrNull(columnIndex) ?: return null
            return when (v) {
                is Number -> v.toLong()
                is String -> v.toLongOrNull()
                else -> null
            }
        }

        override fun getInt(columnIndex: Int): Int? {
            val v = rows.getOrNull(currentIndex)?.getOrNull(columnIndex) ?: return null
            return when (v) {
                is Number -> v.toInt()
                is String -> v.toIntOrNull()
                is Boolean -> if (v) 1 else 0
                else -> null
            }
        }

        override fun getDouble(columnIndex: Int): Double? {
            val v = rows.getOrNull(currentIndex)?.getOrNull(columnIndex) ?: return null
            return when (v) {
                is Number -> v.toDouble()
                is String -> v.toDoubleOrNull()
                else -> null
            }
        }

        override fun isNull(columnIndex: Int): Boolean {
            return rows.getOrNull(currentIndex)?.getOrNull(columnIndex) == null
        }
    }
}
