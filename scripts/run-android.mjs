#!/usr/bin/env node
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
import { createConnection } from "node:net";
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

  // Prevent com.android.prefs.AndroidLocationsException caused by having both
  // ANDROID_PREFS_ROOT and ANDROID_USER_HOME set in environment.
  if (environment.ANDROID_PREFS_ROOT && environment.ANDROID_USER_HOME) {
    delete environment.ANDROID_PREFS_ROOT;
  }

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

export const PACKAGE_NAME = "com.example.financetracker";

// Check if a local port is already accepting connections (e.g. active Metro bundler).
export function isPortInUse(port = 8081, host = "127.0.0.1") {
  return new Promise((resolveResult) => {
    const socket = createConnection({ port, host });
    socket.once("connect", () => {
      socket.destroy();
      resolveResult(true);
    });
    socket.once("error", () => {
      resolveResult(false);
    });
  });
}

// Clear application data on the target Android device to guarantee clean state.
export function clearAppData(adbPath, serial = null, packageName = PACKAGE_NAME) {
  const args = serial
    ? ["-s", serial, "shell", "pm", "clear", packageName]
    : ["shell", "pm", "clear", packageName];
  try {
    const result = spawnSync(adbPath, args, {
      encoding: "utf8",
      windowsHide: true,
    });
    return (result.stdout || "").includes("Success");
  } catch {
    return false;
  }
}

// Reverse Metro port over ADB so emulator reliably communicates with local host.
export function reverseMetroPort(adbPath, serial = null, port = 8081) {
  const args = serial
    ? ["-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`]
    : ["reverse", `tcp:${port}`, `tcp:${port}`];
  try {
    const result = spawnSync(adbPath, args, {
      encoding: "utf8",
      windowsHide: true,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

// Launch the application using Expo development client deep link or MainActivity.
export function launchApp(adbPath, serial = null, port = 8081, isReversed = true) {
  const isEmulator = !serial || serial.startsWith("emulator-");
  const host = isReversed ? "localhost" : isEmulator ? "10.0.2.2" : "localhost";
  const deepLink = `exp+moneymap-finance-tracker://expo-development-client/?url=http%3A%2F%2F${host}%3A${port}`;
  const deepLinkArgs = serial
    ? ["-s", serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", deepLink]
    : ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", deepLink];
  try {
    const deepResult = spawnSync(adbPath, deepLinkArgs, {
      encoding: "utf8",
      windowsHide: true,
    });
    if (deepResult.status === 0 && !(deepResult.stderr || "").includes("Error")) {
      return true;
    }
  } catch {
    // Fall back to direct component launch below
  }

  const fallbackArgs = serial
    ? ["-s", serial, "shell", "am", "start", "-n", `${PACKAGE_NAME}/.MainActivity`]
    : ["shell", "am", "start", "-n", `${PACKAGE_NAME}/.MainActivity`];
  try {
    const fallbackResult = spawnSync(adbPath, fallbackArgs, {
      encoding: "utf8",
      windowsHide: true,
    });
    return fallbackResult.status === 0;
  } catch {
    return false;
  }
}

// Parse launcher-specific options while keeping forwarded Expo arguments clean.
export function parseLauncherOptions(argv) {
  const checkOnly = argv.includes("--check");
  const cleanOnly = argv.includes("--clean-only");
  const preserveData = argv.includes("--preserve-data") || argv.includes("--no-clean");
  const forceClean = argv.includes("--clean");
  const hasDeviceArg = argv.some((arg) => arg === "-d" || arg.startsWith("--device"));

  // Strip MoneyMap-internal flags so Expo CLI does not reject unknown arguments.
  const internalFlags = new Set(["--clean", "--clean-only", "--preserve-data", "--no-clean"]);
  const expoForwardedArgs = argv.filter((arg) => !internalFlags.has(arg));

  return {
    checkOnly,
    cleanOnly,
    preserveData,
    forceClean,
    hasDeviceArg,
    expoForwardedArgs,
  };
}

// Run Expo with the same Node executable selected by Android Studio. Forward all
// extra npm arguments so options such as `--device` continue to work.
async function run() {
  try {
    const configuration = createAndroidEnvironment();
    const rawArguments = process.argv.slice(2);
    const options = parseLauncherOptions(rawArguments);

    if (options.checkOnly) {
      printCheckResult(configuration);
      return;
    }

    const adbExecutable =
      configuration.targetPlatform === "win32" ? "adb.exe" : "adb";
    const adbPath = resolve(
      configuration.androidSdk,
      "platform-tools",
      adbExecutable,
    );

    // Ensure an Android device or emulator is running and booted before launching Expo.
    // This eliminates the race condition where Expo queries ADB before an emulator finishes booting.
    let devices = getConnectedDevices(adbPath);
    let activeDevice = devices.find((d) => d.state === "device");
    if (!activeDevice && !options.hasDeviceArg) {
      console.log("[MoneyMap] No booted Android device detected. Launching emulator...");
      await startEmulator();
      devices = getConnectedDevices(adbPath);
      activeDevice = devices.find((d) => d.state === "device");
    }

    const targetSerial = activeDevice?.serial ?? null;

    let reversed = false;
    // Set up ADB reverse port forwarding so Metro connections always succeed.
    if (targetSerial) {
      reversed = reverseMetroPort(adbPath, targetSerial, 8081);
    }

    // Fast-path: clear state and launch existing build without Gradle rebuild.
    if (options.cleanOnly) {
      if (targetSerial) {
        console.log(`[MoneyMap] Resetting app state on ${targetSerial}...`);
        const cleared = clearAppData(adbPath, targetSerial);
        console.log(cleared ? "[MoneyMap] App state cleared (clean state)." : "[MoneyMap] App state reset.");
        console.log("[MoneyMap] Launching app...");
        launchApp(adbPath, targetSerial, 8081, reversed);
      } else {
        console.warn("[MoneyMap] No active Android device found to clean state.");
      }
      return;
    }

    // Default clean-state behavior on emulator: clear app data unless --preserve-data was specified.
    const shouldClean = options.forceClean || !options.preserveData;
    if (shouldClean && targetSerial) {
      console.log(`[MoneyMap] Ensuring clean state on ${targetSerial}...`);
      clearAppData(adbPath, targetSerial);
    }

    // Detect if Metro bundler is already running to avoid port conflict prompts.
    const expoArgs = [...options.expoForwardedArgs];
    const portActive = await isPortInUse(8081);
    const hasBundlerArg = expoArgs.some(
      (arg) => arg.startsWith("--no-bundler") || arg === "-p" || arg.startsWith("--port"),
    );
    if (portActive && !hasBundlerArg) {
      console.log("[MoneyMap] Metro is already running on port 8081. Skipping bundler startup (--no-bundler).");
      expoArgs.push("--no-bundler");
    }

    const expoArguments = [
      configuration.expoCli,
      "run:android",
      ...expoArgs,
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
