package com.lifetrack.sync

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

/**
 * Production Android RemoteSyncTransport backed by the official Firebase Firestore Android SDK.
 *
 * Guarantees:
 * 1. Scoped strictly to authenticated user: `/users/{uid}/deltas/{eventId}`.
 * 2. Idempotent push: Compares all 10 immutable fields on existing document before acknowledging.
 * 3. Never overwrites existing deltas.
 * 4. Structured HLC ordering & cursor pagination.
 */
class AndroidFirestoreRemoteSyncTransport(
    private val authSessionProvider: AuthSessionProvider,
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val projectId: String = "galvanic-oarlock-43skh",
    private val databaseId: String = "ai-studio-a7fbef00-eef0-48a1-a3ab-2cd9aa399fbd"
) : RemoteSyncTransport {

    override suspend fun pushRecords(records: List<SyncRecord>): List<String> {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot push deltas: User is not authenticated")

        val deltasCollection = firestore.collection("users").document(uid).collection("deltas")
        val ackedIds = mutableListOf<String>()

        for (record in records) {
            val docRef = deltasCollection.document(record.id)
            val snapshot = docRef.get().await()

            if (snapshot.exists()) {
                // Read and verify complete immutable event contract
                val existing = mapDocumentToSyncRecord(snapshot.data, record.id)
                if (existing != null) {
                    verifyImmutableDeltaContract(existing, record)
                    // Verified duplicate ACK
                    ackedIds.add(record.id)
                } else {
                    throw SyncDataIntegrityException("Malformed existing remote delta document for event ${record.id}")
                }
            } else {
                val data = mapOf(
                    "id" to record.id,
                    "entityType" to record.entityType,
                    "entityId" to record.entityId,
                    "operation" to record.operation,
                    "payload" to record.payload,
                    "hlcTimestamp" to record.hlcTimestamp,
                    "hlcPhysicalTimeMs" to record.hlcPhysicalTimeMs,
                    "hlcLogicalCounter" to record.hlcLogicalCounter,
                    "hlcNodeId" to record.hlcNodeId,
                    "createdAt" to record.createdAt,
                    "originDeviceId" to record.originDeviceId,
                    "protocolVersion" to record.protocolVersion,
                    "schemaVersion" to record.schemaVersion
                )
                docRef.set(data).await()
                ackedIds.add(record.id)
            }
        }

        return ackedIds
    }

    override suspend fun pullRecords(sinceHlc: String?): List<SyncRecord> {
        val cursor = if (sinceHlc != null) SyncCursor(sinceHlc, "") else null
        return pullRecordsWithCursor(cursor, pageSize = 100)
    }

    override suspend fun pullRecordsWithCursor(cursor: SyncCursor?, pageSize: Int): List<SyncRecord> {
        val uid = authSessionProvider.getCurrentUserUid()
            ?: throw IllegalStateException("Cannot pull deltas: User is not authenticated")

        val deltasCollection = firestore.collection("users").document(uid).collection("deltas")
        val allRecords = mutableListOf<SyncRecord>()
        var currentCursor = cursor

        while (true) {
            var query: Query = deltasCollection
                .orderBy("hlcPhysicalTimeMs", Query.Direction.ASCENDING)
                .orderBy("hlcLogicalCounter", Query.Direction.ASCENDING)
                .orderBy("hlcNodeId", Query.Direction.ASCENDING)
                .orderBy("id", Query.Direction.ASCENDING)

            if (currentCursor != null && currentCursor.lastHlc.isNotBlank()) {
                val hlc = com.lifetrack.core.HlcTimestamp.fromString(currentCursor.lastHlc)
                if (hlc != null) {
                    query = query.startAfter(hlc.physicalTimeMs, hlc.logicalCounter, hlc.nodeId, currentCursor.lastEventId)
                }
            }

            query = query.limit(pageSize.toLong())

            val snapshot = query.get().await()
            val documents = snapshot.documents
            if (documents.isEmpty()) {
                break
            }

            for (doc in documents) {
                val record = mapDocumentToSyncRecord(doc.data, doc.id)
                if (record != null) {
                    allRecords.add(record)
                }
            }

            if (documents.size < pageSize) {
                break
            }

            val lastDoc = documents.last()
            val lastHlc = lastDoc.getString("hlcTimestamp") ?: ""
            currentCursor = SyncCursor(lastHlc, lastDoc.id)
        }

        return allRecords.sortedWith(SyncRecordComparator)
    }

    private fun mapDocumentToSyncRecord(data: Map<String, Any?>?, docId: String): SyncRecord? {
        if (data == null) return null
        val id = data["id"] as? String ?: docId
        val entityType = data["entityType"] as? String ?: return null
        val entityId = data["entityId"] as? String ?: return null
        val operation = data["operation"] as? String ?: return null
        val payload = data["payload"] as? String ?: ""
        val hlcTimestamp = data["hlcTimestamp"] as? String ?: return null
        val createdAt = (data["createdAt"] as? Number)?.toLong() ?: 0L
        val originDeviceId = data["originDeviceId"] as? String ?: "unknown"
        val protocolVersion = (data["protocolVersion"] as? Number)?.toInt() ?: 1
        val schemaVersion = (data["schemaVersion"] as? Number)?.toInt() ?: 1

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
