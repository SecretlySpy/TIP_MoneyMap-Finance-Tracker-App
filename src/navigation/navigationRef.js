import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

/**
 * Open Recurring & Reminders from a notification tap (or other deep links).
 */
export function navigateToRecurringReminders() {
  if (!navigationRef.isReady()) {
    return false;
  }
  navigationRef.navigate("Main", {
    screen: "Budgets",
    params: { screen: "Recurring" },
  });
  return true;
}
