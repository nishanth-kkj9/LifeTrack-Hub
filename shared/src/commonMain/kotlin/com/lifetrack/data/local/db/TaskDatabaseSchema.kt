package com.lifetrack.data.local.db

/**
 * Authoritative schema definition and sequential migration registry for LifeTrack local persistence.
 */
object TaskDatabaseSchema {

    const val CURRENT_VERSION: Int = 4

    val MIGRATIONS: List<DatabaseMigration> = listOf(
        object : DatabaseMigration {
            override val startVersion: Int = 1
            override val endVersion: Int = 2
            override fun migrate(driver: SqlDriver) {
                driver.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sync_outbox (
                        id TEXT PRIMARY KEY NOT NULL,
                        entity_type TEXT NOT NULL,
                        entity_id TEXT NOT NULL,
                        operation TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        hlc_timestamp TEXT NOT NULL,
                        created_at INTEGER NOT NULL,
                        origin_device_id TEXT NOT NULL DEFAULT 'local-device',
                        protocol_version INTEGER NOT NULL DEFAULT 1,
                        schema_version INTEGER NOT NULL DEFAULT 1,
                        status TEXT NOT NULL DEFAULT 'PENDING',
                        in_flight_at INTEGER,
                        retry_count INTEGER NOT NULL DEFAULT 0,
                        next_retry_at INTEGER NOT NULL DEFAULT 0,
                        last_error TEXT
                    );
                    """.trimIndent()
                )
                driver.execute("CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);")
                driver.execute("CREATE INDEX IF NOT EXISTS idx_sync_outbox_created_at ON sync_outbox(created_at);")
            }
        },
        object : DatabaseMigration {
            override val startVersion: Int = 2
            override val endVersion: Int = 3
            override fun migrate(driver: SqlDriver) {
                driver.execute(
                    """
                    CREATE TABLE IF NOT EXISTS sync_state (
                        device_id TEXT PRIMARY KEY NOT NULL,
                        last_pulled_hlc TEXT,
                        last_successful_sync_time INTEGER,
                        last_error TEXT
                    );
                    """.trimIndent()
                )
                driver.execute(
                    """
                    CREATE TABLE IF NOT EXISTS entity_sync_metadata (
                        entity_type TEXT NOT NULL,
                        entity_id TEXT NOT NULL,
                        hlc_timestamp TEXT NOT NULL,
                        is_deleted INTEGER NOT NULL DEFAULT 0,
                        updated_at INTEGER NOT NULL,
                        PRIMARY KEY (entity_type, entity_id)
                    );
                    """.trimIndent()
                )
                driver.execute("CREATE INDEX IF NOT EXISTS idx_sync_outbox_next_retry ON sync_outbox(status, next_retry_at);")
                driver.execute("CREATE INDEX IF NOT EXISTS idx_entity_sync_hlc ON entity_sync_metadata(entity_type, entity_id, hlc_timestamp);")
            }
        },
        object : DatabaseMigration {
            override val startVersion: Int = 3
            override val endVersion: Int = 4
            override fun migrate(driver: SqlDriver) {
                driver.execute(
                    """
                    CREATE TABLE IF NOT EXISTS device_config (
                        config_key TEXT PRIMARY KEY NOT NULL,
                        config_value TEXT NOT NULL
                    );
                    """.trimIndent()
                )
                driver.execute(
                    """
                    CREATE TABLE IF NOT EXISTS hlc_clock_state (
                        node_id TEXT PRIMARY KEY NOT NULL,
                        physical_time_ms INTEGER NOT NULL,
                        logical_counter INTEGER NOT NULL,
                        hlc_string TEXT NOT NULL
                    );
                    """.trimIndent()
                )
            }
        }
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

        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS sync_outbox (
                id TEXT PRIMARY KEY NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                payload TEXT NOT NULL,
                hlc_timestamp TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                origin_device_id TEXT NOT NULL DEFAULT 'local-device',
                protocol_version INTEGER NOT NULL DEFAULT 1,
                schema_version INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'PENDING',
                in_flight_at INTEGER,
                retry_count INTEGER NOT NULL DEFAULT 0,
                next_retry_at INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            );
            """.trimIndent()
        )

        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS sync_state (
                device_id TEXT PRIMARY KEY NOT NULL,
                last_pulled_hlc TEXT,
                last_successful_sync_time INTEGER,
                last_error TEXT
            );
            """.trimIndent()
        )

        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS entity_sync_metadata (
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                hlc_timestamp TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (entity_type, entity_id)
            );
            """.trimIndent()
        )

        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS device_config (
                config_key TEXT PRIMARY KEY NOT NULL,
                config_value TEXT NOT NULL
            );
            """.trimIndent()
        )

        driver.execute(
            """
            CREATE TABLE IF NOT EXISTS hlc_clock_state (
                node_id TEXT PRIMARY KEY NOT NULL,
                physical_time_ms INTEGER NOT NULL,
                logical_counter INTEGER NOT NULL,
                hlc_string TEXT NOT NULL
            );
            """.trimIndent()
        )

        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON tasks(is_deleted);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);")

        driver.execute("CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_sync_outbox_created_at ON sync_outbox(created_at);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_sync_outbox_next_retry ON sync_outbox(status, next_retry_at);")
        driver.execute("CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity_type, entity_id);")

        driver.execute("CREATE INDEX IF NOT EXISTS idx_entity_sync_hlc ON entity_sync_metadata(entity_type, entity_id, hlc_timestamp);")
    }
}
