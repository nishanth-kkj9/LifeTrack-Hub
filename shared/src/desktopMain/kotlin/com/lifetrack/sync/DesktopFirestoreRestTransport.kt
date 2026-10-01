package com.lifetrack.sync

import com.lifetrack.core.HlcTimestamp
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Production Desktop/JVM Firestore Remote Sync Transport communicating directly with
 * Google Cloud Firestore REST API using Firebase Authentication ID tokens.
 *
 * Enforces:
 * 1. Bearer token authentication against the user scope `/users/{uid}/deltas`.
 * 2. Idempotent push: Identical event pushes succeed seamlessly.
 * 3. Conflicting event push protection: Conflicting mutation attempts for the same event ID throw explicit integrity errors.
 * 4. Structured query pull with HLC ordering, pagination limits, and defensive client sorting.
 */
class DesktopFirestoreRestTransport(
    private val authSessionProvider: AuthSessionProvider,
    private val config: FirebaseConfig = FirebaseConfig(),
    private val pageSize: Int = 100
) : RemoteSyncTransport {

    override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot push deltas: No user authenticated")

        var idToken = authSessionProvider.getIdToken(forceRefresh = false)
            ?: throw IllegalStateException("Cannot push deltas: Missing Firebase ID token")

        val ackedIds = mutableListOf<String>()

        for (record in records) {
            val docUrl = "${config.restBaseUrl}/users/$uid/deltas?documentId=${URLEncoder.encode(record.id, "UTF-8")}"
            val payloadJson = serializeRecordToFirestoreJson(record)

            var response = executeHttpRequest(
                urlString = docUrl,
                method = "POST",
                idToken = idToken,
                body = payloadJson
            )

            // Handle token expiration retry
            if (response.statusCode == 401 || response.statusCode == 403) {
                idToken = authSessionProvider.getIdToken(forceRefresh = true)
                    ?: throw SecurityException("Authentication token expired and refresh failed")
                response = executeHttpRequest(
                    urlString = docUrl,
                    method = "POST",
                    idToken = idToken,
                    body = payloadJson
                )
            }

            if (response.statusCode in 200..299) {
                ackedIds.add(record.id)
            } else if (response.statusCode == 409) {
                // Event already exists in Firestore: Verify content immutability
                val existingDocUrl = "${config.restBaseUrl}/users/$uid/deltas/${URLEncoder.encode(record.id, "UTF-8")}"
                val existingResponse = executeHttpRequest(
                    urlString = existingDocUrl,
                    method = "GET",
                    idToken = idToken
                )

                if (existingResponse.statusCode in 200..299) {
                    val existingRecord = parseFirestoreDocumentJson(existingResponse.body)
                    if (existingRecord != null &&
                        existingRecord.payload == record.payload &&
                        existingRecord.entityType == record.entityType &&
                        existingRecord.entityId == record.entityId &&
                        existingRecord.operation == record.operation
                    ) {
                        // Idempotent duplicate acknowledgment
                        ackedIds.add(record.id)
                    } else {
                        throw IllegalStateException(
                            "Data integrity violation: Event ${record.id} already exists with conflicting content."
                        )
                    }
                } else {
                    throw IllegalStateException("Failed to verify existing delta document: HTTP ${existingResponse.statusCode}")
                }
            } else {
                throw java.io.IOException("Firestore REST push error HTTP ${response.statusCode}: ${response.body}")
            }
        }

        return ackedIds
    }

    override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot pull deltas: No user authenticated")

        var idToken = authSessionProvider.getIdToken(forceRefresh = false)
            ?: throw IllegalStateException("Cannot pull deltas: Missing Firebase ID token")

        val queryUrl = "https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/users/$uid:runQuery"
        val queryJson = buildStructuredQueryJson(sinceHlc, pageSize)

        var response = executeHttpRequest(
            urlString = queryUrl,
            method = "POST",
            idToken = idToken,
            body = queryJson
        )

        if (response.statusCode == 401 || response.statusCode == 403) {
            idToken = authSessionProvider.getIdToken(forceRefresh = true)
                ?: throw SecurityException("Authentication token expired and refresh failed")
            response = executeHttpRequest(
                urlString = queryUrl,
                method = "POST",
                idToken = idToken,
                body = queryJson
            )
        }

        if (response.statusCode !in 200..299) {
            throw java.io.IOException("Firestore REST pull error HTTP ${response.statusCode}: ${response.body}")
        }

        val records = parseRunQueryResponse(response.body)
        return records.sortedWith(SyncRecordComparator)
    }

    private fun serializeRecordToFirestoreJson(record: SyncRecord): String {
        return """
        {
          "fields": {
            "id": { "stringValue": "${escapeJson(record.id)}" },
            "entityType": { "stringValue": "${escapeJson(record.entityType)}" },
            "entityId": { "stringValue": "${escapeJson(record.entityId)}" },
            "operation": { "stringValue": "${escapeJson(record.operation)}" },
            "payload": { "stringValue": "${escapeJson(record.payload)}" },
            "hlcTimestamp": { "stringValue": "${escapeJson(record.hlcTimestamp)}" },
            "createdAt": { "integerValue": "${record.createdAt}" },
            "originDeviceId": { "stringValue": "${escapeJson(record.originDeviceId)}" },
            "protocolVersion": { "integerValue": "${record.protocolVersion}" },
            "schemaVersion": { "integerValue": "${record.schemaVersion}" }
          }
        }
        """.trimIndent()
    }

    private fun buildStructuredQueryJson(sinceHlc: String?, limit: Int): String {
        return if (sinceHlc != null && sinceHlc.isNotBlank()) {
            """
            {
              "structuredQuery": {
                "from": [{ "collectionId": "deltas" }],
                "where": {
                  "fieldFilter": {
                    "field": { "fieldPath": "hlcTimestamp" },
                    "op": "GREATER_THAN",
                    "value": { "stringValue": "${escapeJson(sinceHlc)}" }
                  }
                },
                "orderBy": [
                  { "field": { "fieldPath": "hlcTimestamp" }, "direction": "ASCENDING" }
                ],
                "limit": $limit
              }
            }
            """.trimIndent()
        } else {
            """
            {
              "structuredQuery": {
                "from": [{ "collectionId": "deltas" }],
                "orderBy": [
                  { "field": { "fieldPath": "hlcTimestamp" }, "direction": "ASCENDING" }
                ],
                "limit": $limit
              }
            }
            """.trimIndent()
        }
    }

    private fun parseRunQueryResponse(json: String): List<SyncRecord> {
        val records = mutableListOf<SyncRecord>()
        // Simple robust JSON parser for Firestore runQuery result array
        val docSplit = json.split(""""document":""")
        for (i in 1 until docSplit.size) {
            val chunk = docSplit[i]
            val record = parseFirestoreDocumentJson(chunk)
            if (record != null) {
                records.add(record)
            }
        }
        return records
    }

    private fun parseFirestoreDocumentJson(chunk: String): SyncRecord? {
        val id = extractJsonField(chunk, "id") ?: return null
        val entityType = extractJsonField(chunk, "entityType") ?: "TASK"
        val entityId = extractJsonField(chunk, "entityId") ?: id
        val operation = extractJsonField(chunk, "operation") ?: "UPSERT"
        val payload = extractJsonField(chunk, "payload") ?: ""
        val hlcTimestamp = extractJsonField(chunk, "hlcTimestamp") ?: return null
        val createdAt = extractJsonLongField(chunk, "createdAt") ?: 0L
        val originDeviceId = extractJsonField(chunk, "originDeviceId") ?: "unknown"
        val protocolVersion = extractJsonIntField(chunk, "protocolVersion") ?: 1
        val schemaVersion = extractJsonIntField(chunk, "schemaVersion") ?: 1

        return SyncRecord(
            id = id,
            entityType = entityType,
            entityId = entityId,
            operation = operation,
            payload = payload,
            hlcTimestamp = hlcTimestamp,
            createdAt = createdAt,
            originDeviceId = originDeviceId,
            protocolVersion = protocolVersion,
            schemaVersion = schemaVersion
        )
    }

    private fun extractJsonField(json: String, fieldName: String): String? {
        val key = "\"$fieldName\":\\s*\\{\\s*\"stringValue\":\\s*\"(.*?)\"".toRegex()
        return key.find(json)?.groupValues?.getOrNull(1)?.let { unescapeJson(it) }
    }

    private fun extractJsonLongField(json: String, fieldName: String): Long? {
        val key = "\"$fieldName\":\\s*\\{\\s*\"integerValue\":\\s*\"?(\\d+)\"?".toRegex()
        return key.find(json)?.groupValues?.getOrNull(1)?.toLongOrNull()
    }

    private fun extractJsonIntField(json: String, fieldName: String): Int? {
        val key = "\"$fieldName\":\\s*\\{\\s*\"integerValue\":\\s*\"?(\\d+)\"?".toRegex()
        return key.find(json)?.groupValues?.getOrNull(1)?.toIntOrNull()
    }

    private fun escapeJson(str: String): String {
        return str
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    private fun unescapeJson(str: String): String {
        return str
            .replace("\\\"", "\"")
            .replace("\\\\", "\\")
            .replace("\\n", "\n")
            .replace("\\r", "\r")
            .replace("\\t", "\t")
    }

    private fun executeHttpRequest(
        urlString: String,
        method: String,
        idToken: String,
        body: String? = null
    ): HttpResponseResult {
        val url = URI.create(urlString).toURL()
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.setRequestProperty("Authorization", "Bearer $idToken")
        connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
        connection.setRequestProperty("Accept", "application/json")
        connection.connectTimeout = 15000
        connection.readTimeout = 15000

        if (body != null && (method == "POST" || method == "PATCH" || method == "PUT")) {
            connection.doOutput = true
            OutputStreamWriter(connection.outputStream, StandardCharsets.UTF_8).use { writer ->
                writer.write(body)
                writer.flush()
            }
        }

        val statusCode = connection.responseCode
        val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
        val responseBody = stream?.use {
            BufferedReader(InputStreamReader(it, StandardCharsets.UTF_8)).readText()
        } ?: ""

        connection.disconnect()
        return HttpResponseResult(statusCode, responseBody)
    }

    private data class HttpResponseResult(val statusCode: Int, val body: String)
}

/**
 * Standard Desktop Firebase authentication provider holding user session credentials in memory.
 */
class DesktopFirebaseAuthSessionProvider(
    private var currentUserUid: String? = null,
    private var currentIdToken: String? = null,
    private val tokenRefresher: (suspend (forceRefresh: Boolean) -> String?)? = null
) : AuthSessionProvider {

    override fun getCurrentUserUid(): String? = currentUserUid

    override suspend fun getIdToken(forceRefresh: Boolean): String? {
        if (forceRefresh && tokenRefresher != null) {
            currentIdToken = tokenRefresher.invoke(true)
        }
        return currentIdToken
    }

    fun setSession(uid: String?, token: String?) {
        currentUserUid = uid
        currentIdToken = token
    }
}
