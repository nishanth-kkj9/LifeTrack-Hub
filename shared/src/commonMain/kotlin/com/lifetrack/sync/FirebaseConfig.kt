package com.lifetrack.sync

/**
 * SINGLE SOURCE OF TRUTH for Firebase project configuration across ALL platforms
 * (Android, Desktop). The React web app reads the equivalent values from
 * `firebase-applet-config.json` at the repository root — keep both in sync with
 * the SAME Firebase project.
 *
 * IMPORTANT (post-audit fix):
 * Android/Desktop previously pointed at project "galvanic-oarlock-43skh" while the
 * web app used "quadratic-chimera-skx2q". Two projects = cross-platform sync could
 * never work, and `firebase deploy` pushed rules to the wrong project. All values
 * are now unified on the web project.
 *
 * NOTE: A Firebase *web/client* API key is not a secret (it ships inside every
 * browser bundle), but it MUST be restricted in Google Cloud Console
 * (APIs & Services → Credentials → Application restrictions) and real access
 * control is enforced by firestore.rules.
 */
data class FirebaseConfig(
    val projectId: String = PROJECT_ID,
    val firestoreDatabaseId: String = FIRESTORE_DATABASE_ID,
    val apiKey: String = CLIENT_API_KEY
) {
    companion object {
        /** Unified Firebase project (same as firebase-applet-config.json + .firebaserc). */
        const val PROJECT_ID: String = "quadratic-chimera-skx2q"

        /** Named Firestore database used by web + KMP clients. */
        const val FIRESTORE_DATABASE_ID: String = "ai-studio-a7fbef00-eef0-48a1-a3ab-2cd9aa399fbd"

        /** Project-scoped client API key (same key the web app uses). */
        const val CLIENT_API_KEY: String = "AIzaSyB0TVAxrtYyzR-Hk421QpX78ZKIa7rzqoM"

        /**
         * TODO(REQUIRED BEFORE ANDROID RELEASE):
         * Register an Android app (package id `com.lifetrack.android`) inside the
         * Firebase Console for PROJECT_ID, then paste the generated mobilesdk app
         * id here (format: 1:822362997306:android:xxxxxxxxxxxxxxxx).
         * The placeholder below keeps debug builds initializing; Auth/Firestore
         * REST calls do not validate it, but Analytics/CRASHLYTICS will not work
         * until it is replaced.
         */
        const val ANDROID_APPLICATION_ID: String = "1:822362997306:android:REPLACE_FROM_CONSOLE"

        const val STORAGE_BUCKET: String = "$PROJECT_ID.firebasestorage.app"
    }

    val restBaseUrl: String
        get() = "https://firestore.googleapis.com/v1/projects/$projectId/databases/$firestoreDatabaseId/documents"
}
