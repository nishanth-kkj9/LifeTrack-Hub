package com.lifetrack.data.local

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.lifetrack.core.SystemTimeProvider
import com.lifetrack.core.TimeProvider
import com.lifetrack.data.local.db.SqlCursor
import com.lifetrack.data.local.db.SqlDriver
import com.lifetrack.data.local.db.TaskDatabaseSchema

/**
 * Android SQLite implementation of SqlDriver backed by SQLiteOpenHelper.
 */
class AndroidSqlDriver(
    context: Context,
    databaseName: String = "lifetrack_tasks.db"
) : SqlDriver {

    private val dbHelper = object : SQLiteOpenHelper(context, databaseName, null, TaskDatabaseSchema.CURRENT_VERSION) {
        override fun onCreate(db: SQLiteDatabase) {
            // Creation handled via TaskDatabaseSchema.initializeSchema
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            // Handled via TaskDatabaseSchema migration hooks
        }
    }

    private val database: SQLiteDatabase = dbHelper.writableDatabase

    override fun execute(sql: String, bindArgs: Array<Any?>) {
        val stringArgs = bindArgs.map { it?.toString() }.toTypedArray()
        if (bindArgs.isEmpty()) {
            database.execSQL(sql)
        } else {
            database.execSQL(sql, stringArgs)
        }
    }

    override fun <T> query(sql: String, bindArgs: Array<Any?>, mapper: (SqlCursor) -> T): List<T> {
        val stringArgs = if (bindArgs.isEmpty()) null else bindArgs.map { it?.toString() }.toTypedArray()
        val cursor = database.rawQuery(sql, stringArgs)
        val results = mutableListOf<T>()
        try {
            val androidCursor = AndroidSqlCursor(cursor)
            while (androidCursor.next()) {
                results.add(mapper(androidCursor))
            }
        } finally {
            cursor.close()
        }
        return results
    }

    override fun <T> transaction(block: () -> T): T {
        database.beginTransaction()
        return try {
            val result = block()
            database.setTransactionSuccessful()
            result
        } finally {
            database.endTransaction()
        }
    }

    override fun close() {
        dbHelper.close()
    }

    private class AndroidSqlCursor(private val cursor: Cursor) : SqlCursor {
        override fun next(): Boolean = cursor.moveToNext()

        override fun getString(columnIndex: Int): String? =
            if (cursor.isNull(columnIndex)) null else cursor.getString(columnIndex)

        override fun getLong(columnIndex: Int): Long? =
            if (cursor.isNull(columnIndex)) null else cursor.getLong(columnIndex)

        override fun getInt(columnIndex: Int): Int? =
            if (cursor.isNull(columnIndex)) null else cursor.getInt(columnIndex)

        override fun getDouble(columnIndex: Int): Double? =
            if (cursor.isNull(columnIndex)) null else cursor.getDouble(columnIndex)

        override fun isNull(columnIndex: Int): Boolean = cursor.isNull(columnIndex)

        override fun close() {
            cursor.close()
        }
    }
}

/**
 * Android factory for creating a production durable TaskLocalDataSource.
 */
fun createAndroidTaskLocalDataSource(
    context: Context,
    databaseName: String = "lifetrack_tasks.db",
    timeProvider: TimeProvider = SystemTimeProvider()
): PersistentTaskLocalDataSource {
    val driver = AndroidSqlDriver(context, databaseName)
    return PersistentTaskLocalDataSource(driver, timeProvider)
}
