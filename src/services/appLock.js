import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const PIN_HASH_KEY = "moneymap.pin.hash.v1";
const PIN_SALT_KEY = "moneymap.pin.salt.v1";
const PIN_RECORD_KEY = "moneymap.pin.record.v2";
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

/**
 * NOTE: App lock PIN is an in-app UI access gate, not the SQLite/SQLCipher encryption key.
 * Ledger encryption is independently managed by databaseKey.js via device hardware keystore.
 */
let lastKnownAttemptState = { failures: 0, lockedUntilEpochMillis: 0 };

async function readAttemptState() {
  try {
    const raw = await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY);
    if (raw === null) {
      return lastKnownAttemptState;
    }
    const parsed = JSON.parse(raw);
    const failures = Number.isSafeInteger(parsed?.failures) && parsed.failures >= 0 ? parsed.failures : lastKnownAttemptState.failures;
    const lockedUntilEpochMillis = Number.isSafeInteger(parsed?.lockedUntilEpochMillis)
      ? Math.max(parsed.lockedUntilEpochMillis, lastKnownAttemptState.lockedUntilEpochMillis)
      : lastKnownAttemptState.lockedUntilEpochMillis;
    lastKnownAttemptState = { failures, lockedUntilEpochMillis };
    return lastKnownAttemptState;
  } catch {
    // Fail closed: retain the highest known lockout rather than resetting to 0 failures
    return lastKnownAttemptState;
  }
}

async function writeAttemptState(state) {
  lastKnownAttemptState = state;
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

/**
 * @typedef {"success" | "cancelled" | "failed" | "unavailable"} RecoveryAuthenticationResult
 */

export function isValidPin(pin) {
  return PIN_PATTERN.test(pin);
}

async function hashPin(pin, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

async function loadPinMaterial() {
  const storedRecord = await SecureStore.getItemAsync(PIN_RECORD_KEY);
  if (storedRecord !== null) {
    try {
      const parsed = JSON.parse(storedRecord);
      if (parsed?.version === 2
        && typeof parsed.salt === "string"
        && parsed.salt.length > 0
        && typeof parsed.hash === "string"
        && parsed.hash.length > 0) {
        return { salt: parsed.salt, hash: parsed.hash };
      }
    } catch {
      // The error below deliberately fails closed for malformed persisted state.
    }
    throw new Error("Stored PIN verification data is invalid.");
  }
  const [salt, hash] = await Promise.all([
    SecureStore.getItemAsync(PIN_SALT_KEY),
    SecureStore.getItemAsync(PIN_HASH_KEY),
  ]);
  if (salt === null && hash === null) {
    return null;
  }
  if (salt === null || hash === null) {
    throw new Error("Stored PIN verification data is incomplete.");
  }
  return { salt, hash };
}

export async function hasStoredPin() {
  const record = await SecureStore.getItemAsync(PIN_RECORD_KEY);
  if (record !== null) {
    return true;
  }
  const [salt, hash] = await Promise.all([
    SecureStore.getItemAsync(PIN_SALT_KEY),
    SecureStore.getItemAsync(PIN_HASH_KEY),
  ]);
  return salt !== null || hash !== null;
}

export async function setPin(pin) {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hash = await hashPin(pin, salt);
  await resetPinAttempts();
  await SecureStore.setItemAsync(PIN_RECORD_KEY, JSON.stringify({ version: 2, salt, hash }));
  await Promise.allSettled([
    SecureStore.deleteItemAsync(PIN_SALT_KEY),
    SecureStore.deleteItemAsync(PIN_HASH_KEY),
  ]);
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await SecureStore.deleteItemAsync(PIN_RECORD_KEY);
  await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY);
  lastKnownAttemptState = { failures: 0, lockedUntilEpochMillis: 0 };
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
  const material = await loadPinMaterial();
  if (material === null) {
    return { ok: false, lockedForSeconds: 0, failures: state.failures };
  }
  const candidate = await hashPin(pin, material.salt);
  if (candidate === material.hash) {
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

const RECOVERY_CANCEL_ERRORS = new Set(["app_cancel", "system_cancel", "user_cancel"]);
const RECOVERY_UNAVAILABLE_ERRORS = new Set([
  "invalid_context",
  "no_space",
  "not_available",
  "not_enrolled",
  "passcode_not_set",
]);

/**
 * Require a higher-assurance system prompt before replacing a forgotten PIN.
 * Device fallback stays enabled so an enrolled device credential can recover
 * access without weakening ordinary PIN or biometric unlock behavior.
 *
 * @returns {Promise<RecoveryAuthenticationResult>}
 */
export async function tryRecoveryAuthentication() {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Verify to reset your MoneyMap PIN",
      promptSubtitle: "MoneyMap recovery",
      promptDescription: "Use your device security to create a replacement app PIN.",
      cancelLabel: "Cancel",
      fallbackLabel: "Use device passcode",
      disableDeviceFallback: false,
      biometricsSecurityLevel: "strong",
    });
    if (result.success) {
      return "success";
    }
    if (RECOVERY_CANCEL_ERRORS.has(result.error)) {
      return "cancelled";
    }
    if (RECOVERY_UNAVAILABLE_ERRORS.has(result.error)) {
      return "unavailable";
    }
    return "failed";
  } catch {
    return "unavailable";
  }
}
