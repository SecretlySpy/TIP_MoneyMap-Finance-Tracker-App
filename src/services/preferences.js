import * as SecureStore from "expo-secure-store";
export const DEFAULT_PREFERENCES = {
    appLockEnabled: false,
    currencySymbol: "₱",
    remindersEnabled: true,
    // Spec default OFF — user must opt in (FR-10).
    smartTipsEnabled: false,
    smartTipsConsentAccepted: false,
    themePreference: "system",
};
const PREFERENCES_KEY = "moneymap.preferences.v1";
function isThemePreference(value) {
    return value === "system" || value === "light" || value === "dark";
}
export function normalizePreferences(raw) {
    if (raw === null || typeof raw !== "object") {
        return DEFAULT_PREFERENCES;
    }
    const record = raw;
    return {
        appLockEnabled: record.appLockEnabled === true,
        currencySymbol: typeof record.currencySymbol === "string" && record.currencySymbol.trim().length > 0
            ? record.currencySymbol.trim().slice(0, 4)
            : DEFAULT_PREFERENCES.currencySymbol,
        remindersEnabled: record.remindersEnabled !== false,
        smartTipsEnabled: record.smartTipsEnabled === true,
        smartTipsConsentAccepted: record.smartTipsConsentAccepted === true,
        themePreference: isThemePreference(record.themePreference)
            ? record.themePreference
            : DEFAULT_PREFERENCES.themePreference,
    };
}
export async function loadPreferences() {
    try {
        const stored = await SecureStore.getItemAsync(PREFERENCES_KEY);
        if (stored === null) {
            return DEFAULT_PREFERENCES;
        }
        return normalizePreferences(JSON.parse(stored));
    }
    catch {
        return DEFAULT_PREFERENCES;
    }
}
export async function savePreferences(preferences) {
    const normalized = normalizePreferences(preferences);
    await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(normalized));
}
