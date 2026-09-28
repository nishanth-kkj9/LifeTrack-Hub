package com.lifetrack.data.local

import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.db.SqlCursor
import com.lifetrack.data.local.db.SqlDriver
import java.io.File
import java.sql.Connection
import java.sql.DriverManager
import java.sql.ResultSet

/**
 * Desktop SQLite implementation of SqlDriver.
 * Enforces production file-backed SQLite persistence with foreign keys and WAL mode.
 * Fails fast and diagnostically if SQLite JDBC is missing or fails to initialize.
 */
class DesktopSqlDriver(
    private val dbFile: File
) : SqlDriver {

    private val connection: Connection

    init {
        dbFile.parentFile?.mkdirs()
        try {
            Class.forName("org.sqlite.JDBC")
            val conn = DriverManager.getConnection("jdbc:sqlite:${dbFile.absolutePath}")
            val stmt = conn.createStatement()
            stmt.execute("PRAGMA foreign_keys = ON;")
            stmt.execute("PRAGMA journal_mode = WAL;")
            stmt.close()
            connection = conn
        } catch (t: Throwable) {
            throw IllegalStateException(
                "Failed to initialize production SQLite database at ${dbFile.absolutePath}. " +
                "SQLite JDBC driver must be present on the runtime classpath. Diagnostic cause: ${t.message}",
                t
            )
        }
    }

    override fun execute(sql: String, bindArgs: Array<Any?>) {
        checkNotClosed()
        val stmt = connection.prepareStatement(sql)
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
    }

    override fun <T> query(sql: String, bindArgs: Array<Any?>, mapper: (SqlCursor) -> T): List<T> {
        checkNotClosed()
        val stmt = connection.prepareStatement(sql)
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
    }

    override fun <T> transaction(block: () -> T): T {
        checkNotClosed()
        val prevAutoCommit = connection.autoCommit
        connection.autoCommit = false
        return try {
            val res = block()
            connection.commit()
            res
        } catch (t: Throwable) {
            connection.rollback()
            throw t
        } finally {
            connection.autoCommit = prevAutoCommit
        }
    }

    override fun close() {
        try {
            if (!connection.isClosed) {
                connection.close()
            }
        } catch (_: Throwable) {}
    }

    private fun checkNotClosed() {
        check(!connection.isClosed) { "Desktop SQLite connection is closed." }
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

fun getDefaultDesktopDbFile(): File {
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
