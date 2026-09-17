package com.lifetrack.data.local.db

/**
 * Authoritative schema definition and migration runner for LifeTrack local task persistence.
 */
object TaskDatabaseSchema {

    const val CURRENT_VERSION: Int = 1

    val MIGRATIONS: List<DatabaseMigration> = listOf(
        // Future migrations (e.g. 1 -> 2, 2 -> 3) will be registered here.
    )

    fun initializeSchema(driver: SqlDriver) {
        // Ensure schema_version table exists
        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY
            );
            """.trimIndent()
        )

        // Read current version
        val existingVersion = driver.query(
            "SELECT version FROM schema_version LIMIT 1;"
        ) { cursor ->
            cursor.getInt(0) ?: 0
        }.firstOrNull() ?: 0

        if (existingVersion == 0) {
            // Fresh database setup
            createTables(driver)
            driver.execute("INSERT INTO schema_version (version) VALUES (?);", arrayOf(CURRENT_VERSION))
        } else if (existingVersion < CURRENT_VERSION) {
            // Run migrations sequentially
            var ver = existingVersion
            for (migration in MIGRATIONS.sortedBy { it.startVersion }) {
                if (migration.startVersion == ver && migration.endVersion <= CURRENT_VERSION) {
                    migration.migrate(driver)
                    ver = migration.endVersion
                    driver.execute(
                        "UPDATE schema_version SET version = ?;",
                        arrayOf(ver)
                    )
                }
            }
        }
    }

    fun createTables(driver: SqlDriver) {
        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                status TEXT NOT NULL,
                due_date TEXT,
                due_time TEXT,
                due_date_epoch_ms INTEGER,
                completed_at_epoch_ms INTEGER,
                estimated_minutes INTEGER,
                actual_minutes INTEGER,
                is_starred INTEGER NOT NULL DEFAULT 0,
                recurrence TEXT NOT NULL DEFAULT 'NONE',
                tags TEXT NOT NULL DEFAULT '',
                is_sync_pending INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at_epoch_ms INTEGER NOT NULL,
                updated_at_epoch_ms INTEGER NOT NULL,
                subject_id TEXT,
                exam_id TEXT,
                notes TEXT
            );
            """.trimIndent()
        )

        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS subtasks (
                id TEXT PRIMARY KEY NOT NULL,
                task_id TEXT NOT NULL,
                title TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                estimated_minutes INTEGER,
                updated_at_epoch_ms INTEGER NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            );
            """.trimIndent()
        )

        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON tasks(is_deleted);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);")
    }
}
