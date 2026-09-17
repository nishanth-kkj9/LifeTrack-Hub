package com.lifetrack.security

interface SecureKeyStorage {
    suspend fun getEncryptionKey(alias: String): ByteArray?
    suspend fun storeEncryptionKey(alias: String, key: ByteArray)
    suspend fun generateOrGetDatabaseKey(alias: String = "lifetrack_db_key"): ByteArray
    suspend fun clearKey(alias: String)
}
