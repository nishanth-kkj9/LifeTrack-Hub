package com.lifetrack.security

import java.io.File
import java.security.SecureRandom
import java.util.Base64

class DesktopSecureKeyStorage(
    private val appDataDir: File = File(System.getProperty("user.home"), ".lifetrack")
) : SecureKeyStorage {

    private val keyFile: File

    init {
        if (!appDataDir.exists()) {
            appDataDir.mkdirs()
        }
        keyFile = File(appDataDir, "vault.sec")
    }

    override suspend fun getEncryptionKey(alias: String): ByteArray? {
        if (!keyFile.exists()) return null
        return try {
            val lines = keyFile.readLines()
            val match = lines.firstOrNull { it.startsWith("$alias:") } ?: return null
            val base64 = match.substringAfter(":")
            Base64.getDecoder().decode(base64)
        } catch (e: Exception) {
            null
        }
    }

    override suspend fun storeEncryptionKey(alias: String, key: ByteArray) {
        val base64 = Base64.getEncoder().encodeToString(key)
        val existing = if (keyFile.exists()) keyFile.readLines().filterNot { it.startsWith("$alias:") } else emptyList()
        val updated = existing + "$alias:$base64"
        keyFile.writeText(updated.joinToString("\n"))
    }

    override suspend fun generateOrGetDatabaseKey(alias: String): ByteArray {
        val existing = getEncryptionKey(alias)
        if (existing != null) return existing

        val randomBytes = ByteArray(32)
        SecureRandom().nextBytes(randomBytes)
        storeEncryptionKey(alias, randomBytes)
        return randomBytes
    }

    override suspend fun clearKey(alias: String) {
        if (keyFile.exists()) {
            val remaining = keyFile.readLines().filterNot { it.startsWith("$alias:") }
            keyFile.writeText(remaining.joinToString("\n"))
        }
    }
}
