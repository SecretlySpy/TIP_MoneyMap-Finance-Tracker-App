/**
 * Cross-platform Android emulator management script for MoneyMap.
 * Works on Linux, macOS, and Windows without PowerShell or Bash.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveAndroidSdk } from "./run-android.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

function getLocalProperties() {
  const localPropertiesPath = resolve(projectRoot, "android", "local.properties");
  return existsSync(localPropertiesPath)
    ? readFileSync(localPropertiesPath, "utf8")
    : "";
}

function getSdkAndTools() {
  const targetPlatform = process.platform;
  const sdk = resolveAndroidSdk({
    targetPlatform,
    environment: process.env,
    homeDirectory: homedir(),
    localPropertiesText: getLocalProperties(),
  });

  const adbName = targetPlatform === "win32" ? "adb.exe" : "adb";
  const emulatorName = targetPlatform === "win32" ? "emulator.exe" : "emulator";

  const adbPath = join(sdk, "platform-tools", adbName);
  const emulatorPath = join(sdk, "emulator", emulatorName);

  if (!existsSync(emulatorPath)) {
    throw new Error(`Android emulator not found at ${emulatorPath}. Install via Android SDK Manager.`);
  }

  return { sdk, adbPath, emulatorPath, targetPlatform };
}

function getAvailableAvds(emulatorPath) {
  const result = spawnSync(emulatorPath, ["-list-avds"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) return [];
  return (result.stdout || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getConnectedDevices(adbPath) {
  const result = spawnSync(adbPath, ["devices"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) return [];
  const lines = (result.stdout || "").split(/\r?\n/).slice(1);
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    });
}

function isBootCompleted(adbPath, serial) {
  const result = spawnSync(adbPath, ["-s", serial, "shell", "getprop", "sys.boot_completed"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return (result.stdout || "").trim() === "1";
}

async function waitForBoot(adbPath, serial, timeoutSeconds = 180) {
  const start = Date.now();
  const deadline = start + timeoutSeconds * 1000;
  console.log(`[MoneyMap] Waiting for emulator (${serial}) to complete boot (timeout: ${timeoutSeconds}s)...`);

  while (Date.now() < deadline) {
    const devices = getConnectedDevices(adbPath);
    const target = devices.find((d) => d.serial === serial);

    if (target && target.state === "device") {
      if (isBootCompleted(adbPath, serial)) {
        console.log(`[MoneyMap] Emulator (${serial}) is booted and ready!`);
        return true;
      }
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`[MoneyMap] Emulator (${serial}) timed out waiting to boot after ${timeoutSeconds}s.`);
}

export async function startEmulator(avdNameArg) {
  const { sdk, adbPath, emulatorPath, targetPlatform } = getSdkAndTools();
  const availableAvds = getAvailableAvds(emulatorPath);

  if (availableAvds.length === 0) {
    throw new Error(
      "[MoneyMap] No AVDs found! Create one in Android Studio (e.g. API 35 Google APIs x86_64) or via avdmanager.",
    );
  }

  // Priority order for selecting default AVD
  let chosenAvd = avdNameArg;
  if (!chosenAvd) {
    const preferredNames = ["MoneyMap_API_35", "MoneyMap_VSCode_API_35", "MetroDrip_Pixel_API36"];
    for (const pref of preferredNames) {
      if (availableAvds.includes(pref)) {
        chosenAvd = pref;
        break;
      }
    }
    if (!chosenAvd) {
      chosenAvd = availableAvds[0];
    }
  }

  if (!availableAvds.includes(chosenAvd)) {
    throw new Error(`[MoneyMap] AVD "${chosenAvd}" not found. Available AVDs: ${availableAvds.join(", ")}`);
  }

  // Check if an emulator is already running
  const devices = getConnectedDevices(adbPath);
  const runningEmulator = devices.find((d) => d.serial.startsWith("emulator-"));
  if (runningEmulator) {
    console.log(`[MoneyMap] Emulator already running: ${runningEmulator.serial} (${runningEmulator.state}).`);
    await waitForBoot(adbPath, runningEmulator.serial, 60);
    return;
  }

  console.log(`[MoneyMap] Starting Android AVD: ${chosenAvd}...`);

  const emulatorArgs = [
    "-avd",
    chosenAvd,
    "-no-boot-anim",
    "-no-snapshot-save",
  ];

  const child = spawn(emulatorPath, emulatorArgs, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    env: {
      ...process.env,
      ANDROID_HOME: sdk,
      ANDROID_SDK_ROOT: sdk,
    },
  });

  child.unref();

  // Wait a few seconds for adb to see the emulator
  console.log(`[MoneyMap] Emulator process spawned (PID: ${child.pid}). Waiting for ADB connection...`);
  
  let targetSerial = null;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 45000) {
    await new Promise((r) => setTimeout(r, 2000));
    const currentDevices = getConnectedDevices(adbPath);
    const emu = currentDevices.find((d) => d.serial.startsWith("emulator-"));
    if (emu) {
      targetSerial = emu.serial;
      break;
    }
  }

  if (!targetSerial) {
    console.warn("[MoneyMap] Warning: Emulator launched but not yet registered with ADB. Please check the emulator window.");
    return;
  }

  await waitForBoot(adbPath, targetSerial);
}

export function stopEmulator(serialArg) {
  const { adbPath } = getSdkAndTools();
  const devices = getConnectedDevices(adbPath);
  const emulators = devices.filter((d) => d.serial.startsWith("emulator-"));

  if (emulators.length === 0) {
    console.log("[MoneyMap] No running emulators detected.");
    return;
  }

  const targetSerial = serialArg || emulators[0].serial;
  console.log(`[MoneyMap] Stopping emulator (${targetSerial})...`);

  const result = spawnSync(adbPath, ["-s", targetSerial, "emu", "kill"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status === 0 || (result.stdout || "").includes("OK")) {
    console.log(`[MoneyMap] Emulator (${targetSerial}) stopped.`);
  } else {
    console.log(`[MoneyMap] Response: ${result.stdout || result.stderr || "Killed."}`);
  }
}

export function showStatus() {
  const { sdk, adbPath, emulatorPath } = getSdkAndTools();
  console.log("=== MoneyMap Android Status ===");
  console.log(`Android SDK: ${sdk}`);
  console.log(`ADB path:    ${adbPath}`);
  console.log(`Emulator:    ${emulatorPath}`);

  const accel = spawnSync(emulatorPath, ["-accel-check"], { encoding: "utf8" });
  console.log(`Acceleration: ${(accel.stdout || "").trim() || (accel.stderr || "").trim()}`);

  const avds = getAvailableAvds(emulatorPath);
  console.log(`Available AVDs (${avds.length}):`);
  for (const avd of avds) {
    console.log(`  - ${avd}`);
  }

  const devices = getConnectedDevices(adbPath);
  console.log(`Connected ADB devices (${devices.length}):`);
  if (devices.length === 0) {
    console.log("  (none)");
  } else {
    for (const d of devices) {
      console.log(`  - ${d.serial} [${d.state}]`);
    }
  }
}

async function main() {
  const command = process.argv[2] || "status";
  const arg = process.argv[3];

  try {
    switch (command) {
      case "start":
        await startEmulator(arg);
        break;
      case "stop":
        stopEmulator(arg);
        break;
      case "list": {
        const { emulatorPath } = getSdkAndTools();
        const avds = getAvailableAvds(emulatorPath);
        console.log(avds.join("\n"));
        break;
      }
      case "status":
      default:
        showStatus();
        break;
    }
  } catch (error) {
    console.error(`[MoneyMap Error] ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

