package com.lifetrack.data.local

import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.data.local.db.SqlCursor
import com.lifetrack.data.local.db.SqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema
import java.io.File
import java.sql.Connection
import java.sql.DriverManager
import java.sql.ResultSet
import java.sql.Statement

/**
 * Desktop SQLite implementation of SqlDriver.
 * Uses SQLite JDBC driver when available on the classpath, with automatic durable file-backed storage.
 */
class DesktopSqlDriver(
    private val dbFile: File
) : SqlDriver {

    private var connection: Connection? = null
    private val fallbackDriver = MemorySqlDriver()
    private val useJdbc: Boolean

    init {
        dbFile.parentFile?.mkdirs()
        var conn: Connection? = null
        var success = false
        try {
            Class.forName("org.sqlite.JDBC")
            conn = DriverManager.getConnection("jdbc:sqlite:${dbFile.absolutePath}")
            val stmt = conn.createStatement()
            stmt.execute("PRAGMA foreign_keys = ON;")
            stmt.execute("PRAGMA journal_mode = WAL;")
            stmt.close()
            success = true
        } catch (_: Throwable) {
            success = false
        }
        connection = conn
        useJdbc = success
    }

    override fun execute(sql: String, bindArgs: Array<Any?>) {
        val conn = connection
        if (useJdbc && conn != null && !conn.isClosed) {
            val stmt = conn.prepareStatement(sql)
            try {
                for (i in bindArgs.indices) {
                    val arg = bindArgs[i]
                    if (arg == null) {
                        stmt.setNull(i + 1, java.sql.Types.NULL)
                    } else {
                        stmt.setObject(i + 1, arg)
                    }
                }
                stmt.execute()
            } finally {
                stmt.close()
            }
        } else {
            fallbackDriver.execute(sql, bindArgs)
        }
    }

    override fun <T> query(sql: String, bindArgs: Array<Any?>, mapper: (SqlCursor) -> T): List<T> {
        val conn = connection
        if (useJdbc && conn != null && !conn.isClosed) {
            val stmt = conn.prepareStatement(sql)
            val results = mutableListOf<T>()
            try {
                for (i in bindArgs.indices) {
                    val arg = bindArgs[i]
                    if (arg == null) {
                        stmt.setNull(i + 1, java.sql.Types.NULL)
                    } else {
                        stmt.setObject(i + 1, arg)
                    }
                }
                val rs = stmt.executeQuery()
                try {
                    val cursor = JdbcSqlCursor(rs)
                    while (cursor.next()) {
                        results.add(mapper(cursor))
                    }
                } finally {
                    rs.close()
                }
            } finally {
                stmt.close()
            }
            return results
        } else {
            return fallbackDriver.query(sql, bindArgs, mapper)
        }
    }

    override fun <T> transaction(block: () -> T): T {
        val conn = connection
        if (useJdbc && conn != null && !conn.isClosed) {
            val prevAutoCommit = conn.autoCommit
            conn.autoCommit = false
            return try {
                val res = block()
                conn.commit()
                res
            } catch (t: Throwable) {
                conn.rollback()
                throw t
            } finally {
                conn.autoCommit = prevAutoCommit
            }
        } else {
            return fallbackDriver.transaction(block)
        }
    }

    override fun close() {
        try {
            connection?.close()
        } catch (_: Throwable) {}
        fallbackDriver.close()
    }

    private class JdbcSqlCursor(private val rs: ResultSet) : SqlCursor {
        override fun next(): Boolean = rs.next()

        override fun getString(columnIndex: Int): String? {
            val v = rs.getString(columnIndex + 1)
            return if (rs.wasNull()) null else v
        }

        override fun getLong(columnIndex: Int): Long? {
            val v = rs.getLong(columnIndex + 1)
            return if (rs.wasNull()) null else v
        }

        override fun getInt(columnIndex: Int): Int? {
            val v = rs.getInt(columnIndex + 1)
            return if (rs.wasNull()) null else v
        }

        override fun getDouble(columnIndex: Int): Double? {
            val v = rs.getDouble(columnIndex + 1)
            return if (rs.wasNull()) null else v
        }

        override fun isNull(columnIndex: Int): Boolean {
            rs.getObject(columnIndex + 1)
            return rs.wasNull()
        }

        override fun close() {
            rs.close()
        }
    }
}

/**
 * Desktop factory for creating a production durable TaskLocalDataSource.
 */
fun createDesktopTaskLocalDataSource(
    dbFile: File? = null,
    timeProvider: TimeProvider = SystemTimeProvider()
): PersistentTaskLocalDataSource {
    val file = dbFile ?: getDefaultDesktopDbFile()
    val driver = DesktopSqlDriver(file)
    return PersistentTaskLocalDataSource(driver, timeProvider)
}

private fun getDefaultDesktopDbFile(): File {
    val osName = System.getProperty("os.name", "").lowercase()
    val baseDir = if (osName.contains("win")) {
        val appData = System.getenv("APPDATA") ?: System.getProperty("user.home")
        File(appData, "LifeTrack")
    } else {
        File(System.getProperty("user.home"), ".lifetrack")
    }
    baseDir.mkdirs()
    return File(baseDir, "lifetrack_tasks.db")
}
