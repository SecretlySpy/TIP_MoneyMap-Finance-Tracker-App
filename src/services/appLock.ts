import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const PIN_HASH_KEY = "moneymap.pin.hash.v1";
const PIN_SALT_KEY = "moneymap.pin.salt.v1";
const PIN_PATTERN = /^\d{4}$/;

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasStoredPin(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return hash !== null && hash.length > 0;
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
  const saltBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
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

export async function tryLocalAuthentication(): Promise<"success" | "unavailable" | "failed"> {
  try {
    // Optional native module; absent builds keep PIN-only unlock.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LocalAuthentication = require("expo-local-authentication") as {
      hasHardwareAsync: () => Promise<boolean>;
      isEnrolledAsync: () => Promise<boolean>;
      authenticateAsync: (options: {
        promptMessage: string;
        cancelLabel?: string;
        disableDeviceFallback?: boolean;
      }) => Promise<{ success: boolean }>;
    };
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      return "unavailable";
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock MoneyMap",
      cancelLabel: "Use PIN",
      disableDeviceFallback: true,
    });
    return result.success ? "success" : "failed";
  } catch {
    return "unavailable";
  }
}
