package com.lifetrack.auth

import com.google.firebase.auth.FirebaseAuth
import com.lifetrack.sync.AuthSessionProvider
import kotlinx.coroutines.tasks.await

/**
 * Production Firebase Authentication provider for Android.
 * Backed by the official Android FirebaseAuth SDK.
 */
class AndroidFirebaseAuthSessionProvider(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) : AuthSessionProvider {

    override fun getCurrentUserUid(): String? {
        return auth.currentUser?.uid
    }

    override fun getIdTokenSync(): String? {
        return null // Android token retrieval is asynchronous
    }

    override suspend fun getIdToken(forceRefresh: Boolean): String? {
        val user = auth.currentUser ?: return null
        return try {
            val result = user.getIdToken(forceRefresh).await()
            result.token
        } catch (_: Throwable) {
            null
        }
    }

    val currentUserEmail: String?
        get() = auth.currentUser?.email
}
