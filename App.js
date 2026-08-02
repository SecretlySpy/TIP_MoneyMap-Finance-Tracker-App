import "./global.css";
import { Roboto_400Regular } from "@expo-google-fonts/roboto/400Regular";
import { Roboto_500Medium } from "@expo-google-fonts/roboto/500Medium";
import { Roboto_700Bold } from "@expo-google-fonts/roboto/700Bold";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DatabaseGate } from "./src/components/DatabaseGate";
import { navigateToRecurringReminders, navigationRef } from "./src/navigation/navigationRef";
import { RootNavigator } from "./src/navigation/RootNavigator";
import {
    configureNotificationHandler,
    subscribeReminderNotificationResponses,
} from "./src/services/notificationScheduler";
import { useUiStore } from "./src/store/uiStore";
import { defineRecurringCatchUpTask, registerRecurringCatchUpTask } from "./src/tasks/recurringTask";
import { useTheme } from "./src/theme/tokens";
// Keep the native launch surface visible until the three bundled Roboto weights are ready.
void SplashScreen.preventAutoHideAsync();
// Background catch-up must be defined at module scope before registration.
defineRecurringCatchUpTask();
void configureNotificationHandler();
function MoneyMapApp() {
    const themePreference = useUiStore((state) => state.themePreference);
    const theme = useTheme(themePreference);
    const baseNavigationTheme = theme.mode === "dark" ? DarkTheme : DefaultTheme;
    const navigationTheme = {
        ...baseNavigationTheme,
        colors: {
            ...baseNavigationTheme.colors,
            background: theme.colors.bg,
            border: theme.colors.outline,
            card: theme.colors.surface,
            notification: theme.colors.expense,
            primary: theme.colors.primary,
            text: theme.colors.text,
        },
    };
    useEffect(() => {
        let remove = null;
        void subscribeReminderNotificationResponses(() => {
            navigateToRecurringReminders();
        }).then((subscription) => {
            remove = subscription;
        });
        return () => {
            remove?.remove?.();
        };
    }, []);
    return (<DatabaseGate>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"}/>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseGate>);
}
// Font assets are bundled locally so the approved Roboto weights never need a network call.
export default function App() {
    const [fontsLoaded, fontError] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
    // A missing font must not trap the user on the launch surface; the system font is a safe fallback.
    useEffect(() => {
        if (fontsLoaded || fontError !== null) {
            void SplashScreen.hideAsync();
        }
    }, [fontError, fontsLoaded]);
    useEffect(() => {
        void registerRecurringCatchUpTask();
    }, []);
    if (!fontsLoaded && fontError === null) {
        return null;
    }
    return (<SafeAreaProvider>
      <MoneyMapApp />
    </SafeAreaProvider>);
}
