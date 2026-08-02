const { withAppBuildGradle } = require("@expo/config-plugins");

// Leave Ninja a ten-character safety margin while preserving room for generated target folders.
const CMAKE_OBJECT_PATH_LIMIT = 250;

// This stable generated-Gradle anchor keeps the mutation narrow and easy to audit.
const DEFAULT_CONFIG_ANCHOR = "    defaultConfig {\n";

// This marker makes repeated prebuilds idempotent instead of duplicating CMake arguments.
const CMAKE_ARGUMENT_MARKER = `-DCMAKE_OBJECT_PATH_MAX=${CMAKE_OBJECT_PATH_LIMIT}`;

// This stable marker identifies the short, per-checkout native staging directory.
const BUILD_STAGING_MARKER = "moneymap-cxx-";

// This block asks CMake to hash long object paths before Windows Ninja reaches MAX_PATH.
const CMAKE_CONFIGURATION = `    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "${CMAKE_ARGUMENT_MARKER}"
            }
        }
`;

// This anchor targets Expo's real Android DSL block rather than examples inside comments.
const ANDROID_BLOCK_PATTERN = /^android \{\r?\n/m;

// Gradle hashes the checkout path into a stable Java-temp child to avoid cross-checkout collisions.
const BUILD_STAGING_CONFIGURATION = `android {
    externalNativeBuild {
        cmake {
            buildStagingDirectory new File(System.getProperty("java.io.tmpdir"), "${BUILD_STAGING_MARKER}\${Integer.toUnsignedString(rootDir.absolutePath.hashCode(), 16)}")
        }
    }

`;

/**
 * Adds deterministic CMake path controls to the generated Android application build.
 *
 * @param {import("@expo/config-plugins").ExpoConfig} config Expo's mutable app configuration.
 * @returns {import("@expo/config-plugins").ExpoConfig} The configuration with an Android Gradle mod.
 */
function withAndroidCmakeObjectPathLimit(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    // Expo currently emits Groovy for the Android application module.
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("MoneyMap requires a Groovy Android application build file.");
    }

    // A clean or repeated prebuild may already contain the requested hash ceiling.
    if (!gradleConfig.modResults.contents.includes(CMAKE_ARGUMENT_MARKER)) {
      // Failing loudly is safer than silently generating a long-path-vulnerable build.
      if (!gradleConfig.modResults.contents.includes(DEFAULT_CONFIG_ANCHOR)) {
        throw new Error("MoneyMap could not locate Android's defaultConfig block.");
      }

      // Only the first application defaultConfig block receives the native build argument.
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        DEFAULT_CONFIG_ANCHOR,
        CMAKE_CONFIGURATION,
      );
    }

    // A short staging root leaves enough space for CMake's hash and each object basename.
    if (!gradleConfig.modResults.contents.includes(BUILD_STAGING_MARKER)) {
      // The top-level Android block owns the CMake staging-directory setting.
      if (!ANDROID_BLOCK_PATTERN.test(gradleConfig.modResults.contents)) {
        throw new Error("MoneyMap could not locate Android's configuration block.");
      }

      // The first real Android block receives one stable, per-checkout staging directory.
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        ANDROID_BLOCK_PATTERN,
        BUILD_STAGING_CONFIGURATION,
      );
    }

    return gradleConfig;
  });
}

module.exports = withAndroidCmakeObjectPathLimit;
