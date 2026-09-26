import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releaseSigningPropertiesFile = rootProject.file("key.properties")
val releaseSigningProperties = Properties()
if (releaseSigningPropertiesFile.isFile) {
    releaseSigningPropertiesFile.inputStream().use(releaseSigningProperties::load)
}

val requiredReleaseSigningProperties =
    listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
val missingReleaseSigningProperties =
    requiredReleaseSigningProperties.filter { key ->
        releaseSigningProperties.getProperty(key).isNullOrBlank()
    }
val releaseStoreFile =
    releaseSigningProperties.getProperty("storeFile")?.trim()?.takeIf(String::isNotEmpty)?.let { path ->
        val expandedPath =
            when {
                path == "~" -> System.getProperty("user.home")
                path.startsWith("~/") || path.startsWith("~\\") ->
                    System.getProperty("user.home") + path.substring(1)
                else -> path
            }
        rootProject.file(expandedPath)
    }
val releaseSigningReady =
    releaseSigningPropertiesFile.isFile &&
        missingReleaseSigningProperties.isEmpty() &&
        releaseStoreFile?.isFile == true
val releaseBuildRequested =
    gradle.startParameter.taskNames.any { taskName ->
        taskName.substringAfterLast(':').contains("release", ignoreCase = true)
    }

if (releaseBuildRequested && !releaseSigningReady) {
    val reason =
        when {
            !releaseSigningPropertiesFile.isFile -> "android/key.properties is missing."
            missingReleaseSigningProperties.isNotEmpty() ->
                "android/key.properties is missing required signing entries."
            else -> "The configured release keystore file does not exist."
        }
    throw GradleException(
        "Production signing is required for release builds. $reason " +
            "See mobile/README.md for setup instructions.",
    )
}

android {
    namespace = "kr.co.bowlingmanager.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "kr.co.bowlingmanager.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = releaseStoreFile
                storePassword = releaseSigningProperties.getProperty("storePassword")
                keyAlias = releaseSigningProperties.getProperty("keyAlias")
                keyPassword = releaseSigningProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
