package com.lifetrack.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lifetrack.sync.SyncEngine
import com.lifetrack.sync.SyncState
import com.lifetrack.ui.theme.LifeTrackEmeraldPrimary
import kotlinx.coroutines.launch

@Composable
fun SyncEnginePanel(
    syncEngine: SyncEngine,
    modifier: Modifier = Modifier
) {
    val syncStatus by syncEngine.syncStatus.collectAsState()
    val scope = rememberCoroutineScope()
    val isOffline = syncStatus.state == SyncState.OFFLINE

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Text(
            text = "Distributed Sync Engine",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Phase 2C.2: Production Firestore REST & Android SDK Transport • Zero-Trust Rules",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )

        Spacer(modifier = Modifier.height(18.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(18.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Engine State: ${syncStatus.state.name}",
                            color = when (syncStatus.state) {
                                SyncState.SUCCESS -> Color(0xFF34D399)
                                SyncState.SYNCING -> Color(0xFF38BDF8)
                                SyncState.ERROR -> Color(0xFFF87171)
                                SyncState.OFFLINE -> Color(0xFFFBBF24)
                                SyncState.IDLE -> Color.White
                            },
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = "Active Node: ${syncStatus.activeDeviceName} • ${if (isOffline) "Offline Mode" else "Connected / Online"}",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFF334155)
                    ) {
                        Text(
                            text = "${syncStatus.pendingOutboxCount} Outbox Pending",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = if (syncStatus.pendingOutboxCount > 0) Color(0xFFFBBF24) else Color(0xFF94A3B8),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text("Remote Checkpoint Cursor: ${syncStatus.lastCheckpointHlc ?: "Genesis (None)"}", color = Color(0xFF94A3B8), fontSize = 12.sp)
                Text(
                    text = "Last Successful Sync: ${if (syncStatus.lastSyncedTimestamp != null) "${syncStatus.lastSyncedTimestamp} ms" else "Never"}",
                    color = if (syncStatus.lastSyncedTimestamp != null) Color(0xFF34D399) else Color(0xFF94A3B8),
                    fontSize = 12.sp
                )
                if (syncStatus.errorMessage != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Last Error: ${syncStatus.errorMessage}", color = Color(0xFFEF4444), fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.height(18.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Simulate Offline Mode", color = Color.White, fontSize = 13.sp)
                    Switch(
                        checked = isOffline,
                        onCheckedChange = { checked ->
                            scope.launch { syncEngine.setOffline(checked) }
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = LifeTrackEmeraldPrimary,
                            checkedTrackColor = Color(0xFF0F766E)
                        )
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { scope.launch { syncEngine.triggerSync() } },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E)),
                        shape = RoundedCornerShape(8.dp),
                        enabled = !isOffline
                    ) {
                        Text("Trigger Sync Now", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }

                    Button(
                        onClick = { scope.launch { syncEngine.retryAllFailed() } },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Retry Failed Records", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
