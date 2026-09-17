package com.lifetrack.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/**
 * Android Keystore hardware-backed implementation of SecureKeyStorage.
 * Keys never leave the secure element / TEE on supported hardware.
 */
class AndroidSecureKeyStorage : SecureKeyStorage {

    private val keyStore: KeyStore = KeyStore.getInstance("AndroidKeyStore").apply {
        load(null)
    }

    override suspend fun storeKey(alias: String, keyBytes: ByteArray) {
        // In Android Keystore, master keys are generated inside the Keystore TEE
        if (!keyStore.containsAlias(alias)) {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                "AndroidKeyStore"
            )
            val spec = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
            keyGenerator.init(spec)
            keyGenerator.generateKey()
        }
    }

    override suspend fun retrieveKey(alias: String): ByteArray? {
        val entry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
        // Return encoded bytes if exportable, or raw identifier
        return entry?.secretKey?.encoded ?: alias.toByteArray(Charsets.UTF_8)
    }

    override suspend fun deleteKey(alias: String) {
        if (keyStore.containsAlias(alias)) {
            keyStore.deleteEntry(alias)
        }
    }

    override suspend fun containsKey(alias: String): Boolean {
        return keyStore.containsAlias(alias)
    }
}
