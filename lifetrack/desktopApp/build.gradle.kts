plugins {
    kotlin("jvm")
    id("org.jetbrains.compose")
}

dependencies {
    implementation(project(":shared"))
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.8.0")
}

compose.desktop {
    application {
        mainClass = "com.lifetrack.desktop.MainKt"
        nativeDistributions {
            targetFormats(
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Msi,
                org.jetbrains.compose.desktop.application.dsl.TargetFormat.Exe
            )
            packageName = "LifeTrackHub"
            packageVersion = "1.0.0"
            description = "LifeTrack-Hub Personal Life & Academic Operating System"
            copyright = "© 2026 LifeTrack"
            windows {
                menuGroup = "LifeTrack"
                upgradeUuid = "a4e0c3df-973e-468a-b851-7f897e6822c1"
            }
        }
    }
}
