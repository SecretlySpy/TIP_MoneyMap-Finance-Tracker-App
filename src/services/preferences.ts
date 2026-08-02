import * as SecureStore from "expo-secure-store";

export type ThemePreference = "system" | "light" | "dark";

export interface AppPreferences {
  readonly appLockEnabled: boolean;
  readonly currencySymbol: string;
  readonly remindersEnabled: boolean;
  readonly smartTipsEnabled: boolean;
  readonly themePreference: ThemePreference;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  appLockEnabled: false,
  currencySymbol: "₱",
  remindersEnabled: true,
  smartTipsEnabled: true,
  themePreference: "system",
};

const PREFERENCES_KEY = "moneymap.preferences.v1";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function normalizePreferences(raw: unknown): AppPreferences {
  if (raw === null || typeof raw !== "object") {
    return DEFAULT_PREFERENCES;
  }
  const record = raw as Record<string, unknown>;
  return {
    appLockEnabled: record.appLockEnabled === true,
    currencySymbol:
      typeof record.currencySymbol === "string" && record.currencySymbol.trim().length > 0
        ? record.currencySymbol.trim().slice(0, 4)
        : DEFAULT_PREFERENCES.currencySymbol,
    remindersEnabled: record.remindersEnabled !== false,
    smartTipsEnabled: record.smartTipsEnabled !== false,
    themePreference: isThemePreference(record.themePreference)
      ? record.themePreference
      : DEFAULT_PREFERENCES.themePreference,
  };
}

export async function loadPreferences(): Promise<AppPreferences> {
  try {
    const stored = await SecureStore.getItemAsync(PREFERENCES_KEY);
    if (stored === null) {
      return DEFAULT_PREFERENCES;
    }
    return normalizePreferences(JSON.parse(stored) as unknown);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  const normalized = normalizePreferences(preferences);
  await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(normalized));
}
