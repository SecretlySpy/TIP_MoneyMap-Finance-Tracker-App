import { createNavigationContainerRef } from "@react-navigation/native";
import { useUiStore } from "../store/uiStore";

export const navigationRef = createNavigationContainerRef();

let pendingNavigation = null;

export function queueNavigation(target) {
  pendingNavigation = target;
}

export function flushPendingNavigation() {
  if (pendingNavigation && navigationRef.isReady()) {
    const target = pendingNavigation;
    pendingNavigation = null;
    navigationRef.navigate(target.name, target.params);
    return true;
  }
  return false;
}

/**
 * Open Recurring & Reminders from a notification tap (or other deep links).
 */
export function navigateToRecurringReminders() {
  const ui = useUiStore?.getState?.();
  const target = {
    name: "Main",
    params: {
      screen: "Budgets",
      params: { screen: "Recurring" },
    },
  };
  if (ui && (ui.isLocked || !ui.hasSeenSplash)) {
    queueNavigation(target);
    return false;
  }
  if (!navigationRef.isReady()) {
    queueNavigation(target);
    return false;
  }
  navigationRef.navigate(target.name, target.params);
  return true;
}
