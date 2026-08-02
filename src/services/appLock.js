import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const PIN_HASH_KEY = "moneymap.pin.hash.v1";
const PIN_SALT_KEY = "moneymap.pin.salt.v1";
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
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
}

export async function verifyPin(pin) {
  if (!isValidPin(pin)) {
    return false;
  }
  const [hash, salt] = await Promise.all([
    SecureStore.getItemAsync(PIN_HASH_KEY),
    SecureStore.getItemAsync(PIN_SALT_KEY),
  ]);
  if (hash === null || salt === null) {
    return false;
  }
  const candidate = await hashPin(pin, salt);
  return candidate === hash;
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
