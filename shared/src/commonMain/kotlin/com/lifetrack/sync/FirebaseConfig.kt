package com.lifetrack.sync

/**
 * Authoritative Firebase project and database configuration for LifeTrack Hub.
 */
data class FirebaseConfig(
    val projectId: String = "galvanic-oarlock-43skh",
    val firestoreDatabaseId: String = "ai-studio-a7fbef00-eef0-48a1-a3ab-2cd9aa399fbd",
    val apiKey: String = "AIzaSyA3Qd0EdAPWUslmC75YI_mga4KD9Df9eAs"
) {
    val restBaseUrl: String
        get() = "https://firestore.googleapis.com/v1/projects/$projectId/databases/$firestoreDatabaseId/documents"
}
