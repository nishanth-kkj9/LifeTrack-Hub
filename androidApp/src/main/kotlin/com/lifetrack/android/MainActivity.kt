package com.lifetrack.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.lifetrack.android.ui.AndroidMainScreen
import com.lifetrack.ui.theme.LifeTrackTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val viewModel = (application as LifeTrackApp).tasksViewModel

        setContent {
            LifeTrackTheme {
                AndroidMainScreen(viewModel = viewModel)
            }
        }
    }
}
