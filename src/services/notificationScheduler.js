import { Platform } from "react-native";
import {
  buildReminderNotificationPlan,
  REMINDER_NOTIFICATION_PREFIX,
} from "./reminders";

/**
 * @typedef {Object} NotificationPermissionSnapshot
 * @property {boolean} granted
 * @property {boolean} canAskAgain
 * @property {'granted'|'denied'|'undetermined'|'unavailable'} status
 */

/**
 * @typedef {Object} SyncRemindersResult
 * @property {number} scheduled
 * @property {number} cancelled
 * @property {boolean} permissionGranted
 * @property {boolean} permissionDenied
 * @property {string | null} errorMessage
 */

let notificationsModulePromise = null;

async function loadNotifications() {
  if (notificationsModulePromise !== null) {
    return notificationsModulePromise;
  }
  notificationsModulePromise = import("expo-notifications")
    .then((mod) => mod)
    .catch(() => null);
  return notificationsModulePromise;
}

/**
 * Allow foreground presentation of local reminders (no sound spam).
 */
export async function configureNotificationHandler() {
  const Notifications = await loadNotifications();
  if (Notifications === null) {
    return false;
  }
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureAndroidChannel(Notifications) {
  if (Platform.OS !== "android") {
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync("moneymap-reminders", {
      name: "Bill reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: "#2563EB",
    });
  } catch {
    // Channel APIs are Android-only; ignore on mismatched runtimes.
  }
}

/**
 * Read notification permission without prompting.
 * @returns {Promise<NotificationPermissionSnapshot>}
 */
export async function getReminderPermissionStatus() {
  const Notifications = await loadNotifications();
  if (Notifications === null) {
    return { granted: false, canAskAgain: false, status: "unavailable" };
  }
  try {
    const settings = await Notifications.getPermissionsAsync();
    const granted = settings.granted === true
      || settings.ios?.status === Notifications.IosAuthorizationStatus?.AUTHORIZED
      || settings.ios?.status === Notifications.IosAuthorizationStatus?.PROVISIONAL;
    return {
      granted,
      canAskAgain: settings.canAskAgain !== false,
      status: granted ? "granted" : settings.canAskAgain === false ? "denied" : "undetermined",
    };
  } catch {
    return { granted: false, canAskAgain: false, status: "unavailable" };
  }
}

/**
 * Request POST_NOTIFICATIONS / notification permission. Call only when the user enables reminders.
 * @returns {Promise<NotificationPermissionSnapshot>}
 */
export async function requestReminderPermission() {
  const Notifications = await loadNotifications();
  if (Notifications === null) {
    return { granted: false, canAskAgain: false, status: "unavailable" };
  }
  try {
    await ensureAndroidChannel(Notifications);
    const settings = await Notifications.requestPermissionsAsync();
    const granted = settings.granted === true
      || settings.ios?.status === Notifications.IosAuthorizationStatus?.AUTHORIZED
      || settings.ios?.status === Notifications.IosAuthorizationStatus?.PROVISIONAL;
    return {
      granted,
      canAskAgain: settings.canAskAgain !== false,
      status: granted ? "granted" : settings.canAskAgain === false ? "denied" : "undetermined",
    };
  } catch {
    return { granted: false, canAskAgain: false, status: "unavailable" };
  }
}

async function cancelMoneyMapReminders(Notifications) {
  let cancelled = 0;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      const id = item.identifier ?? item.content?.data?.identifier;
      if (typeof id === "string" && id.startsWith(REMINDER_NOTIFICATION_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(id);
        cancelled += 1;
      }
    }
  } catch {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // Non-fatal: UI remains usable without OS schedules.
    }
  }
  return cancelled;
}

/**
 * Cancel existing MoneyMap reminder schedules and rebuild from rules when enabled + permitted.
 *
 * @param {{
 *   rules: Array<object>,
 *   categoriesById: Map<number, object>,
 *   remindersEnabled: boolean,
 *   currencySymbol?: string,
 *   nowEpochMillis?: number,
 *   requestPermissionIfNeeded?: boolean,
 * }} input
 * @returns {Promise<SyncRemindersResult>}
 */
export async function syncBillReminderNotifications(input) {
  const Notifications = await loadNotifications();
  if (Notifications === null) {
    return {
      scheduled: 0,
      cancelled: 0,
      permissionGranted: false,
      permissionDenied: input.remindersEnabled,
      errorMessage: input.remindersEnabled ? "Notifications are unavailable in this build." : null,
    };
  }

  try {
    await configureNotificationHandler();
    await ensureAndroidChannel(Notifications);
    const cancelled = await cancelMoneyMapReminders(Notifications);

    if (!input.remindersEnabled) {
      return {
        scheduled: 0,
        cancelled,
        permissionGranted: false,
        permissionDenied: false,
        errorMessage: null,
      };
    }

    let permission = await getReminderPermissionStatus();
    if (!permission.granted && input.requestPermissionIfNeeded) {
      permission = await requestReminderPermission();
    }

    if (!permission.granted) {
      return {
        scheduled: 0,
        cancelled,
        permissionGranted: false,
        permissionDenied: true,
        errorMessage: "Notification permission is off. Enable it in system settings to get bill alerts.",
      };
    }

    const plan = buildReminderNotificationPlan(input.rules, input.categoriesById, {
      nowEpochMillis: input.nowEpochMillis,
      currencySymbol: input.currencySymbol,
      remindersEnabled: true,
    });

    let scheduled = 0;
    for (const item of plan) {
      const trigger = item.triggerMode === "date"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(item.fireAtEpochMillis),
            channelId: "moneymap-reminders",
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 2,
            channelId: "moneymap-reminders",
          };

      await Notifications.scheduleNotificationAsync({
        identifier: item.identifier,
        content: {
          title: item.title,
          body: item.body,
          data: item.data,
          sound: false,
        },
        trigger,
      });
      scheduled += 1;
    }

    return {
      scheduled,
      cancelled,
      permissionGranted: true,
      permissionDenied: false,
      errorMessage: null,
    };
  } catch (error) {
    return {
      scheduled: 0,
      cancelled: 0,
      permissionGranted: false,
      permissionDenied: false,
      errorMessage: error instanceof Error ? error.message : "Could not schedule reminders.",
    };
  }
}

/**
 * @param {(payload: { screen?: string, ruleId?: number }) => void} onOpen
 * @returns {Promise<{ remove: () => void } | null>}
 */
export async function subscribeReminderNotificationResponses(onOpen) {
  const Notifications = await loadNotifications();
  if (Notifications === null) {
    return null;
  }
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data ?? {};
      if (data?.moneymap && data?.screen === "Recurring") {
        onOpen({ screen: "Recurring", ruleId: typeof data.ruleId === "number" ? data.ruleId : undefined });
      }
    });
    return subscription;
  } catch {
    return null;
  }
}
