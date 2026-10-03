import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";
import { create } from "zustand";
import { clearPin, getPinLockoutStatus, hasStoredPin, setPin, tryLocalAuthentication, verifyPinWithLockout, } from "../services/appLock";
import { getReminderPermissionStatus, syncBillReminderNotifications, } from "../services/notificationScheduler";
import { clearOnboardingDraft, createOnboardingDraft, loadOnboardingDraftResult, saveOnboardingDraft, } from "../services/onboarding";
import { DEFAULT_PREFERENCES, loadPreferencesResult, savePreferences, } from "../services/preferences";
let preferencesPromise = null;
let onboardingWriteQueue = Promise.resolve();
let appStateSubscriptionAttached = false;
const SPLASH_SEEN_KEY = "moneymap.splash.seen.v1";
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
        smartTipsConsentAccepted: state.smartTipsConsentAccepted,
        themePreference: state.themePreference,
    };
}
async function persist(state) {
    await savePreferences(preferencesFromState(state));
}
export function shouldFailClosedPreferenceLoad(preferenceStatus, pinExists) {
    return pinExists && preferenceStatus !== "loaded";
}
// Serialize draft writes so rapid form edits cannot finish out of order and revive stale input.
function queueOnboardingWrite(operation) {
    const pending = onboardingWriteQueue.catch(() => undefined).then(operation);
    onboardingWriteQueue = pending;
    return pending;
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
    hasSeenSplash: false,
    isLocked: false,
    onboardingDraft: null,
    onboardingLoadError: null,
    onboardingDraftInvalid: false,
    splashReadError: null,
    preferenceLoadError: null,
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
            const [preferenceResult, pinResult, splashResult, onboardingResult] = await Promise.all([
                loadPreferencesResult(),
                hasStoredPin()
                    .then((exists) => ({ exists, status: "loaded" }))
                    .catch(() => ({ exists: false, status: "unreadable" })),
                SecureStore.getItemAsync(SPLASH_SEEN_KEY)
                    .then((value) => ({ value, status: "loaded" }))
                    .catch(() => ({ value: null, status: "unreadable" })),
                loadOnboardingDraftResult(),
            ]);
            const preferences = preferenceResult.preferences;
            const pinStateUnreadable = pinResult.status === "unreadable";
            const failClosedForPinState = pinStateUnreadable
                && (preferences.appLockEnabled || preferenceResult.status !== "loaded");
            const pinExists = pinResult.exists || failClosedForPinState;
            const failClosed = shouldFailClosedPreferenceLoad(preferenceResult.status, pinExists)
                || failClosedForPinState;
            const firstRun = splashResult.value !== "true";
            set({
                ...preferences,
                hasPin: pinExists,
                hasSeenSplash: splashResult.value === "true",
                isLocked: (preferences.appLockEnabled && pinExists) || failClosed,
                onboardingDraft: firstRun && onboardingResult.status === "loaded"
                    ? onboardingResult.draft
                    : null,
                onboardingLoadError: firstRun && onboardingResult.status === "unreadable"
                    ? "Saved setup progress could not be read. Try again before starting so it is not overwritten."
                    : firstRun && onboardingResult.status === "invalid"
                        ? "Saved setup progress is damaged or from a newer version. It has not been deleted."
                        : null,
                onboardingDraftInvalid: firstRun && onboardingResult.status === "invalid",
                splashReadError: splashResult.status === "unreadable"
                    ? "Saved app start state could not be read. Retry before starting setup."
                    : null,
                preferenceLoadError: pinStateUnreadable && failClosed
                    ? "Secure app-lock data could not be read. Retry when device secure storage is available."
                    : failClosed
                        ? "App preferences could not be verified. Unlock with your stored PIN to restore secure defaults."
                        : null,
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
    setHasSeenSplash: async (seen) => {
        await SecureStore.setItemAsync(SPLASH_SEEN_KEY, seen ? "true" : "false");
        set({ hasSeenSplash: seen, splashReadError: null });
    },
    beginOnboarding: async () => {
        if (get().splashReadError !== null) {
            let seen;
            try {
                seen = await SecureStore.getItemAsync(SPLASH_SEEN_KEY);
            }
            catch {
                throw new Error("Saved app start state is still unavailable. No setup draft was written.");
            }
            if (seen === "true") {
                set({ hasSeenSplash: true, splashReadError: null });
                return null;
            }
            set({ splashReadError: null });
        }
        const existing = get().onboardingDraft;
        if (existing !== null) {
            return existing;
        }
        if (get().onboardingLoadError !== null) {
            const result = await loadOnboardingDraftResult();
            if (result.status === "unreadable" || result.status === "invalid") {
                throw new Error(result.status === "invalid"
                    ? "Saved setup progress cannot be resumed. Discard it explicitly before starting again."
                    : "Saved setup progress is still unavailable. No new draft was written.");
            }
            if (result.status === "loaded" && result.draft !== null) {
                set({ onboardingDraft: result.draft, onboardingLoadError: null, onboardingDraftInvalid: false });
                return result.draft;
            }
            set({ onboardingLoadError: null, onboardingDraftInvalid: false });
        }
        const draft = createOnboardingDraft();
        const saved = await queueOnboardingWrite(() => saveOnboardingDraft(draft));
        set({ onboardingDraft: saved, onboardingLoadError: null, onboardingDraftInvalid: false });
        return saved;
    },
    discardInvalidOnboardingDraft: async () => {
        await queueOnboardingWrite(async () => {
            const result = await loadOnboardingDraftResult();
            if (result.status === "unreadable") {
                throw new Error("Saved setup progress is still unavailable. Nothing was deleted.");
            }
            if (result.status === "loaded" && result.draft !== null) {
                set({ onboardingDraft: result.draft, onboardingLoadError: null, onboardingDraftInvalid: false });
                return;
            }
            if (result.status === "invalid") {
                await clearOnboardingDraft();
            }
            set({ onboardingLoadError: null, onboardingDraftInvalid: false });
        });
    },
    saveOnboardingProgress: async (draft) => {
        const saved = await queueOnboardingWrite(() => saveOnboardingDraft(draft));
        set({ onboardingDraft: saved });
        return saved;
    },
    completeOnboarding: async () => {
        await onboardingWriteQueue;
        await SecureStore.setItemAsync(SPLASH_SEEN_KEY, "true");
        set({ hasSeenSplash: true, onboardingDraft: null, onboardingLoadError: null, onboardingDraftInvalid: false, splashReadError: null });
        // The completion marker is authoritative; a failed cleanup cannot roll it back.
        await queueOnboardingWrite(() => clearOnboardingDraft()).catch(() => undefined);
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
        if (!enabled) {
            set({ smartTipsEnabled: false });
            await persist(get());
            return;
        }
        set({ smartTipsEnabled: true });
        await persist(get());
    },
    acceptSmartTipsConsent: async () => {
        set({ smartTipsConsentAccepted: true, smartTipsEnabled: true });
        await persist(get());
    },
    declineSmartTipsConsent: async () => {
        set({ smartTipsConsentAccepted: false, smartTipsEnabled: false });
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
        const result = await verifyPinWithLockout(pin);
        if (result.ok) {
            const recoveringPreferences = get().preferenceLoadError !== null;
            set({
                appLockEnabled: recoveringPreferences ? true : get().appLockEnabled,
                isLocked: false,
                preferenceLoadError: null,
            });
            if (recoveringPreferences) {
                // Unlock the current session even if SecureStore is still unavailable; the
                // app remains configured to re-lock on background and on the next cold start.
                await persist(get()).catch(() => {
                    set({ preferenceLoadError: "Secure app-lock preferences could not be rewritten. The next launch will require your PIN again." });
                });
            }
        }
        return result;
    },
    readPinLockout: async () => getPinLockoutStatus(),
    unlockWithBiometrics: async () => {
        const result = await tryLocalAuthentication();
        if (result === "success") {
            const recoveringPreferences = get().preferenceLoadError !== null;
            set({
                appLockEnabled: recoveringPreferences ? true : get().appLockEnabled,
                isLocked: false,
                preferenceLoadError: null,
            });
            if (recoveringPreferences) {
                // A verified biometric unlock restores the same fail-closed defaults as PIN
                // recovery, including background relocking for the current session.
                await persist(get()).catch(() => {
                    set({ preferenceLoadError: "Secure app-lock preferences could not be rewritten. The next launch will require authentication again." });
                });
            }
        }
        return result;
    },
}));
