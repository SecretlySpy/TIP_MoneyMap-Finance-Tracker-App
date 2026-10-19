import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { DatabaseGate } from "./components/DatabaseGate";
import { flushPendingNavigation, navigateToRecurringReminders, navigationRef } from "./navigation/navigationRef";
import { RootNavigator } from "./navigation/RootNavigator";
import { useFinanceStore } from "./store/financeStore";
import {
  configureNotificationHandler,
  subscribeReminderNotificationResponses,
} from "./services/notificationScheduler";
import { useUiStore } from "./store/uiStore";
import { defineRecurringCatchUpTask, registerRecurringCatchUpTask } from "./tasks/recurringTask";
import { useTheme } from "./theme/tokens";

defineRecurringCatchUpTask();
void configureNotificationHandler();

export default function MoneyMapRoot() {
  const themePreference = useUiStore((state) => state.themePreference);
  const isLocked = useUiStore((state) => state.isLocked);
  const hasSeenSplash = useUiStore((state) => state.hasSeenSplash);
  const localDataGeneration = useUiStore((state) => state.localDataGeneration);
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
    void registerRecurringCatchUpTask();
  }, []);
  useEffect(() => {
    if (!isLocked && hasSeenSplash) {
      flushPendingNavigation();
    }
  }, [isLocked, hasSeenSplash]);
  useEffect(() => {
    let remove = null;
    void subscribeReminderNotificationResponses(() => {
      navigateToRecurringReminders();
    }).then((subscription) => {
      remove = subscription;
    });
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void useFinanceStore.getState().refresh().catch(() => {});
      }
    });
    return () => {
      remove?.remove?.();
      appStateSub.remove();
    };
  }, []);
  return (
    <DatabaseGate key={localDataGeneration}>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <RootNavigator />
      </NavigationContainer>
    </DatabaseGate>
  );
}
