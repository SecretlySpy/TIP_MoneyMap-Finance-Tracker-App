/**
 * Firebase App Check token provider for remote fetch requests.
 * Uses React Native Firebase v27 modular API.
 */
import { getApp } from "@react-native-firebase/app";
import {
  ReactNativeFirebaseAppCheckProvider,
  initializeAppCheck,
  getToken,
} from "@react-native-firebase/app-check";

let appCheckPromise = null;

/**
 * Initializes the Firebase App Check instance once per application lifecycle.
 * Uses the Debug provider in __DEV__ and Play Integrity in production.
 * @returns {Promise<object>} The initialized App Check instance
 */
export async function initializeMoneyMapAppCheck() {
  if (!appCheckPromise) {
    appCheckPromise = (async () => {
      const provider = new ReactNativeFirebaseAppCheckProvider();

      const debugToken =
        typeof process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN === "string" &&
        process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN.trim().length > 0
          ? process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN.trim()
          : undefined;

      const androidConfig = {
        provider: __DEV__ ? "debug" : "playIntegrity",
        ...(debugToken ? { debugToken } : {}),
      };

      provider.configure({
        android: androidConfig,
      });

      return initializeAppCheck(getApp(), {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
    })().catch((error) => {
      appCheckPromise = null;
      throw error;
    });
  }

  return appCheckPromise;
}

/**
 * Obtains an App Check token for authenticating remote requests.
 * Supports token refresh and controlled retry.
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<string>}
 */
export async function getMoneyMapAppCheckToken(forceRefresh = false) {
  const appCheck = await initializeMoneyMapAppCheck();
  try {
    const { token } = await getToken(appCheck, Boolean(forceRefresh));
    if (typeof token !== "string" || token.length < 16) {
      throw new Error("Invalid token acquired from App Check");
    }
    return token;
  } catch (error) {
    if (!forceRefresh) {
      try {
        const { token } = await getToken(appCheck, true);
        if (typeof token === "string" && token.length >= 16) {
          return token;
        }
      } catch {
        // Fall through to throw original error
      }
    }
    throw error;
  }
}

/**
 * Resets the cached App Check initialization promise for testing and error recovery.
 */
export function resetAppCheckInstance() {
  appCheckPromise = null;
}
