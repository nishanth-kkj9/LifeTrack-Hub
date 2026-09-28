package com.lifetrack.core

import com.lifetrack.data.local.db.SqlDriver

/**
 * Interface providing a stable, unique installation/device identifier.
 *
 * Requirements:
 * 1. Stable across application restarts.
 * 2. Distinct between installations.
 * 3. Not based solely on username.
 * 4. Not regenerated on every launch.
 */
interface DeviceIdentityProvider {
    fun getDeviceId(): String
}

/**
 * Production implementation storing and retrieving installation identity from local SQLite storage.
 */
class PersistentDeviceIdentityProvider(
    private val driver: SqlDriver,
    private val platformPrefix: String = "client",
    private val idGenerator: IdGenerator = PlatformIdGenerator()
) : DeviceIdentityProvider {

    @Volatile
    private var cachedDeviceId: String? = null

    override fun getDeviceId(): String {
        cachedDeviceId?.let { return it }

        synchronized(this) {
            cachedDeviceId?.let { return it }

            // Ensure device_config table exists
            driver.execute(
                """
                CREATE TABLE IF NOT EXISTS device_config (
                    config_key TEXT PRIMARY KEY NOT NULL,
                    config_value TEXT NOT NULL
                );
                """.trimIndent()
            )

            // Query existing device ID
            val existing = driver.query(
                "SELECT config_value FROM device_config WHERE config_key = ? LIMIT 1;",
                arrayOf("installation_device_id")
            ) { cursor ->
                cursor.getString(0)
            }.firstOrNull()

            if (!existing.isNullOrBlank()) {
                cachedDeviceId = existing
                return existing
            }

            // Generate stable unique UUID
            val newId = "${platformPrefix}_${idGenerator.generateId()}"
            driver.execute(
                "INSERT OR REPLACE INTO device_config (config_key, config_value) VALUES (?, ?);",
                arrayOf("installation_device_id", newId)
            )

            cachedDeviceId = newId
            return newId
        }
    }
}
