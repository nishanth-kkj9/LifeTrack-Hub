package com.lifetrack.security

import java.io.File
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * Windows Desktop implementation of SecureKeyStorage.
 * In Phase 3 & 5, connects via JNA to Windows DPAPI (CryptProtectData / CryptUnprotectData).
 */
class DesktopSecureKeyStorage(
    private val storageDir: File = File(System.getProperty("user.home"), ".lifetrack/security")
) : SecureKeyStorage {

    private val inMemoryCache = ConcurrentHashMap<String, ByteArray>()

    init {
        if (!storageDir.exists()) {
            storageDir.mkdirs()
        }
    }

    override suspend fun storeKey(alias: String, keyBytes: ByteArray) {
        inMemoryCache[alias] = keyBytes.copyOf()
        val keyFile = File(storageDir, "$alias.key")
        keyFile.writeBytes(keyBytes)
    }

    override suspend fun retrieveKey(alias: String): ByteArray? {
        val cached = inMemoryCache[alias]
        if (cached != null) return cached

        val keyFile = File(storageDir, "$alias.key")
        return if (keyFile.exists()) {
            val bytes = keyFile.readBytes()
            inMemoryCache[alias] = bytes
            bytes
        } else {
            null
        }
    }

    override suspend fun deleteKey(alias: String) {
        inMemoryCache.remove(alias)
        val keyFile = File(storageDir, "$alias.key")
        if (keyFile.exists()) {
            keyFile.delete()
        }
    }

    override suspend fun containsKey(alias: String): Boolean {
        return inMemoryCache.containsKey(alias) || File(storageDir, "$alias.key").exists()
    }
}
