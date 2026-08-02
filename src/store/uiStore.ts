import { AppState, type AppStateStatus } from "react-native";
import { create } from "zustand";

import {
  clearPin,
  hasStoredPin,
  setPin,
  tryLocalAuthentication,
  verifyPin,
} from "../services/appLock";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type AppPreferences,
  type ThemePreference,
} from "../services/preferences";

interface UiState extends AppPreferences {
  readonly hasPin: boolean;
  readonly isLocked: boolean;
  readonly preferencesReady: boolean;
  readonly clearStoredPin: () => Promise<void>;
  readonly ensurePreferencesLoaded: () => Promise<void>;
  readonly lockNow: () => void;
  readonly setAppLockEnabled: (enabled: boolean) => Promise<void>;
  readonly setCurrencySymbol: (symbol: string) => Promise<void>;
  readonly setRemindersEnabled: (enabled: boolean) => Promise<void>;
  readonly setSmartTipsEnabled: (enabled: boolean) => Promise<void>;
  readonly setThemePreference: (theme: ThemePreference) => Promise<void>;
  readonly setupPin: (pin: string) => Promise<void>;
  readonly unlockWithBiometrics: () => Promise<"success" | "unavailable" | "failed">;
  readonly unlockWithPin: (pin: string) => Promise<boolean>;
}

let preferencesPromise: Promise<void> | null = null;
let appStateSubscriptionAttached = false;

function preferencesFromState(state: UiState): AppPreferences {
  return {
    appLockEnabled: state.appLockEnabled,
    currencySymbol: state.currencySymbol,
    remindersEnabled: state.remindersEnabled,
    smartTipsEnabled: state.smartTipsEnabled,
    themePreference: state.themePreference,
  };
}

async function persist(state: UiState): Promise<void> {
  await savePreferences(preferencesFromState(state));
}

export const useUiStore = create<UiState>((set, get) => ({
  ...DEFAULT_PREFERENCES,
  hasPin: false,
  isLocked: false,
  preferencesReady: false,

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
      if (!appStateSubscriptionAttached) {
        appStateSubscriptionAttached = true;
        let previous: AppStateStatus = AppState.currentState;
        AppState.addEventListener("change", (next) => {
          if (
            (previous === "active" && next.match(/inactive|background/)) ||
            next === "background"
          ) {
            const current = get();
            if (current.appLockEnabled && current.hasPin) {
              set({ isLocked: true });
            }
          }
          previous = next;
        });
      }
    })();
    try {
      await preferencesPromise;
    } finally {
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
    } else {
      set({ appLockEnabled: false, isLocked: false });
    }
    await persist(get());
  },

  setRemindersEnabled: async (enabled) => {
    set({ remindersEnabled: enabled });
    await persist(get());
  },

  setSmartTipsEnabled: async (enabled) => {
    set({ smartTipsEnabled: enabled });
    await persist(get());
  },

  setCurrencySymbol: async (symbol) => {
    const next = symbol.trim().slice(0, 4) || "₱";
    set({ currencySymbol: next });
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
