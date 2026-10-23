/**
 * Firebase App Check token provider for remote fetch requests.
 */
import { getApp } from "@react-native-firebase/app";
import {
  ReactNativeFirebaseAppCheckProvider,
  initializeAppCheck,
  getToken,
} from "@react-native-firebase/app-check";

let appCheckPromise = null;

export async function getMoneyMapAppCheckToken() {
  if (!appCheckPromise) {
    appCheckPromise = (async () => {
      const provider =
        new ReactNativeFirebaseAppCheckProvider();

      provider.configure({
        android: {
          provider: __DEV__ ? "debug" : "playIntegrity",
        },
      });

      return initializeAppCheck(getApp(), {
        provider,
        isTokenAutoRefreshEnabled: false,
      });
    })().catch((error) => {
      appCheckPromise = null;
      throw error;
    });
  }

  const appCheck = await appCheckPromise;
  const { token } = await getToken(appCheck);

  return token;
}
