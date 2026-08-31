import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const PIN_HASH_KEY = "moneymap.pin.hash.v1";
const PIN_SALT_KEY = "moneymap.pin.salt.v1";
const PIN_ATTEMPTS_KEY = "moneymap.pin.attempts.v1";

/** Failures tolerated before the keypad starts locking out. */
export const PIN_FREE_ATTEMPTS = 5;
/** Cooldown ladder (seconds) applied from the 6th consecutive failure onward. */
export const PIN_LOCKOUT_LADDER_SECONDS = [30, 60, 300, 900, 3600];

/**
 * Cooldown for a given consecutive-failure count (pure, unit-testable).
 * @param {number} failures
 * @returns {number} seconds to wait; 0 when no lockout applies
 */
export function pinLockoutSeconds(failures) {
  if (!Number.isFinite(failures) || failures <= PIN_FREE_ATTEMPTS) {
    return 0;
  }
  const step = Math.min(
    failures - PIN_FREE_ATTEMPTS - 1,
    PIN_LOCKOUT_LADDER_SECONDS.length - 1,
  );
  return PIN_LOCKOUT_LADDER_SECONDS[step];
}

async function readAttemptState() {
  try {
    const raw = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
    if (raw === null) {
      return { failures: 0, lockedUntilEpochMillis: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      failures: Number.isSafeInteger(parsed?.failures) && parsed.failures >= 0 ? parsed.failures : 0,
      lockedUntilEpochMillis: Number.isSafeInteger(parsed?.lockedUntilEpochMillis)
        ? parsed.lockedUntilEpochMillis
        : 0,
    };
  } catch {
    return { failures: 0, lockedUntilEpochMillis: 0 };
  }
}

async function writeAttemptState(state) {
  try {
    await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, JSON.stringify(state));
  } catch {
    // A failed write must not brick unlock; worst case the cooldown is not persisted.
  }
}

/**
 * Remaining lockout for the UI. Never throws.
 * @param {number} [now]
 * @returns {Promise<{ failures: number, lockedForSeconds: number }>}
 */
export async function getPinLockoutStatus(now = Date.now()) {
  const state = await readAttemptState();
  const remainingMillis = Math.max(0, state.lockedUntilEpochMillis - now);
  return {
    failures: state.failures,
    lockedForSeconds: Math.ceil(remainingMillis / 1000),
  };
}

export async function resetPinAttempts() {
  await writeAttemptState({ failures: 0, lockedUntilEpochMillis: 0 });
}
const PIN_PATTERN = /^\d{4}$/;

/**
 * @typedef {"success" | "failed" | "unavailable"} BiometricUnlockResult
 */

export function isValidPin(pin) {
  return PIN_PATTERN.test(pin);
}

async function hashPin(pin, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasStoredPin() {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return hash !== null && hash.length > 0;
}

export async function setPin(pin) {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await resetPinAttempts();
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await resetPinAttempts();
}

/**
 * Verify a PIN, enforcing the persisted lockout ladder.
 * @param {string} pin
 * @param {number} [now]
 * @returns {Promise<{ ok: boolean, lockedForSeconds: number, failures: number }>}
 */
export async function verifyPinWithLockout(pin, now = Date.now()) {
  const state = await readAttemptState();
  const remainingMillis = Math.max(0, state.lockedUntilEpochMillis - now);
  if (remainingMillis > 0) {
    return {
      ok: false,
      lockedForSeconds: Math.ceil(remainingMillis / 1000),
      failures: state.failures,
    };
  }
  if (!isValidPin(pin)) {
    return { ok: false, lockedForSeconds: 0, failures: state.failures };
  }
  const [hash, salt] = await Promise.all([
    SecureStore.getItemAsync(PIN_HASH_KEY),
    SecureStore.getItemAsync(PIN_SALT_KEY),
  ]);
  if (hash === null || salt === null) {
    return { ok: false, lockedForSeconds: 0, failures: state.failures };
  }
  const candidate = await hashPin(pin, salt);
  if (candidate === hash) {
    await resetPinAttempts();
    return { ok: true, lockedForSeconds: 0, failures: 0 };
  }
  const failures = state.failures + 1;
  const lockoutSeconds = pinLockoutSeconds(failures);
  await writeAttemptState({
    failures,
    lockedUntilEpochMillis: lockoutSeconds > 0 ? now + lockoutSeconds * 1000 : 0,
  });
  return { ok: false, lockedForSeconds: lockoutSeconds, failures };
}

/**
 * Boolean-only wrapper retained for existing callers and tests.
 * @param {string} pin
 */
export async function verifyPin(pin) {
  const result = await verifyPinWithLockout(pin);
  return result.ok;
}

/**
 * Reports whether biometrics can be offered without prompting the user.
 * Hardware missing or nothing enrolled → unavailable; never throws.
 * @returns {Promise<boolean>}
 */
export async function canUseBiometrics() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return false;
    }
    return LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/**
 * Prompt the system biometric sheet.
 * Missing hardware / enrollment / native errors → "unavailable" (caller falls back to PIN).
 * User cancel / failed match → "failed".
 * @returns {Promise<BiometricUnlockResult>}
 */
export async function tryLocalAuthentication() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return "unavailable";
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      return "unavailable";
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock MoneyMap",
      cancelLabel: "Use PIN",
      disableDeviceFallback: true,
      // Prefer biometrics only; PIN remains the in-app fallback.
      biometricsSecurityLevel: "weak",
    });
    return result.success ? "success" : "failed";
  } catch {
    return "unavailable";
  }
}
