package com.lifetrack.security

/**
 * Architectural contract interface for platform-backed secure key management (Phase 3+ hardening).
 * Android: Target backing by Android Keystore (hardware-backed Master Key)
 * Windows: Target backing by Windows DPAPI / Credential Manager
 *
 * Note: In Phase 2A, these interfaces establish architectural boundaries. Production encryption
 * of local databases and biometric workflows are deferred to future hardening phases.
 */
interface SecureKeyStorage {
    suspend fun storeKey(alias: String, keyBytes: ByteArray)
    suspend fun retrieveKey(alias: String): ByteArray?
    suspend fun deleteKey(alias: String)
    suspend fun containsKey(alias: String): Boolean
}

/**
 * Architectural contract interface for local biometric / device credential authentication (Phase 3+).
 */
interface BiometricAuthenticator {
    suspend fun canAuthenticate(): Boolean
    suspend fun authenticate(promptTitle: String, promptSubtitle: String): Boolean
}

/**
 * Architectural contract interface for cryptographic primitives (Phase 3+).
 */
interface CipherProvider {
    fun encrypt(plainText: ByteArray, key: ByteArray, associatedData: ByteArray? = null): ByteArray
    fun decrypt(cipherText: ByteArray, key: ByteArray, associatedData: ByteArray? = null): ByteArray
}
