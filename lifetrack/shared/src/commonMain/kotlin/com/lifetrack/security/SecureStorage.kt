package com.lifetrack.security

/**
 * Platform boundary for secure key storage.
 * Android: Backed by Android Keystore (hardware-backed Master Key)
 * Windows: Backed by Windows DPAPI (CryptProtectData / Credential Manager)
 */
interface SecureKeyStorage {
    suspend fun storeKey(alias: String, keyBytes: ByteArray)
    suspend fun retrieveKey(alias: String): ByteArray?
    suspend fun deleteKey(alias: String)
    suspend fun containsKey(alias: String): Boolean
}

/**
 * Platform abstraction for biometric / local authentication
 */
interface BiometricAuthenticator {
    suspend fun canAuthenticate(): Boolean
    suspend fun authenticate(promptTitle: String, promptSubtitle: String): Boolean
}

/**
 * Abstraction for cryptographic primitives (AES-GCM-256 / ChaCha20-Poly1305)
 * Detailed implementation belongs to Phase 3 & 5.
 */
interface CipherProvider {
    fun encrypt(plainText: ByteArray, key: ByteArray, associatedData: ByteArray? = null): ByteArray
    fun decrypt(cipherText: ByteArray, key: ByteArray, associatedData: ByteArray? = null): ByteArray
}
