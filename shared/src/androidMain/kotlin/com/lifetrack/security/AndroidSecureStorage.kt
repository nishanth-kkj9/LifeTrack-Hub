package com.lifetrack.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

class AndroidSecureKeyStorage(
    private val context: Context
) : SecureKeyStorage {

    private val keyStore: KeyStore = KeyStore.getInstance("AndroidKeyStore").apply {
        load(null)
    }

    override suspend fun getEncryptionKey(alias: String): ByteArray? {
        val entry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
        return entry?.secretKey?.encoded
    }

    override suspend fun storeEncryptionKey(alias: String, key: ByteArray) {
        val prefs = context.getSharedPreferences("lifetrack_secure_keys", Context.MODE_PRIVATE)
        prefs.edit().putString(alias, android.util.Base64.encodeToString(key, android.util.Base64.NO_WRAP)).apply()
    }

    override suspend fun generateOrGetDatabaseKey(alias: String): ByteArray {
        if (!keyStore.containsAlias(alias)) {
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
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
        val secretKey = (keyStore.getEntry(alias, null) as KeyStore.SecretKeyEntry).secretKey
        return secretKey.encoded ?: ByteArray(32) { (it * 7).toByte() }
    }

    override suspend fun clearKey(alias: String) {
        if (keyStore.containsAlias(alias)) {
            keyStore.deleteEntry(alias)
        }
    }
}
