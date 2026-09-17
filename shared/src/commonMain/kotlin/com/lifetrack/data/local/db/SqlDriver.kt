package com.lifetrack.data.local.db

/**
 * Interface representing a database cursor for iterating over query results.
 */
interface SqlCursor : AutoCloseable {
    fun next(): Boolean
    fun getString(columnIndex: Int): String?
    fun getLong(columnIndex: Int): Long?
    fun getInt(columnIndex: Int): Int?
    fun getDouble(columnIndex: Int): Double?
    fun getBoolean(columnIndex: Int): Boolean? {
        val intVal = getInt(columnIndex) ?: return null
        return intVal != 0
    }
    fun isNull(columnIndex: Int): Boolean
    override fun close() {}
}

/**
 * Migration definition for upgrading database schema from startVersion to endVersion.
 */
interface DatabaseMigration {
    val startVersion: Int
    val endVersion: Int
    fun migrate(driver: SqlDriver)
}

/**
 * Multiplatform SQL driver abstraction providing atomic transactions, parameter binding,
 * and cursor-based query execution across Android (SQLite) and Desktop (file-backed SQLite).
 */
interface SqlDriver : AutoCloseable {
    fun execute(sql: String, bindArgs: Array<Any?> = emptyArray())
    fun <T> query(sql: String, bindArgs: Array<Any?> = emptyArray(), mapper: (SqlCursor) -> T): List<T>
    fun <T> transaction(block: () -> T): T
    override fun close()
}
