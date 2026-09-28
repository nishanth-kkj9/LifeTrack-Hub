package com.lifetrack.data.local.db

/**
 * In-memory test double of SqlDriver.
 * Note: MemorySqlDriver is exclusively a test double for shared unit tests,
 * not a production transactional persistence engine.
 */
class MemorySqlDriver : SqlDriver {

    private val tables = mutableMapOf<String, MutableMap<String, MutableMap<String, Any?>>>()
    private var inTransaction = false
    private var isClosed = false

    override fun execute(sql: String, bindArgs: Array<Any?>) {
        checkNotClosed()
        val trimmed = sql.trim()
        val upper = trimmed.uppercase().replace(Regex("""\s+"""), " ")

        when {
            upper.startsWith("CREATE TABLE") -> {
                val tableName = extractTableNameFromCreate(trimmed)
                if (tableName.isNotBlank()) {
                    tables.getOrPut(tableName.lowercase()) { mutableMapOf() }
                }
            }
            upper.startsWith("INSERT INTO SCHEMA_VERSION") || upper.startsWith("INSERT OR REPLACE INTO SCHEMA_VERSION") -> {
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
                if (upper.contains("IS_SYNC_PENDING = 0")) {
                    val id = bindArgs.lastOrNull()?.toString() ?: return
                    table[id]?.put("is_sync_pending", 0)
                } else if (upper.contains("IS_DELETED = 1")) {
                    val id = bindArgs.lastOrNull()?.toString() ?: return
                    val existing = table[id]
                    if (existing != null) {
                        existing["is_deleted"] = 1
                        existing["updated_at_epoch_ms"] = bindArgs.getOrNull(0) ?: bindArgs.getOrNull(1)
                        existing["is_sync_pending"] = 1
                    }
                } else if (upper.contains("TITLE = ?")) {
                    val title = bindArgs[0]?.toString()
                    val id = bindArgs.lastOrNull()?.toString() ?: return
                    table[id]?.put("title", title)
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
            upper.startsWith("DELETE FROM TASKS WHERE ID = ?") -> {
                val id = bindArgs.getOrNull(0)?.toString() ?: return
                tables["tasks"]?.remove(id)
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
                    if (upper.contains("WHERE TASK_ID = ?")) {
                        val taskId = bindArgs.lastOrNull()?.toString()
                        val updatedAt = bindArgs.getOrNull(0)
                        for (row in table.values) {
                            if (row["task_id"]?.toString() == taskId) {
                                row["is_deleted"] = 1
                                row["updated_at_epoch_ms"] = updatedAt
                            }
                        }
                    } else {
                        val id = bindArgs.lastOrNull()?.toString() ?: return
                        val existing = table[id]
                        if (existing != null) {
                            existing["is_deleted"] = 1
                            existing["updated_at_epoch_ms"] = bindArgs.getOrNull(0)
                        }
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
            upper.startsWith("INSERT OR REPLACE INTO SYNC_OUTBOX") || upper.startsWith("INSERT INTO SYNC_OUTBOX") -> {
                val table = tables.getOrPut("sync_outbox") { mutableMapOf() }
                val id = bindArgs[0]?.toString() ?: return
                val row = mutableMapOf<String, Any?>(
                    "id" to bindArgs.getOrNull(0),
                    "entity_type" to bindArgs.getOrNull(1),
                    "entity_id" to bindArgs.getOrNull(2),
                    "operation" to bindArgs.getOrNull(3),
                    "payload" to bindArgs.getOrNull(4),
                    "hlc_timestamp" to bindArgs.getOrNull(5),
                    "created_at" to bindArgs.getOrNull(6),
                    "origin_device_id" to (bindArgs.getOrNull(7) ?: "local-device"),
                    "protocol_version" to (bindArgs.getOrNull(8) ?: 1),
                    "schema_version" to (bindArgs.getOrNull(9) ?: 1),
                    "status" to (bindArgs.getOrNull(10) ?: "PENDING"),
                    "in_flight_at" to bindArgs.getOrNull(11),
                    "retry_count" to (bindArgs.getOrNull(12) ?: 0),
                    "next_retry_at" to (bindArgs.getOrNull(13) ?: 0L),
                    "last_error" to bindArgs.getOrNull(14)
                )
                table[id] = row
            }
            upper.startsWith("UPDATE SYNC_OUTBOX SET") -> {
                val table = tables.getOrPut("sync_outbox") { mutableMapOf() }
                if (upper.contains("SET STATUS = 'IN_FLIGHT'")) {
                    val inFlightAt = bindArgs.getOrNull(0)
                    val id = bindArgs.getOrNull(1)?.toString() ?: return
                    table[id]?.put("status", "IN_FLIGHT")
                    table[id]?.put("in_flight_at", inFlightAt)
                } else if (upper.contains("SET STATUS = 'PENDING', IN_FLIGHT_AT = NULL")) {
                    val cutoff = (bindArgs.getOrNull(0) as? Number)?.toLong()
                    for (row in table.values) {
                        if (row["status"] == "IN_FLIGHT") {
                            val inFlightAt = (row["in_flight_at"] as? Number)?.toLong()
                            if (cutoff == null || inFlightAt == null || inFlightAt <= cutoff) {
                                row["status"] = "PENDING"
                                row["in_flight_at"] = null
                            }
                        }
                    }
                } else if (upper.contains("RETRY_COUNT = ?, NEXT_RETRY_AT = ?, LAST_ERROR = ?, STATUS = ?")) {
                    val retry = bindArgs.getOrNull(0)
                    val nextRetry = bindArgs.getOrNull(1)
                    val lastErr = bindArgs.getOrNull(2)
                    val status = bindArgs.getOrNull(3)
                    val id = bindArgs.getOrNull(4)?.toString() ?: return
                    table[id]?.put("retry_count", retry)
                    table[id]?.put("next_retry_at", nextRetry)
                    table[id]?.put("last_error", lastErr)
                    table[id]?.put("status", status)
                    table[id]?.put("in_flight_at", null)
                } else if (upper.contains("STATUS = 'PENDING', RETRY_COUNT = 0")) {
                    if (upper.contains("WHERE ID = ?")) {
                        val id = bindArgs.getOrNull(0)?.toString() ?: return
                        table[id]?.let {
                            it["status"] = "PENDING"
                            it["retry_count"] = 0
                            it["next_retry_at"] = 0L
                            it["in_flight_at"] = null
                            it["last_error"] = null
                        }
                    } else {
                        for (row in table.values) {
                            if (row["status"] == "FAILED") {
                                row["status"] = "PENDING"
                                row["retry_count"] = 0
                                row["next_retry_at"] = 0L
                                row["in_flight_at"] = null
                                row["last_error"] = null
                            }
                        }
                    }
                }
            }
            upper.startsWith("DELETE FROM SYNC_OUTBOX") -> {
                val table = tables.getOrPut("sync_outbox") { mutableMapOf() }
                if (upper.contains("WHERE ID = ?")) {
                    val id = bindArgs.getOrNull(0)?.toString()
                    if (id != null) table.remove(id)
                } else {
                    for (arg in bindArgs) {
                        val id = arg?.toString()
                        if (id != null) table.remove(id)
                    }
                }
            }
            upper.startsWith("INSERT OR REPLACE INTO SYNC_STATE") || upper.startsWith("INSERT INTO SYNC_STATE") -> {
                val table = tables.getOrPut("sync_state") { mutableMapOf() }
                val deviceId = bindArgs[0]?.toString() ?: return
                table[deviceId] = mutableMapOf(
                    "device_id" to bindArgs.getOrNull(0),
                    "last_pulled_hlc" to bindArgs.getOrNull(1),
                    "last_successful_sync_time" to bindArgs.getOrNull(2),
                    "last_error" to bindArgs.getOrNull(3)
                )
            }
            upper.startsWith("INSERT OR REPLACE INTO ENTITY_SYNC_METADATA") || upper.startsWith("INSERT INTO ENTITY_SYNC_METADATA") -> {
                val table = tables.getOrPut("entity_sync_metadata") { mutableMapOf() }
                val type = bindArgs[0]?.toString() ?: return
                val id = bindArgs[1]?.toString() ?: return
                val key = "${type}_$id"
                table[key] = mutableMapOf(
                    "entity_type" to type,
                    "entity_id" to id,
                    "hlc_timestamp" to bindArgs.getOrNull(2),
                    "is_deleted" to (bindArgs.getOrNull(3) ?: 0),
                    "updated_at" to bindArgs.getOrNull(4)
                )
            }
            upper.startsWith("INSERT OR REPLACE INTO DEVICE_CONFIG") || upper.startsWith("INSERT INTO DEVICE_CONFIG") -> {
                val table = tables.getOrPut("device_config") { mutableMapOf() }
                val key = bindArgs[0]?.toString() ?: return
                table[key] = mutableMapOf(
                    "config_key" to bindArgs.getOrNull(0),
                    "config_value" to bindArgs.getOrNull(1)
                )
            }
            upper.startsWith("INSERT OR REPLACE INTO HLC_CLOCK_STATE") || upper.startsWith("INSERT INTO HLC_CLOCK_STATE") -> {
                val table = tables.getOrPut("hlc_clock_state") { mutableMapOf() }
                val nodeId = bindArgs[0]?.toString() ?: return
                table[nodeId] = mutableMapOf(
                    "node_id" to bindArgs.getOrNull(0),
                    "physical_time_ms" to bindArgs.getOrNull(1),
                    "logical_counter" to bindArgs.getOrNull(2),
                    "hlc_string" to bindArgs.getOrNull(3)
                )
            }
        }
    }

    override fun <T> query(sql: String, bindArgs: Array<Any?>, mapper: (SqlCursor) -> T): List<T> {
        checkNotClosed()
        val trimmed = sql.trim()
        val upper = trimmed.uppercase().replace(Regex("""\s+"""), " ")
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
            upper.contains("FROM DEVICE_CONFIG") -> {
                val table = tables["device_config"] ?: emptyMap()
                val key = if (upper.contains("CONFIG_KEY = 'INSTALLATION_DEVICE_ID'")) "installation_device_id" else bindArgs.getOrNull(0)?.toString()
                val row = if (key != null) table[key] else table.values.firstOrNull()
                if (row != null) {
                    val cursor = MemoryCursor(listOf(listOf(row["config_value"])))
                    while (cursor.next()) {
                        results.add(mapper(cursor))
                    }
                }
            }
            upper.contains("FROM HLC_CLOCK_STATE") -> {
                val table = tables["hlc_clock_state"] ?: emptyMap()
                val nodeId = bindArgs.getOrNull(0)?.toString()
                val row = if (nodeId != null) table[nodeId] else table.values.firstOrNull()
                if (row != null) {
                    val cursor = MemoryCursor(listOf(listOf(row["physical_time_ms"], row["logical_counter"], row["node_id"])))
                    while (cursor.next()) {
                        results.add(mapper(cursor))
                    }
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
            upper.contains("FROM SYNC_OUTBOX") -> {
                val outboxTable = tables["sync_outbox"] ?: emptyMap()
                if (upper.contains("SELECT COUNT(*) FROM SYNC_OUTBOX")) {
                    val entityType = if (upper.contains("ENTITY_TYPE = 'TASK'")) "TASK" else bindArgs.getOrNull(0)?.toString()
                    val entityId = if (upper.contains("ENTITY_TYPE = 'TASK'")) bindArgs.getOrNull(0)?.toString() else bindArgs.getOrNull(1)?.toString()
                    val count = outboxTable.values.count {
                        (entityType == null || it["entity_type"]?.toString() == entityType) &&
                        (entityId == null || it["entity_id"]?.toString() == entityId)
                    }
                    val cursor = MemoryCursor(listOf(listOf(count)))
                    while (cursor.next()) {
                        results.add(mapper(cursor))
                    }
                } else if (upper.contains("SELECT RETRY_COUNT FROM SYNC_OUTBOX")) {
                    val id = bindArgs.getOrNull(0)?.toString()
                    val row = if (id != null) outboxTable[id] else outboxTable.values.firstOrNull()
                    if (row != null) {
                        val cursor = MemoryCursor(listOf(listOf(row["retry_count"])))
                        while (cursor.next()) {
                            results.add(mapper(cursor))
                        }
                    }
                } else if (upper.contains("SELECT ENTITY_TYPE, ENTITY_ID FROM SYNC_OUTBOX")) {
                    val id = bindArgs.getOrNull(0)?.toString()
                    val row = if (id != null) outboxTable[id] else outboxTable.values.firstOrNull()
                    if (row != null) {
                        val cursor = MemoryCursor(listOf(listOf(row["entity_type"], row["entity_id"])))
                        while (cursor.next()) {
                            results.add(mapper(cursor))
                        }
                    }
                } else {
                    val filterPending = upper.contains("STATUS = 'PENDING'")
                    val checkRetryTime = upper.contains("NEXT_RETRY_AT <= ?")
                    val targetRetryTime = if (checkRetryTime) (bindArgs.getOrNull(0) as? Number)?.toLong() ?: Long.MAX_VALUE else Long.MAX_VALUE
                    val filterId = if (upper.contains("WHERE ID = ?")) bindArgs.getOrNull(0)?.toString() else null

                    val rows = outboxTable.values
                        .filter { row ->
                            val matchesId = filterId == null || row["id"]?.toString() == filterId
                            val status = row["status"]?.toString() ?: "PENDING"
                            val nextRetry = (row["next_retry_at"] as? Number)?.toLong() ?: 0L
                            val matchesPending = if (filterPending) (status == "PENDING" && nextRetry <= targetRetryTime) else true
                            matchesId && matchesPending
                        }
                        .sortedBy { (it["created_at"] as? Number)?.toLong() ?: 0L }

                    for (row in rows) {
                        val values = listOf(
                            row["id"], row["entity_type"], row["entity_id"],
                            row["operation"], row["payload"], row["hlc_timestamp"],
                            row["created_at"],
                            row["origin_device_id"] ?: "local-device",
                            row["protocol_version"] ?: 1,
                            row["schema_version"] ?: 1,
                            row["status"], row["in_flight_at"],
                            row["retry_count"], row["next_retry_at"], row["last_error"]
                        )
                        val cursor = MemoryCursor(listOf(values))
                        while (cursor.next()) {
                            results.add(mapper(cursor))
                        }
                    }
                }
            }
            upper.contains("FROM SYNC_STATE") -> {
                val stateTable = tables["sync_state"] ?: emptyMap()
                val deviceId = bindArgs.getOrNull(0)?.toString()
                val row = if (deviceId != null) stateTable[deviceId] else stateTable.values.firstOrNull()
                if (row != null) {
                    if (upper.contains("SELECT LAST_PULLED_HLC FROM SYNC_STATE")) {
                        val cursor = MemoryCursor(listOf(listOf(row["last_pulled_hlc"])))
                        while (cursor.next()) {
                            results.add(mapper(cursor))
                        }
                    } else {
                        val values = listOf(
                            row["device_id"], row["last_pulled_hlc"],
                            row["last_successful_sync_time"], row["last_error"]
                        )
                        val cursor = MemoryCursor(listOf(values))
                        while (cursor.next()) {
                            results.add(mapper(cursor))
                        }
                    }
                }
            }
            upper.contains("FROM ENTITY_SYNC_METADATA") -> {
                val metaTable = tables["entity_sync_metadata"] ?: emptyMap()
                val type = bindArgs.getOrNull(0)?.toString() ?: ""
                val id = bindArgs.getOrNull(1)?.toString() ?: ""
                val row = metaTable["${type}_$id"]
                if (row != null) {
                    val values = listOf(
                        row["entity_type"], row["entity_id"],
                        row["hlc_timestamp"], row["is_deleted"], row["updated_at"]
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
        // Deep snapshot for rollback simulation in unit tests
        val snapshot = mutableMapOf<String, MutableMap<String, MutableMap<String, Any?>>>()
        for ((tbl, rows) in tables) {
            val rowsCopy = mutableMapOf<String, MutableMap<String, Any?>>()
            for ((id, cols) in rows) {
                rowsCopy[id] = HashMap(cols)
            }
            snapshot[tbl] = rowsCopy
        }

        inTransaction = true
        return try {
            block()
        } catch (t: Throwable) {
            tables.clear()
            tables.putAll(snapshot)
            throw t
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
