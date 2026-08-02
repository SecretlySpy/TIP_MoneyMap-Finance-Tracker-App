import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { Toggle } from "../components/Toggle";
import { buildBackup, buildTransactionsCsv, serializeBackup, shareText, } from "../services/dataTransfer";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
function SettingsRow({ emoji, label, onPress, trailing }) {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    return (<Pressable accessibilityRole={onPress === undefined ? "text" : "button"} disabled={onPress === undefined} onPress={onPress} style={{
            alignItems: "center",
            flexDirection: "row",
            gap: theme.spacing.md,
            minHeight: theme.sizes.avatar,
        }}>
      <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, width: theme.typeScale.emptyTitle }}>
        {emoji}
      </Text>
      <Text style={{
            color: theme.colors.text,
            flex: 1,
            fontFamily: theme.fonts.medium,
            fontSize: theme.typeScale.body,
            lineHeight: theme.typeScale.cardHeader,
        }}>
        {label}
      </Text>
      {trailing}
    </Pressable>);
}
function SettingsSection({ children, title }) {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    return (<View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
        {title}
      </Text>
      <SectionCard padding={theme.spacing.lg}>{children}</SectionCard>
    </View>);
}
export function SettingsScreen({ navigation }) {
    const themePreference = useUiStore((state) => state.themePreference);
    const theme = useTheme(themePreference);
    const appLockEnabled = useUiStore((state) => state.appLockEnabled);
    const remindersEnabled = useUiStore((state) => state.remindersEnabled);
    const smartTipsEnabled = useUiStore((state) => state.smartTipsEnabled);
    const currencySymbol = useUiStore((state) => state.currencySymbol);
    const hasPin = useUiStore((state) => state.hasPin);
    const setAppLockEnabled = useUiStore((state) => state.setAppLockEnabled);
    const setRemindersEnabled = useUiStore((state) => state.setRemindersEnabled);
    const setSmartTipsEnabled = useUiStore((state) => state.setSmartTipsEnabled);
    const setCurrencySymbol = useUiStore((state) => state.setCurrencySymbol);
    const setThemePreference = useUiStore((state) => state.setThemePreference);
    const clearStoredPin = useUiStore((state) => state.clearStoredPin);
    const accounts = useFinanceStore((state) => state.accounts);
    const categories = useFinanceStore((state) => state.categories);
    const transactions = useFinanceStore((state) => state.transactions);
    const budgets = useFinanceStore((state) => state.budgets);
    const recurringRules = useFinanceStore((state) => state.recurringRules);
    const tabNavigation = navigation.getParent();
    const rootNavigation = tabNavigation?.getParent();
    const trailingText = (value) => (<Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
      {value}
    </Text>);
    const handleAppLockToggle = async (enabled) => {
        if (enabled) {
            await setAppLockEnabled(true);
            rootNavigation?.navigate("AppLock");
            return;
        }
        Alert.alert("Disable app lock?", "Your PIN will be removed from this device.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Disable",
                style: "destructive",
                onPress: () => {
                    void clearStoredPin();
                },
            },
        ]);
    };
    const handleExportCsv = async () => {
        try {
            const { accountsById, categoriesById } = mapsFromState({ accounts, categories });
            const csv = buildTransactionsCsv(transactions, categoriesById, accountsById);
            await shareText("MoneyMap CSV export", csv);
        }
        catch (error) {
            Alert.alert("Export failed", error instanceof Error ? error.message : "Could not share CSV.");
        }
    };
    const handleBackup = async () => {
        try {
            const backup = buildBackup({ accounts, categories, transactions, budgets, recurringRules });
            await shareText("MoneyMap backup", serializeBackup(backup));
        }
        catch (error) {
            Alert.alert("Backup failed", error instanceof Error ? error.message : "Could not share backup.");
        }
    };
    const cycleCurrency = () => {
        const options = ["₱", "$", "€", "£", "¥"];
        const index = options.indexOf(currencySymbol);
        const next = options[(index + 1) % options.length] ?? "₱";
        void setCurrencySymbol(next);
    };
    const cycleTheme = () => {
        const order = ["system", "light", "dark"];
        const index = order.indexOf(themePreference);
        const next = order[(index + 1) % order.length] ?? "system";
        void setThemePreference(next);
    };
    const themeLabel = themePreference === "system" ? "System" : themePreference === "light" ? "Light" : "Dark";
    return (<ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="settings-screen">
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
        Settings
      </Text>

      <SettingsSection title="SECURITY">
        <SettingsRow emoji="🔒" label="App lock (PIN + biometric)" onPress={() => rootNavigation?.navigate("AppLock")} trailing={<Toggle enabled={appLockEnabled && hasPin} label="App lock" onChange={(enabled) => void handleAppLockToggle(enabled)}/>}/>
        <SettingsRow emoji="🛡️" label="Encrypted database" trailing={trailingText("On")}/>
      </SettingsSection>

      <SettingsSection title="DATA">
        <SettingsRow emoji="📤" label="Export as CSV" onPress={() => void handleExportCsv()} trailing={trailingText("›")}/>
        <SettingsRow emoji="💾" label="Backup data" onPress={() => void handleBackup()} trailing={trailingText("›")}/>
        <SettingsRow emoji="♻️" label="Restore from backup" onPress={() => navigation.navigate("PasteImport", { mode: "backup" })} trailing={trailingText("›")}/>
        <SettingsRow emoji="📥" label={"Import data (CSV/\nExcel)"} onPress={() => navigation.navigate("PasteImport", { mode: "csv" })} trailing={trailingText("›")}/>
      </SettingsSection>

      <SettingsSection title="PREFERENCES">
        <SettingsRow emoji="💱" label="Currency symbol" onPress={cycleCurrency} trailing={trailingText(currencySymbol)}/>
        <SettingsRow emoji="🎨" label="Theme" onPress={cycleTheme} trailing={trailingText(themeLabel)}/>
        <SettingsRow emoji="🗂️" label="Manage categories" onPress={() => navigation.navigate("ManageCategories")} trailing={trailingText("›")}/>
        <SettingsRow emoji="🏦" label="Manage accounts" onPress={() => navigation.navigate("ManageAccounts")} trailing={trailingText("›")}/>
      </SettingsSection>

      <SettingsSection title="SMART FEATURES">
        <SettingsRow emoji="✨" label={"Budget-based tips\n(uses internet)"} onPress={() => {
            if (!smartTipsEnabled) {
                Alert.alert("Smart Tips off", "Turn on the switch to open budget-based tips.");
                return;
            }
            tabNavigation?.navigate("Home", { screen: "SmartTips" });
        }} trailing={<Toggle enabled={smartTipsEnabled} label="Budget-based tips" onChange={(enabled) => void setSmartTipsEnabled(enabled)}/>}/>
        <SettingsRow emoji="🔔" label={"Recurring bill\nreminders"} onPress={() => tabNavigation?.navigate("Budgets", { screen: "Recurring" })} trailing={<Toggle enabled={remindersEnabled} label="Recurring bill reminders" onChange={(enabled) => void setRemindersEnabled(enabled)}/>}/>
      </SettingsSection>

      <View accessible accessibilityRole="summary" style={{
            backgroundColor: theme.colors.tint,
            borderRadius: theme.radii.row,
            padding: theme.spacing.lg,
        }}>
        <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
          🔀 Offline-first · AI tips stay local until you add a network client
        </Text>
      </View>
    </ScreenContainer>);
}
