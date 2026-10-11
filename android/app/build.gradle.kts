import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing (see README "Updates und Signatur"). Every version must be
// signed with the same key, otherwise Android refuses to install it as an
// update. The key in android/signing/release.p12 is password protected; the
// password comes from the ANDROID_SIGNING_PASSWORD environment variable
// (a GitHub secret in CI). An android/key.properties file overrides it.
// Without either, the build falls back to the debug key.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("key.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
val signingPassword: String? = System.getenv("ANDROID_SIGNING_PASSWORD")

android {
    namespace = "com.quickweb.tresor_browser"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Neutral ID: it is visible in the system's app info.
        applicationId = "com.quickweb.browser"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (keystoreProperties.getProperty("storeFile") != null) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        } else if (!signingPassword.isNullOrEmpty()) {
            create("release") {
                storeFile = rootProject.file("signing/release.p12")
                storeType = "pkcs12"
                storePassword = signingPassword
                keyAlias = "browser"
                keyPassword = signingPassword
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    implementation("androidx.activity:activity:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core:1.13.1")
}

flutter {
    source = "../.."
}
