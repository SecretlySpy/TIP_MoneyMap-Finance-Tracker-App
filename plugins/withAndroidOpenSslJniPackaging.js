const { withAppBuildGradle } = require("@expo/config-plugins");

// Match the OpenSSL Prefab revision that OP-SQLite 17.1.3 links against for SQLCipher.
const OPENSSL_COORDINATE = "io.github.ronickg:openssl:3.3.2-1";

// This task name doubles as an idempotency marker for repeated Expo prebuilds.
const OPENSSL_TASK_NAME = "prepareMoneyMapOpenSslJni";

// Expo's generated application Gradle file contains one top-level dependencies block.
const DEPENDENCIES_BLOCK_PATTERN = /^dependencies \{\r?\n/m;

// Prefab exposes libcrypto for native linking but does not place it in the APK's jniLibs.
const OPENSSL_PACKAGING_CONFIGURATION = `// Package the shared OpenSSL provider required by OP-SQLite's SQLCipher build.
def moneyMapOpenSsl = configurations.create("moneyMapOpenSsl")
dependencies.add("moneyMapOpenSsl", "${OPENSSL_COORDINATE}")

// Keep extracted native artifacts inside the generated Android build directory.
def moneyMapOpenSslJniDir = layout.buildDirectory.dir("generated/moneymap-openssl-jni")

// Extract only libcrypto and rewrite Prefab's directory names to Android ABI names.
def ${OPENSSL_TASK_NAME} = tasks.register("${OPENSSL_TASK_NAME}", Sync) {
    from({ moneyMapOpenSsl.collect { archive -> zipTree(archive) } }) {
        include "prefab/modules/crypto/libs/android.*/libcrypto.so"
        eachFile { nativeLibrary ->
            def prefabAbi = nativeLibrary.path.split("/")[4]
            nativeLibrary.path = "\${prefabAbi.substring('android.'.length())}/libcrypto.so"
        }
        includeEmptyDirs = false
    }
    into moneyMapOpenSslJniDir
}

// Register the generated ABI folders as application JNI inputs.
android.sourceSets.main.jniLibs.srcDir(moneyMapOpenSslJniDir)

// Ensure extraction finishes before each Android variant merges native libraries.
tasks.configureEach { nativeMergeTask ->
    def mergesJniFolders = nativeMergeTask.name.endsWith("JniLibFolders")
    def mergesNativeLibs = nativeMergeTask.name.endsWith("NativeLibs")
    if (nativeMergeTask.name.startsWith("merge") && (mergesJniFolders || mergesNativeLibs)) {
        nativeMergeTask.dependsOn(${OPENSSL_TASK_NAME})
    }
}

`;

/**
 * Adds deterministic OpenSSL JNI packaging to an Expo-generated Gradle application.
 *
 * @param {string} contents Generated Android application Gradle source.
 * @returns {string} Gradle source containing one idempotent OpenSSL packaging block.
 */
function injectAndroidOpenSslJniPackaging(contents) {
  // Repeated prebuilds must preserve exactly one extraction task.
  if (contents.includes(OPENSSL_TASK_NAME)) {
    return contents;
  }

  // A missing anchor signals an unsupported Expo Gradle template.
  if (!DEPENDENCIES_BLOCK_PATTERN.test(contents)) {
    throw new Error("MoneyMap could not locate Android's dependencies block for OpenSSL packaging.");
  }

  // Insert configuration immediately before the application dependency declarations.
  return contents.replace(
    DEPENDENCIES_BLOCK_PATTERN,
    `${OPENSSL_PACKAGING_CONFIGURATION}dependencies {\n`,
  );
}

/**
 * Configures Expo prebuild to package SQLCipher's OpenSSL runtime for every Android ABI.
 *
 * @param {import("@expo/config-plugins").ExpoConfig} config Expo's mutable app configuration.
 * @returns {import("@expo/config-plugins").ExpoConfig} Configuration with an Android Gradle mod.
 */
function withAndroidOpenSslJniPackaging(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    // The mutation targets Expo's Groovy application template only.
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("MoneyMap requires a Groovy Android application build file.");
    }

    // Apply the pure, unit-tested Gradle transformation.
    gradleConfig.modResults.contents = injectAndroidOpenSslJniPackaging(
      gradleConfig.modResults.contents,
    );

    return gradleConfig;
  });
}

module.exports = withAndroidOpenSslJniPackaging;
module.exports.injectAndroidOpenSslJniPackaging = injectAndroidOpenSslJniPackaging;
