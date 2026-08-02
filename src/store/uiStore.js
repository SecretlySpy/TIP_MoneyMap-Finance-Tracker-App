import { AppState } from "react-native";
import { create } from "zustand";
import { clearPin, hasStoredPin, setPin, tryLocalAuthentication, verifyPin, } from "../services/appLock";
import { getReminderPermissionStatus, syncBillReminderNotifications, } from "../services/notificationScheduler";
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, } from "../services/preferences";
let preferencesPromise = null;
let appStateSubscriptionAttached = false;
/** Optional finance snapshot supplier registered by financeStore to avoid a circular import. */
let financeSnapshotProvider = null;
export function registerFinanceSnapshotProvider(provider) {
    financeSnapshotProvider = provider;
}
function preferencesFromState(state) {
    return {
        appLockEnabled: state.appLockEnabled,
        currencySymbol: state.currencySymbol,
        remindersEnabled: state.remindersEnabled,
        smartTipsEnabled: state.smartTipsEnabled,
        themePreference: state.themePreference,
    };
}
async function persist(state) {
    await savePreferences(preferencesFromState(state));
}
/**
 * Rebuild OS local notifications from the current finance + preference snapshot.
 * @param {{ requestPermissionIfNeeded?: boolean }} [options]
 */
export async function syncRemindersFromStores(options = {}) {
    const ui = useUiStore.getState();
    const snapshot = financeSnapshotProvider ? financeSnapshotProvider() : null;
    const rules = snapshot?.recurringRules ?? [];
    const categoriesById = new Map((snapshot?.categories ?? []).map((category) => [category.id, category]));
    const result = await syncBillReminderNotifications({
        rules,
        categoriesById,
        remindersEnabled: ui.remindersEnabled,
        currencySymbol: ui.currencySymbol,
        requestPermissionIfNeeded: options.requestPermissionIfNeeded === true,
    });
    useUiStore.setState({
        notificationPermissionDenied: result.permissionDenied,
        notificationHint: result.errorMessage,
    });
    return result;
}
export const useUiStore = create((set, get) => ({
    ...DEFAULT_PREFERENCES,
    hasPin: false,
    isLocked: false,
    preferencesReady: false,
    notificationPermissionDenied: false,
    notificationHint: null,
    ensurePreferencesLoaded: async () => {
        if (get().preferencesReady) {
            return;
        }
        if (preferencesPromise !== null) {
            await preferencesPromise;
            return;
        }
        preferencesPromise = (async () => {
            const preferences = await loadPreferences();
            const pinExists = await hasStoredPin();
            set({
                ...preferences,
                hasPin: pinExists,
                isLocked: preferences.appLockEnabled && pinExists,
                preferencesReady: true,
            });
            if (preferences.remindersEnabled) {
                const permission = await getReminderPermissionStatus();
                set({
                    notificationPermissionDenied: !permission.granted && permission.status !== "undetermined",
                    notificationHint: !permission.granted && permission.status !== "undetermined"
                        ? "Notification permission is off. Enable it in system settings to get bill alerts."
                        : null,
                });
                // Cold start: schedule if already permitted; never prompt here.
                void syncRemindersFromStores({ requestPermissionIfNeeded: false });
            }
            if (!appStateSubscriptionAttached) {
                appStateSubscriptionAttached = true;
                // Lock only on true backgrounding. Android "inactive" fires for share sheets and
                // system dialogs and must not force the PIN gate mid-action.
                AppState.addEventListener("change", (next) => {
                    if (next !== "background") {
                        return;
                    }
                    const current = get();
                    if (current.appLockEnabled && current.hasPin && !current.isLocked) {
                        set({ isLocked: true });
                    }
                });
            }
        })();
        try {
            await preferencesPromise;
        }
        finally {
            preferencesPromise = null;
        }
    },
    lockNow: () => {
        const current = get();
        if (current.appLockEnabled && current.hasPin) {
            set({ isLocked: true });
        }
    },
    setAppLockEnabled: async (enabled) => {
        if (enabled) {
            const pinExists = await hasStoredPin();
            set({ appLockEnabled: true, hasPin: pinExists, isLocked: pinExists });
        }
        else {
            set({ appLockEnabled: false, isLocked: false });
        }
        await persist(get());
    },
    setRemindersEnabled: async (enabled) => {
        set({ remindersEnabled: enabled, notificationHint: null });
        await persist(get());
        // Prompt only when the user turns reminders on — never on cold start.
        await syncRemindersFromStores({ requestPermissionIfNeeded: enabled });
    },
    setCurrencySymbol: async (symbol) => {
        const next = symbol.trim().slice(0, 4) || "₱";
        set({ currencySymbol: next });
        await persist(get());
        if (get().remindersEnabled) {
            void syncRemindersFromStores({ requestPermissionIfNeeded: false });
        }
    },
    setSmartTipsEnabled: async (enabled) => {
        set({ smartTipsEnabled: enabled });
        await persist(get());
    },
    setThemePreference: async (theme) => {
        set({ themePreference: theme });
        await persist(get());
    },
    setupPin: async (pin) => {
        await setPin(pin);
        set({ hasPin: true, appLockEnabled: true, isLocked: false });
        await persist(get());
    },
    clearStoredPin: async () => {
        await clearPin();
        set({ hasPin: false, appLockEnabled: false, isLocked: false });
        await persist(get());
    },
    unlockWithPin: async (pin) => {
        const ok = await verifyPin(pin);
        if (ok) {
            set({ isLocked: false });
        }
        return ok;
    },
    unlockWithBiometrics: async () => {
        const result = await tryLocalAuthentication();
        if (result === "success") {
            set({ isLocked: false });
        }
        return result;
    },
}));
