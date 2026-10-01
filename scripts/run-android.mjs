/**
 * Starts Expo's native Android workflow with project-local, cross-platform setup.
 *
 * Android Studio launches this file through its bundled Shell Script runner,
 * using Node as the interpreter. The launcher deliberately avoids Bash, NVM
 * initialization commands, and personal dotfiles so the same project action
 * works on Windows, macOS, and Linux.
 */

// Import only Node.js standard-library modules so the launcher works before any
// optional global command-line packages have been installed.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { delimiter, dirname, posix, resolve, win32 } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getConnectedDevices, startEmulator } from "./emulator.mjs";

// Resolve project-relative files from this script instead of relying on the
// terminal's current directory, which varies between IDEs and operating systems.
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

// Read environment variables case-insensitively on Windows while keeping the
// normal exact-name behavior on macOS and Linux.
function readEnvironmentValue(environment, name, targetPlatform) {
  if (targetPlatform !== "win32") {
    return environment[name];
  }

  const matchingKey = Object.keys(environment).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  return matchingKey ? environment[matchingKey] : undefined;
}

// Remove empty values and duplicates while preserving the intended preference
// order: explicit developer configuration first, conventional fallbacks second.
function uniqueCandidates(candidates) {
  return [...new Set(candidates.filter((candidate) => Boolean(candidate?.trim())))];
}

// Decode the escaping used by Gradle's local.properties file so sdk.dir can be
// reused when Expo has already generated the native Android project.
export function decodeGradleProperty(value) {
  return value.trim().replace(/\\:/g, ":").replace(/\\\\/g, "\\");
}

// Return the path implementation for the target operating system. Injecting the
// target makes candidate generation testable for all three platforms on one host.
function pathApiFor(targetPlatform) {
  return targetPlatform === "win32" ? win32 : posix;
}

// Expand the documented MoneyMap toolchain directory because managed JDK folders
// may include an installation timestamp (for example, temurin-21-20260801155311).
function discoveredMoneyMapJdks(toolchainRoot, pathApi) {
  if (!existsSync(toolchainRoot)) {
    return [];
  }

  try {
    return readdirSync(toolchainRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("temurin-21"))
      .sort((left, right) => right.name.localeCompare(left.name))
      .flatMap((entry) => {
        const installationRoot = pathApi.join(toolchainRoot, entry.name);
        const nestedHomes = readdirSync(installationRoot, { withFileTypes: true })
          .filter((child) => child.isDirectory())
          .map((child) => pathApi.join(installationRoot, child.name));
        return [installationRoot, ...nestedHomes];
      });
  } catch {
    // Ignore an unreadable optional toolchain directory and continue to standard JDKs.
    return [];
  }
}

// Build the ordered Android SDK candidate list. Standard environment variables
// win, followed by android/local.properties and each OS's conventional SDK path.
export function androidSdkCandidates({
  targetPlatform,
  environment,
  homeDirectory,
  localPropertiesText = "",
}) {
  const pathApi = pathApiFor(targetPlatform);
  const candidates = [
    readEnvironmentValue(environment, "ANDROID_SDK_ROOT", targetPlatform),
    readEnvironmentValue(environment, "ANDROID_HOME", targetPlatform),
  ];

  const sdkProperty = localPropertiesText
    .split(/\r?\n/)
    .find((line) => line.startsWith("sdk.dir="));
  if (sdkProperty) {
    candidates.push(decodeGradleProperty(sdkProperty.slice("sdk.dir=".length)));
  }

  if (targetPlatform === "win32") {
    const localAppData =
      readEnvironmentValue(environment, "LOCALAPPDATA", targetPlatform) ??
      pathApi.join(homeDirectory, "AppData", "Local");
    candidates.push(pathApi.join(localAppData, "Android", "Sdk"));

    // Support workstations that keep the user profile mirror on another drive.
    const userName = pathApi.basename(homeDirectory);
    for (const driveLetter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      candidates.push(
        `${driveLetter}:\\Users\\${userName}\\AppData\\Local\\Android\\Sdk`,
      );
    }
  } else if (targetPlatform === "darwin") {
    candidates.push(pathApi.join(homeDirectory, "Library", "Android", "sdk"));
  } else {
    candidates.push(
      pathApi.join(homeDirectory, "Android", "Sdk"),
      pathApi.join(homeDirectory, ".local", "share", "Android", "Sdk"),
    );
  }

  return uniqueCandidates(candidates);
}

// Build compatible Java-home candidates. The list covers explicit settings,
// Android Studio's bundled runtime, the documented MoneyMap toolchain, and common
// JDK 21 package-manager locations on Windows, macOS, and Linux.
export function javaHomeCandidates({
  targetPlatform,
  environment,
  homeDirectory,
}) {
  const pathApi = pathApiFor(targetPlatform);
  const candidates = [
    readEnvironmentValue(environment, "MONEYMAP_JAVA_HOME", targetPlatform),
    readEnvironmentValue(environment, "JAVA_HOME", targetPlatform),
    readEnvironmentValue(environment, "STUDIO_JDK", targetPlatform),
    readEnvironmentValue(environment, "JDK_HOME", targetPlatform),
  ];

  if (targetPlatform === "win32") {
    const localAppData =
      readEnvironmentValue(environment, "LOCALAPPDATA", targetPlatform) ??
      pathApi.join(homeDirectory, "AppData", "Local");
    candidates.push(
      ...discoveredMoneyMapJdks(
        pathApi.join(localAppData, "MoneyMap", "toolchains"),
        pathApi,
      ),
    );

    const programFiles =
      readEnvironmentValue(environment, "ProgramFiles", targetPlatform) ??
      "C:\\Program Files";
    candidates.push(pathApi.join(programFiles, "Android", "Android Studio", "jbr"));

    // Check alternate drive installations used by lab and dual-drive machines.
    for (const driveLetter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      candidates.push(
        `${driveLetter}:\\Program Files\\Android\\Android Studio\\jbr`,
      );
    }
  } else if (targetPlatform === "darwin") {
    candidates.push(
      "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
      pathApi.join(
        homeDirectory,
        "Applications",
        "Android Studio.app",
        "Contents",
        "jbr",
        "Contents",
        "Home",
      ),
      "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
      "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
      "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home",
    );
  } else {
    candidates.push(
      ...discoveredMoneyMapJdks(
        pathApi.join(homeDirectory, ".local", "share", "MoneyMap", "toolchains"),
        pathApi,
      ),
      "/opt/android-studio/jbr",
      "/usr/local/android-studio/jbr",
      pathApi.join(homeDirectory, "android-studio", "jbr"),
      "/snap/android-studio/current/android-studio/jbr",
      "/usr/lib/jvm/java-21-openjdk-amd64",
      "/usr/lib/jvm/temurin-21-jdk-amd64",
    );
  }

  return uniqueCandidates(candidates);
}

// Read an existing generated local.properties file when available. A missing
// native directory is normal because Expo Continuous Native Generation creates it.
function readLocalProperties(workspaceRoot) {
  const localPropertiesPath = resolve(workspaceRoot, "android", "local.properties");
  return existsSync(localPropertiesPath)
    ? readFileSync(localPropertiesPath, "utf8")
    : "";
}

// Select an SDK only when platform-tools is installed. Expo needs ADB to install
// and open the development build, so accepting an incomplete SDK would fail later.
export function resolveAndroidSdk(options) {
  const executableName = options.targetPlatform === "win32" ? "adb.exe" : "adb";
  const pathApi = pathApiFor(options.targetPlatform);
  const candidates = androidSdkCandidates(options);
  const selected = candidates.find((candidate) =>
    existsSync(pathApi.join(candidate, "platform-tools", executableName)),
  );

  if (!selected) {
    throw new Error(
      "Android SDK platform-tools were not found. Install them in Android Studio or set ANDROID_SDK_ROOT.",
    );
  }
  return selected;
}

// Extract Java's major version from the vendor-neutral `java -version` output.
// The current Expo/Gradle baseline accepts JDK 17 through 21 and rejects Java 25.
function readJavaMajor(javaExecutable) {
  const result = spawnSync(javaExecutable, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const versionOutput = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
  const match = versionOutput.match(/version\s+"(?:1\.)?(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

// Pick the first installed Java home whose runtime is compatible with the
// project's Gradle stack. This lets the launcher skip an incompatible JAVA_HOME.
function resolveJavaHome(options) {
  const pathApi = pathApiFor(options.targetPlatform);
  const executableName = options.targetPlatform === "win32" ? "java.exe" : "java";

  for (const candidate of javaHomeCandidates(options)) {
    const javaExecutable = pathApi.join(candidate, "bin", executableName);
    if (existsSync(javaExecutable)) {
      const major = readJavaMajor(javaExecutable);
      if (major !== null && major >= 17 && major <= 21) {
        return { home: candidate, major };
      }
    }
  }

  throw new Error(
    "A compatible JDK was not found. Install JDK 21 or set MONEYMAP_JAVA_HOME to JDK 17-21.",
  );
}

// Resolve Expo from node_modules so the launcher never depends on a globally
// installed Expo CLI or an operating-system-specific executable suffix.
function resolveExpoCli() {
  const require = createRequire(import.meta.url);
  return require.resolve("expo/bin/cli");
}

// Prepare a child-process environment without modifying the user's shell profile
// or machine-wide SDK/JDK settings.
function createAndroidEnvironment() {
  const targetPlatform = process.platform;
  const environment = { ...process.env };
  const homeDirectory = homedir();
  const localPropertiesText = readLocalProperties(projectRoot);
  const commonOptions = {
    targetPlatform,
    environment,
    homeDirectory,
    workspaceRoot: projectRoot,
    localPropertiesText,
  };
  const androidSdk = resolveAndroidSdk(commonOptions);
  const java = resolveJavaHome(commonOptions);
  const pathApi = pathApiFor(targetPlatform);

  environment.ANDROID_HOME = androidSdk;
  environment.ANDROID_SDK_ROOT = androidSdk;
  environment.JAVA_HOME = java.home;
  environment.NODE_ENV = "development";

  const pathKey =
    Object.keys(environment).find((key) => key.toLowerCase() === "path") ?? "PATH";
  environment[pathKey] = [
    pathApi.join(java.home, "bin"),
    pathApi.join(androidSdk, "platform-tools"),
    pathApi.join(androidSdk, "emulator"),
    environment[pathKey] ?? "",
  ].join(delimiter);

  return {
    androidSdk,
    environment,
    expoCli: resolveExpoCli(),
    java,
    targetPlatform,
  };
}

// Print a non-destructive preflight result for CI, setup troubleshooting, and
// IDE verification. This mode never starts Gradle, Metro, an emulator, or a device.
function printCheckResult(configuration) {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  console.log("[MoneyMap] Android launcher check passed.");
  console.log(`[MoneyMap] Host: ${configuration.targetPlatform}`);
  console.log(`[MoneyMap] Node: ${process.version}`);
  console.log(`[MoneyMap] Android SDK: ${configuration.androidSdk}`);
  console.log(`[MoneyMap] Java: ${configuration.java.home} (major ${configuration.java.major})`);
  console.log(`[MoneyMap] Expo CLI: ${configuration.expoCli}`);

  if (nodeMajor !== 22) {
    console.warn(
      `[MoneyMap] Warning: Node 22 LTS is the documented baseline; current runtime is ${process.version}.`,
    );
  }
}

// Run Expo with the same Node executable selected by Android Studio. Forward all
// extra npm arguments so options such as `--device` continue to work.
async function run() {
  try {
    const configuration = createAndroidEnvironment();
    const forwardedArguments = process.argv.slice(2);
    const checkOnly = forwardedArguments.includes("--check");

    if (checkOnly) {
      printCheckResult(configuration);
      return;
    }

    // Ensure an Android device or emulator is running and booted before launching Expo.
    // This eliminates the race condition where Expo queries ADB before an emulator finishes booting.
    const hasDeviceArg = forwardedArguments.some(
      (arg) => arg === "-d" || arg.startsWith("--device"),
    );
    if (!hasDeviceArg) {
      const adbExecutable =
        configuration.targetPlatform === "win32" ? "adb.exe" : "adb";
      const adbPath = resolve(
        configuration.androidSdk,
        "platform-tools",
        adbExecutable,
      );
      const devices = getConnectedDevices(adbPath);
      const activeDevice = devices.find((d) => d.state === "device");
      if (!activeDevice) {
        console.log("[MoneyMap] No booted Android device detected. Launching emulator...");
        await startEmulator();
      }
    }

    const expoArguments = [
      configuration.expoCli,
      "run:android",
      ...forwardedArguments,
    ];
    const child = spawn(process.execPath, expoArguments, {
      cwd: projectRoot,
      env: configuration.environment,
      stdio: "inherit",
      windowsHide: false,
    });

    const exitCode = await new Promise((resolveExitCode, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolveExitCode(code ?? 1));
    });
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`[MoneyMap] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

// Execute only when launched as the program entry point; imported test modules can
// exercise candidate generation without triggering Expo or modifying the process.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
