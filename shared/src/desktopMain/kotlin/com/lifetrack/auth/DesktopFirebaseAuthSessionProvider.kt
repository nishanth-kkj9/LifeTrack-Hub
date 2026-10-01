package com.lifetrack.auth

import com.lifetrack.core.json.JsonObject
import com.lifetrack.core.json.JsonParser
import com.lifetrack.core.json.JsonPrimitive
import com.lifetrack.sync.AuthSessionProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

enum class DesktopAuthState {
    SIGNED_OUT,
    AUTHENTICATING,
    AUTHENTICATED,
    ERROR
}

/**
 * Production Firebase Authentication provider for Windows Desktop clients.
 *
 * Operates strictly in user client space (NO Admin SDK, NO service account keys).
 * Implements:
 * 1. Email/Password sign-in via Google Identity Toolkit REST API.
 * 2. Token refresh via securetoken.googleapis.com when expired or force-refreshed.
 * 3. Session state observation (UID, email, authState).
 */
class DesktopFirebaseAuthSessionProvider(
    private val apiKey: String,
    private val projectId: String = "galvanic-oarlock-43skh"
) : AuthSessionProvider {

    private val _authState = MutableStateFlow(DesktopAuthState.SIGNED_OUT)
    val authState: StateFlow<DesktopAuthState> = _authState.asStateFlow()

    private val _currentUserEmail = MutableStateFlow<String?>(null)
    val currentUserEmail: StateFlow<String?> = _currentUserEmail.asStateFlow()

    private var currentUid: String? = null
    private var currentIdToken: String? = null
    private var currentRefreshToken: String? = null
    private var tokenExpiresAtEpochMs: Long = 0L

    override fun getCurrentUserUid(): String? = currentUid

    override fun getIdTokenSync(): String? = currentIdToken

    override suspend fun getIdToken(forceRefresh: Boolean): String? = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        // If token exists and has > 60 seconds validity remaining, and no forceRefresh requested:
        if (!forceRefresh && currentIdToken != null && now < (tokenExpiresAtEpochMs - 60_000L)) {
            return@withContext currentIdToken
        }

        // Refresh token if available
        val refreshToken = currentRefreshToken
        if (refreshToken != null) {
            val refreshed = refreshIdToken(refreshToken)
            if (refreshed != null) {
                return@withContext refreshed
            }
        }

        return@withContext currentIdToken
    }

    /**
     * Signs in a user using email and password via Firebase Auth REST API.
     */
    suspend fun signInWithEmailAndPassword(email: String, pass: String): Result<String> = withContext(Dispatchers.IO) {
        _authState.value = DesktopAuthState.AUTHENTICATING
        try {
            val endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey"
            val payload = JsonObject(
                "email" to JsonPrimitive(email),
                "password" to JsonPrimitive(pass),
                "returnSecureToken" to JsonPrimitive(true)
            ).toJsonString()

            val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                connectTimeout = 15_000
                readTimeout = 15_000
            }

            OutputStreamWriter(connection.outputStream, "UTF-8").use { writer ->
                writer.write(payload)
                writer.flush()
            }

            val statusCode = connection.responseCode
            if (statusCode == 200) {
                val responseStr = BufferedReader(InputStreamReader(connection.inputStream, "UTF-8")).use { it.readText() }
                val resp = JsonParser.parseObject(responseStr)

                val idToken = resp.getString("idToken") ?: ""
                val refreshToken = resp.getString("refreshToken") ?: ""
                val localId = resp.getString("localId") ?: ""
                val expiresInSec = resp.getString("expiresIn")?.toLongOrNull() ?: 3600L

                currentUid = localId
                currentIdToken = idToken
                currentRefreshToken = refreshToken
                tokenExpiresAtEpochMs = System.currentTimeMillis() + (expiresInSec * 1000L)

                _currentUserEmail.value = email
                _authState.value = DesktopAuthState.AUTHENTICATED
                Result.success(localId)
            } else {
                val errorStr = BufferedReader(InputStreamReader(connection.errorStream ?: connection.inputStream, "UTF-8")).use { it.readText() }
                _authState.value = DesktopAuthState.ERROR
                Result.failure(Exception("Firebase Auth failed ($statusCode): $errorStr"))
            }
        } catch (t: Throwable) {
            _authState.value = DesktopAuthState.ERROR
            Result.failure(t)
        }
    }

    /**
     * Initializes session from an already authenticated credential (e.g. cached token or OAuth bridge).
     */
    fun setAuthenticatedSession(uid: String, idToken: String, refreshToken: String? = null, email: String? = null, expiresInSeconds: Long = 3600L) {
        currentUid = uid
        currentIdToken = idToken
        currentRefreshToken = refreshToken
        tokenExpiresAtEpochMs = System.currentTimeMillis() + (expiresInSeconds * 1000L)
        _currentUserEmail.value = email
        _authState.value = DesktopAuthState.AUTHENTICATED
    }

    /**
     * Exchanges refresh token for a new ID token.
     */
    private fun refreshIdToken(refreshToken: String): String? {
        return try {
            val endpoint = "https://securetoken.googleapis.com/v1/token?key=$apiKey"
            val body = "grant_type=refresh_token&refresh_token=$refreshToken"

            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                connectTimeout = 15_000
                readTimeout = 15_000
            }

            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(body); it.flush() }

            if (conn.responseCode == 200) {
                val respStr = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8")).use { it.readText() }
                val resp = JsonParser.parseObject(respStr)

                val newIdToken = resp.getString("id_token") ?: resp.getString("access_token")
                val newRefreshToken = resp.getString("refresh_token")
                val expiresInSec = resp.getString("expires_in")?.toLongOrNull() ?: 3600L

                if (newIdToken != null) {
                    currentIdToken = newIdToken
                    if (newRefreshToken != null) currentRefreshToken = newRefreshToken
                    tokenExpiresAtEpochMs = System.currentTimeMillis() + (expiresInSec * 1000L)
                    return newIdToken
                }
            }
            null
        } catch (_: Throwable) {
            null
        }
    }

    fun signOut() {
        currentUid = null
        currentIdToken = null
        currentRefreshToken = null
        tokenExpiresAtEpochMs = 0L
        _currentUserEmail.value = null
        _authState.value = DesktopAuthState.SIGNED_OUT
    }
}
