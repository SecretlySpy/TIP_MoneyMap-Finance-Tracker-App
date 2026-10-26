import "./global.css";
import { Roboto_400Regular } from "@expo-google-fonts/roboto/400Regular";
import { Roboto_500Medium } from "@expo-google-fonts/roboto/500Medium";
import { Roboto_700Bold } from "@expo-google-fonts/roboto/700Bold";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { lazy, Suspense, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { isExpoGoRuntime } from "./src/runtime/expoGo";
import { ExpoGoUnsupportedScreen } from "./src/screens/ExpoGoUnsupportedScreen";
import { registerAiAppCheckProvider } from "./src/remote/aiProxyClient";

void SplashScreen.preventAutoHideAsync();

const MoneyMapRoot = lazy(() => import("./src/MoneyMapRoot"));

registerAiAppCheckProvider(async (forceRefresh = false) => {
  const { getMoneyMapAppCheckToken } =
    await import("./src/remote/firebaseAppCheck");

  return getMoneyMapAppCheckToken(forceRefresh);
});

if (__DEV__) {
  void import("./src/remote/firebaseAppCheck")
    .then(({ getMoneyMapAppCheckToken }) => getMoneyMapAppCheckToken())
    .catch(() => {});
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  const expoGo = isExpoGoRuntime();

  useEffect(() => {
    if (expoGo || fontsLoaded || fontError !== null) {
      void SplashScreen.hideAsync();
    }
  }, [expoGo, fontError, fontsLoaded]);

  if (expoGo) {
    return (
      <SafeAreaProvider>
        <ExpoGoUnsupportedScreen />
      </SafeAreaProvider>
    );
  }

  if (!fontsLoaded && fontError === null) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Suspense fallback={null}>
        <MoneyMapRoot />
      </Suspense>
    </SafeAreaProvider>
  );
}
