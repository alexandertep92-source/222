plugins {
    id("com.android.application")
}

// Die App ist nur eine Hülle: Das eigentliche Spiel liegt in spiel/web und wird
// unverändert als Asset eingebaut.
val buildNumber = (System.getenv("BUILD_NUMBER") ?: "1").toInt()

android {
    namespace = "com.quickweb.rumms"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.quickweb.rumms"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    // Eigener, fester Schlüssel nur für das Spiel, damit jede neue APK als Update
    // installiert werden kann. Das Spiel speichert keine privaten Daten, deshalb
    // steht das Passwort hier offen (siehe spiel/README.md).
    signingConfigs {
        create("rumms") {
            storeFile = rootProject.file("rumms.p12")
            storeType = "pkcs12"
            storePassword = "rumms-spiel"
            keyAlias = "rumms"
            keyPassword = "rumms-spiel"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("rumms")
        }
        debug {
            signingConfig = signingConfigs.getByName("rumms")
        }
    }

    sourceSets {
        getByName("main") {
            assets.srcDir("../../web")
        }
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
