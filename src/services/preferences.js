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
export async function loadPreferencesResult() {
    try {
        const stored = await SecureStore.getItemAsync(PREFERENCES_KEY);
        if (stored === null) {
            return { preferences: DEFAULT_PREFERENCES, status: "missing" };
        }
        try {
            const parsed = JSON.parse(stored);
            if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                return { preferences: DEFAULT_PREFERENCES, status: "invalid" };
            }
            return { preferences: normalizePreferences(parsed), status: "loaded" };
        }
        catch {
            return { preferences: DEFAULT_PREFERENCES, status: "invalid" };
        }
    }
    catch {
        return { preferences: DEFAULT_PREFERENCES, status: "unreadable" };
    }
}
export async function loadPreferences() {
    return (await loadPreferencesResult()).preferences;
}
export async function savePreferences(preferences) {
    const normalized = normalizePreferences(preferences);
    await SecureStore.setItemAsync(PREFERENCES_KEY, JSON.stringify(normalized));
}
