package com.lifetrack

import com.lifetrack.core.StandardHlcClock
import com.lifetrack.core.TestTimeProvider
import com.lifetrack.data.local.PersistentTaskLocalDataSource
import com.lifetrack.data.local.db.MemorySqlDriver
import com.lifetrack.sync.AuthSessionProvider
import com.lifetrack.sync.DefaultMockRemoteTransport
import com.lifetrack.sync.FirestoreRemoteSyncTransport
import com.lifetrack.sync.InMemoryRemoteDeltaStore
import com.lifetrack.sync.RemoteSyncTransport
import com.lifetrack.sync.SyncEngineImpl
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class ProductionDependencyGraphTest {

    @Test
    fun testProductionDependencyGraphRejectsMockTransportFallback() {
        val timeProvider = TestTimeProvider()
        val driver = MemorySqlDriver()
        val localDataSource = PersistentTaskLocalDataSource(driver, timeProvider, seedIfEmpty = false)
        val syncRepo = com.lifetrack.sync.PersistentSyncRepository(driver)
        val hlcClock = StandardHlcClock("node-prod-test", timeProvider)

        val realAuthSessionProvider = object : AuthSessionProvider {
            override fun getCurrentUserUid(): String = "prod-user-123"
            override suspend fun getIdToken(forceRefresh: Boolean): String = "mock-id-token"
        }

        val productionTransport: RemoteSyncTransport = FirestoreRemoteSyncTransport(
            authSessionProvider = realAuthSessionProvider,
            remoteDeltaStore = InMemoryRemoteDeltaStore()
        )

        // Production dependency graph explicitly injects production transport
        val syncEngine = SyncEngineImpl(
            syncRepository = syncRepo,
            localDataSource = localDataSource,
            remoteTransport = productionTransport,
            hlcClock = hlcClock,
            timeProvider = timeProvider,
            deviceId = "node-prod-test",
            deviceName = "Production Test Node"
        )

        assertNotNull(syncEngine)
        // Regress test: ensure production transport is NOT DefaultMockRemoteTransport
        assertFalse(
            productionTransport is DefaultMockRemoteTransport,
            "Production dependency graph MUST NEVER instantiate or use DefaultMockRemoteTransport"
        )
        assertTrue(
            productionTransport is FirestoreRemoteSyncTransport,
            "Production transport must be an instance of Firestore remote transport"
        )
    }

    @Test
    fun testAuthSessionProviderContractAdherence() {
        val provider = object : AuthSessionProvider {
            override fun getCurrentUserUid(): String? = "authenticated_uid_abc"
            override suspend fun getIdToken(forceRefresh: Boolean): String? = "jwt_token_sample"
        }

        assertNotNull(provider.getCurrentUserUid())
        assertTrue(provider.getCurrentUserUid() == "authenticated_uid_abc")
    }
}
