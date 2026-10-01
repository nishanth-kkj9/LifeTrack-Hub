package com.lifetrack.sync

import com.lifetrack.core.json.JsonArray
import com.lifetrack.core.json.JsonElement
import com.lifetrack.core.json.JsonObject
import com.lifetrack.core.json.JsonParser
import com.lifetrack.core.json.JsonPrimitive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Production Firestore REST transport for Windows Desktop clients.
 *
 * Guarantees:
 * 1. User Client Authentication: Authenticates via Bearer ID token evaluated by Firestore Security Rules.
 * 2. Idempotent Push: Event ID is used as the document ID in `/users/{uid}/deltas/{eventId}`.
 * 3. Complete Immutable Verification: Duplicate 409 events are verified across ALL 10 immutable fields.
 * 4. Structured HLC Ordering: Queries order by (hlcPhysicalTimeMs, hlcLogicalCounter, hlcNodeId, id).
 * 5. Full Cursor Pagination: Paginates until all remote records are retrieved.
 */
class DesktopFirestoreRestTransport(
    private val authSessionProvider: AuthSessionProvider,
    private val projectId: String = "galvanic-oarlock-43skh",
    private val databaseId: String = "ai-studio-a7fbef00-eef0-48a1-a3ab-2cd9aa399fbd",
    private val connectTimeoutMs: Int = 15_000,
    private val readTimeoutMs: Int = 20_000
) : RemoteSyncTransport {

    private val baseDatabaseUrl: String
        get() = "https://firestore.googleapis.com/v1/projects/$projectId/databases/$databaseId/documents"

    override suspend fun pushRecords(records: List<SyncRecord>): List<String> = withContext(Dispatchers.IO) {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot push records: User is not authenticated")

        var idToken = authSessionProvider.getIdToken(false)
            ?: throw IllegalStateException("Cannot push records: No valid Firebase ID token")

        val ackedIds = mutableListOf<String>()

        for (record in records) {
            val url = "$baseDatabaseUrl/users/$uid/deltas?documentId=${record.id}"
            val payload = encodeRecordToFirestoreDocument(record).toJsonString()

            var responseCode = executePost(url, payload, idToken)

            // If token expired (401), force refresh and retry once
            if (responseCode == 401) {
                idToken = authSessionProvider.getIdToken(true)
                    ?: throw IllegalStateException("Token refresh failed during push")
                responseCode = executePost(url, payload, idToken)
            }

            when (responseCode) {
                200, 201 -> {
                    ackedIds.add(record.id)
                }
                409 -> {
                    // Document already exists! Must verify complete immutable event contract.
                    val existing = fetchSingleDelta(uid, record.id, idToken)
                    if (existing != null) {
                        verifyImmutableDeltaContract(existing, record)
                        // Identical content: duplicate ACK accepted
                        ackedIds.add(record.id)
                    } else {
                        throw SyncDataIntegrityException("Conflict on event ${record.id} but unable to read existing document")
                    }
                }
                else -> {
                    throw java.io.IOException("Firestore REST push failed with HTTP $responseCode for event ${record.id}")
                }
            }
        }

        ackedIds
    }

    override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
        val cursor = if (sinceHlc != null) SyncCursor(sinceHlc, "") else null
        return pullRecordsWithCursor(cursor, pageSize = 100)
    }

    override suspend fun pullRecordsWithCursor(cursor: SyncCursor?, pageSize: Int): List<SyncRecord> = withContext(Dispatchers.IO) {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot pull records: User is not authenticated")

        var idToken = authSessionProvider.getIdToken(false)
            ?: throw IllegalStateException("Cannot pull records: No valid Firebase ID token")

        val allRecords = mutableListOf<SyncRecord>()
        var currentCursor = cursor

        // Continue pagination until no more records are returned
        while (true) {
            val pageResult = runStructuredQuery(uid, currentCursor, pageSize, idToken)
            val records = pageResult.records
            if (records.isEmpty()) {
                break
            }

            allRecords.addAll(records)
            if (records.size < pageSize) {
                // Last page reached
                break
            }

            val last = records.last()
            currentCursor = SyncCursor(last.hlcTimestamp, last.id)
        }

        allRecords.sortedWith(SyncRecordComparator)
    }

    private fun executePost(urlStr: String, bodyJson: String, idToken: String): Int {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Authorization", "Bearer $idToken")
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
        }

        OutputStreamWriter(conn.outputStream, "UTF-8").use {
            it.write(bodyJson)
            it.flush()
        }

        return conn.responseCode
    }

    private fun fetchSingleDelta(userId: String, eventId: String, idToken: String): SyncRecord? {
        val urlStr = "$baseDatabaseUrl/users/$userId/deltas/$eventId"
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("Authorization", "Bearer $idToken")
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
        }

        if (conn.responseCode == 200) {
            val respStr = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8")).use { it.readText() }
            val docJson = JsonParser.parseObject(respStr)
            return parseFirestoreDocument(docJson)
        }
        return null
    }

    private data class QueryResult(val records: List<SyncRecord>)

    private fun runStructuredQuery(userId: String, cursor: SyncCursor?, limit: Int, idToken: String): QueryResult {
        val runQueryUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/$databaseId/documents:runQuery"

        // Build structured query JSON
        val orderByArray = JsonArray(
            JsonObject("field" to JsonObject("fieldPath" to JsonPrimitive("hlcPhysicalTimeMs")), "direction" to JsonPrimitive("ASCENDING")),
            JsonObject("field" to JsonObject("fieldPath" to JsonPrimitive("hlcLogicalCounter")), "direction" to JsonPrimitive("ASCENDING")),
            JsonObject("field" to JsonObject("fieldPath" to JsonPrimitive("hlcNodeId")), "direction" to JsonPrimitive("ASCENDING")),
            JsonObject("field" to JsonObject("fieldPath" to JsonPrimitive("id")), "direction" to JsonPrimitive("ASCENDING"))
        )

        val queryMap = mutableMapOf<String, JsonElement>(
            "from" to JsonArray(JsonObject("collectionId" to JsonPrimitive("deltas"))),
            "orderBy" to orderByArray,
            "limit" to JsonPrimitive(limit)
        )

        if (cursor != null && cursor.lastHlc.isNotBlank()) {
            val hlc = com.lifetrack.core.HlcTimestamp.fromString(cursor.lastHlc)
            if (hlc != null) {
                queryMap["startAt"] = JsonObject(
                    "before" to JsonPrimitive(false),
                    "values" to JsonArray(
                        JsonObject("integerValue" to JsonPrimitive(hlc.physicalTimeMs.toString())),
                        JsonObject("integerValue" to JsonPrimitive(hlc.logicalCounter.toString())),
                        JsonObject("stringValue" to JsonPrimitive(hlc.nodeId)),
                        JsonObject("stringValue" to JsonPrimitive(cursor.lastEventId))
                    )
                )
            }
        }

        val body = JsonObject(
            "parent" to JsonPrimitive("projects/$projectId/databases/$databaseId/documents/users/$userId"),
            "structuredQuery" to JsonObject(queryMap)
        ).toJsonString()

        val conn = (URL(runQueryUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Authorization", "Bearer $idToken")
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            connectTimeout = connectTimeoutMs
            readTimeout = readTimeoutMs
        }

        OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(body); it.flush() }

        val code = conn.responseCode
        if (code != 200) {
            val err = BufferedReader(InputStreamReader(conn.errorStream ?: conn.inputStream, "UTF-8")).use { it.readText() }
            throw java.io.IOException("Firestore runQuery failed ($code): $err")
        }

        val respStr = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8")).use { it.readText() }
        val arrayElem = JsonParser.parse(respStr)
        val list = (arrayElem as? JsonArray)?.elements ?: emptyList()

        val parsedRecords = mutableListOf<SyncRecord>()
        for (item in list) {
            val itemObj = item as? JsonObject ?: continue
            val docObj = itemObj.getObject("document") ?: continue
            val rec = parseFirestoreDocument(docObj)
            if (rec != null) {
                parsedRecords.add(rec)
            }
        }

        return QueryResult(parsedRecords)
    }

    private fun encodeRecordToFirestoreDocument(record: SyncRecord): JsonObject {
        val fields = JsonObject(
            "id" to JsonObject("stringValue" to JsonPrimitive(record.id)),
            "entityType" to JsonObject("stringValue" to JsonPrimitive(record.entityType)),
            "entityId" to JsonObject("stringValue" to JsonPrimitive(record.entityId)),
            "operation" to JsonObject("stringValue" to JsonPrimitive(record.operation)),
            "payload" to JsonObject("stringValue" to JsonPrimitive(record.payload)),
            "hlcTimestamp" to JsonObject("stringValue" to JsonPrimitive(record.hlcTimestamp)),
            "hlcPhysicalTimeMs" to JsonObject("integerValue" to JsonPrimitive(record.hlcPhysicalTimeMs.toString())),
            "hlcLogicalCounter" to JsonObject("integerValue" to JsonPrimitive(record.hlcLogicalCounter.toString())),
            "hlcNodeId" to JsonObject("stringValue" to JsonPrimitive(record.hlcNodeId)),
            "createdAt" to JsonObject("integerValue" to JsonPrimitive(record.createdAt.toString())),
            "originDeviceId" to JsonObject("stringValue" to JsonPrimitive(record.originDeviceId)),
            "protocolVersion" to JsonObject("integerValue" to JsonPrimitive(record.protocolVersion.toString())),
            "schemaVersion" to JsonObject("integerValue" to JsonPrimitive(record.schemaVersion.toString()))
        )
        return JsonObject("fields" to fields)
    }

    private fun parseFirestoreDocument(docJson: JsonObject): SyncRecord? {
        val fields = docJson.getObject("fields") ?: return null
        val id = fields.getObject("id")?.getString("stringValue") ?: return null
        val entityType = fields.getObject("entityType")?.getString("stringValue") ?: "TASK"
        val entityId = fields.getObject("entityId")?.getString("stringValue") ?: ""
        val operation = fields.getObject("operation")?.getString("stringValue") ?: "UPSERT"
        val payload = fields.getObject("payload")?.getString("stringValue") ?: ""
        val hlcTimestamp = fields.getObject("hlcTimestamp")?.getString("stringValue") ?: ""
        val createdAt = fields.getObject("createdAt")?.getString("integerValue")?.toLongOrNull() ?: 0L
        val originDeviceId = fields.getObject("originDeviceId")?.getString("stringValue") ?: "unknown"
        val protocolVersion = fields.getObject("protocolVersion")?.getString("integerValue")?.toIntOrNull() ?: 1
        val schemaVersion = fields.getObject("schemaVersion")?.getString("integerValue")?.toIntOrNull() ?: 1

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
}
