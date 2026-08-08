import { useColorScheme } from "react-native";
import { useUiStore } from "../store/uiStore";
// The palette mirrors the approved Figma variables so screens never own colors.
export const palettes = {
    light: {
        bg: "#F7F9F8",
        surface: "#FFFFFF",
        primary: "#0F6E5C",
        deepPrimary: "#0F6E5C",
        onPrimary: "#FFFFFF",
        onAccent: "#FFFFFF",
        text: "#1A1C1B",
        sub: "#6B7572",
        income: "#1E9E6A",
        expense: "#D64545",
        warning: "#E8A13D",
        tint: "#D7F2EA",
        outline: "#E2E8E5",
        track: "#E9EEEB",
        avatarBg: "#EFF4F2",
        chartBlue: "#4A90D9",
        chartGray: "#C9D4CF",
        amberBg: "#FEF1DB",
        amberText: "#C88A28",
        heroSubtext: "rgba(255,255,255,0.75)",
        heroMeta: "rgba(255,255,255,0.85)",
        heroPill: "rgba(255,255,255,0.12)",
        heroTrack: "rgba(255,255,255,0.35)",
        shadow: "#0F261F",
    },
    dark: {
        bg: "#0F1413",
        surface: "#1A211F",
        primary: "#3DBF9A",
        deepPrimary: "#0F6E5C",
        onPrimary: "#FFFFFF",
        onAccent: "#092520",
        text: "#E8ECEA",
        sub: "#9AA5A1",
        income: "#34C98B",
        expense: "#F26D6D",
        warning: "#F2B24D",
        tint: "#173D35",
        outline: "#2E3835",
        track: "#2A322F",
        avatarBg: "#252E2B",
        chartBlue: "#6EB5EE",
        chartGray: "#56645F",
        amberBg: "#3B2D19",
        amberText: "#F2B24D",
        heroSubtext: "rgba(255,255,255,0.75)",
        heroMeta: "rgba(255,255,255,0.85)",
        heroPill: "rgba(255,255,255,0.12)",
        heroTrack: "rgba(255,255,255,0.35)",
        shadow: "#000000",
    },
};
// Reusable spacing values preserve the 412 px Figma rhythm at flexible widths.
export const spacing = {
    hairline: 1,
    xxs: 2,
    xs: 4,
    compact: 6,
    sm: 8,
    keyGap: 10,
    md: 12,
    lg: 14,
    xl: 16,
    card: 18,
    screen: 20,
    hero: 22,
    top: 24,
    xxl: 32,
};
// Radius tokens map directly to Figma cards, chips, controls, and progress bars.
export const radii = {
    progress: 4,
    small: 10,
    row: 14,
    button: 18,
    chip: 20,
    card: 20,
    hero: 22,
    balance: 24,
    fab: 30,
    round: 999,
};
// Size tokens keep touch targets and chart geometry consistent across screens.
export const sizes = {
    designWidth: 412,
    designHeight: 892,
    maxContentWidth: 540,
    avatar: 42,
    compactAvatar: 40,
    donut: 124,
    progress: 8,
    toggleWidth: 44,
    toggleHeight: 24,
    toggleKnob: 18,
    fab: 60,
    tabBar: 80,
    tabIcon: 24,
    entryToggle: 44,
    entrySegment: 36,
    entryAmountBlock: 81,
    categoryCell: 64,
    accountChip: 33,
    entryKey: 53,
    primaryButton: 51,
    secondaryButton: 44,
    filterChip: 30,
    billCard: 110,
    tipCard: 70,
    tag: 22,
    smartHero: 133,
    smartPreview: 75,
    hybridNote: 50,
    reminderPreview: 61,
    lockCircle: 84,
    lockContentWidth: 348,
    lockTopInset: 66,
    pinDot: 16,
    emptyCircle: 110,
    emptyActionWidth: 226,
    fabClearance: 96,
    lockKey: 62,
};
// Registered Expo font names make weight selection deterministic on Android.
export const fonts = {
    regular: "Roboto_400Regular",
    medium: "Roboto_500Medium",
    bold: "Roboto_700Bold",
};
// Type roles are shared rather than reconstructed with magic numbers in screens.
export const typeScale = {
    screenTitle: 24,
    subScreenTitle: 20,
    heroAmount: 34,
    smartHeroAmount: 32,
    entryAmount: 44,
    cardHeader: 16,
    listName: 15,
    statAmount: 17,
    emptyTitle: 18,
    lockTitle: 22,
    keypad: 20,
    lockKeypad: 22,
    fabGlyph: 30,
    body: 14,
    label: 13,
    small: 12,
    tiny: 11,
    tag: 10,
};
// React Native shadow values reproduce the soft Figma card and stronger FAB depth.
export const shadows = {
    card: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 3,
    },
    fab: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
    },
};
const themes = {
    light: { mode: "light", colors: palettes.light, fonts, radii, shadows, sizes, spacing, typeScale },
    dark: { mode: "dark", colors: palettes.dark, fonts, radii, shadows, sizes, spacing, typeScale },
};
// This pure selector also gives tests a deterministic way to inspect either theme.
export function getTheme(mode) {
    return themes[mode];
}

/**
 * Resolve effective mode from preference + system scheme (pure — unit-testable).
 * @param {"system"|"light"|"dark"|undefined|null} preference
 * @param {"light"|"dark"|null|undefined} systemScheme
 * @returns {"light"|"dark"}
 */
export function resolveThemeMode(preference, systemScheme) {
    if (preference === "light" || preference === "dark") {
        return preference;
    }
    return systemScheme === "dark" ? "dark" : "light";
}

/**
 * Every UI component uses this hook.
 * - No arg → reads `themePreference` from uiStore (fixes shared components).
 * - Explicit "system" | "light" | "dark" → overrides store (screens/tests).
 */
export function useTheme(preference) {
    const colorScheme = useColorScheme();
    // Always subscribe so store theme changes re-render shared components.
    const storePreference = useUiStore((state) => state.themePreference);
    const resolvedPreference = preference === undefined ? storePreference : preference;
    return themes[resolveThemeMode(resolvedPreference, colorScheme)];
}
