package com.lifetrack.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val LifeTrackEmeraldPrimary = Color(0xFF0F766E)
val LifeTrackEmeraldContainer = Color(0xFFCCFBF1)
val LifeTrackSlateBackground = Color(0xFFF8FAFC)
val LifeTrackSlateSurface = Color(0xFFFFFFFF)
val LifeTrackTextPrimary = Color(0xFF0F172A)
val LifeTrackTextSecondary = Color(0xFF475569)

val LifeTrackDarkSurface = Color(0xFF1E293B)
val LifeTrackDarkBackground = Color(0xFF0F172A)
val LifeTrackDarkPrimary = Color(0xFF2DD4BF)

private val LightColorScheme = lightColorScheme(
    primary = LifeTrackEmeraldPrimary,
    primaryContainer = LifeTrackEmeraldContainer,
    background = LifeTrackSlateBackground,
    surface = LifeTrackSlateSurface,
    onPrimary = Color.White,
    onBackground = LifeTrackTextPrimary,
    onSurface = LifeTrackTextPrimary
)

private val DarkColorScheme = darkColorScheme(
    primary = LifeTrackDarkPrimary,
    background = LifeTrackDarkBackground,
    surface = LifeTrackDarkSurface,
    onPrimary = Color.Black,
    onBackground = Color(0xFFF1F5F9),
    onSurface = Color(0xFFF1F5F9)
)

@Composable
fun LifeTrackTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
