package com.lifetrack.security

import java.util.concurrent.ConcurrentHashMap

/**
 * Windows Desktop development implementation of SecureKeyStorage abstraction.
 * Holds keys in-memory during Phase 1B architecture verification without writing plaintext secrets to disk.
 * Production DPAPI (CryptProtectData) integration is wired in Phase 3.
 */
class DesktopSecureKeyStorage : SecureKeyStorage {

    private val inMemoryKeyVault = ConcurrentHashMap<String, ByteArray>()

    override suspend fun storeKey(alias: String, keyBytes: ByteArray) {
        inMemoryKeyVault[alias] = keyBytes.copyOf()
    }

    override suspend fun retrieveKey(alias: String): ByteArray? {
        return inMemoryKeyVault[alias]?.copyOf()
    }

    override suspend fun deleteKey(alias: String) {
        inMemoryKeyVault.remove(alias)
    }

    override suspend fun containsKey(alias: String): Boolean {
        return inMemoryKeyVault.containsKey(alias)
    }
}
