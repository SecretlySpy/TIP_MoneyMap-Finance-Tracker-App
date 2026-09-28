import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { OptionChipRow } from "../components/OptionChipRow";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { Toggle } from "../components/Toggle";
import { buildBackup, buildTransactionsCsv, exportFileName, serializeBackup, shareDocument, } from "../services/dataTransfer";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

const CURRENCY_OPTIONS = [
    { value: "₱", label: "₱" },
    { value: "$", label: "$" },
    { value: "€", label: "€" },
    { value: "£", label: "£" },
    { value: "¥", label: "¥" },
];
const THEME_OPTIONS = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
];

function SettingsRow({ emoji, label, onPress, subtitle, trailing }) {
    const theme = useTheme();
    return (<Pressable accessibilityRole={onPress === undefined ? "text" : "button"} disabled={onPress === undefined} onPress={onPress} style={{
            alignItems: "center",
            flexDirection: "row",
            gap: theme.spacing.md,
            minHeight: theme.sizes.avatar,
        }}>
      <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, width: theme.typeScale.emptyTitle }}>
        {emoji}
      </Text>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.medium,
            fontSize: theme.typeScale.body,
            lineHeight: theme.typeScale.cardHeader,
        }}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>);
}
function SettingsSection({ children, title }) {
    const theme = useTheme();
    const childArray = Array.isArray(children) ? children.filter(Boolean) : [children];
    return (<View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
        {title}
      </Text>
      <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
        {childArray.map((child, idx) => (
          <View key={`settings-card-item-${idx}`} style={{ gap: theme.spacing.md }}>
            {idx > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.outline }} /> : null}
            {child}
          </View>
        ))}
      </SectionCard>
    </View>);
}
export function SettingsScreen({ navigation }) {
    const themePreference = useUiStore((state) => state.themePreference);
    const theme = useTheme();
    const appLockEnabled = useUiStore((state) => state.appLockEnabled);
    const remindersEnabled = useUiStore((state) => state.remindersEnabled);
    const notificationPermissionDenied = useUiStore((state) => state.notificationPermissionDenied);
    const notificationHint = useUiStore((state) => state.notificationHint);
    const smartTipsEnabled = useUiStore((state) => state.smartTipsEnabled);
    const currencySymbol = useUiStore((state) => state.currencySymbol);
    const hasPin = useUiStore((state) => state.hasPin);
    const setAppLockEnabled = useUiStore((state) => state.setAppLockEnabled);
    const setRemindersEnabled = useUiStore((state) => state.setRemindersEnabled);
    const setSmartTipsEnabled = useUiStore((state) => state.setSmartTipsEnabled);
    const smartTipsConsentAccepted = useUiStore((state) => state.smartTipsConsentAccepted);
    const acceptSmartTipsConsent = useUiStore((state) => state.acceptSmartTipsConsent);
    const declineSmartTipsConsent = useUiStore((state) => state.declineSmartTipsConsent);
    const setCurrencySymbol = useUiStore((state) => state.setCurrencySymbol);
    const setThemePreference = useUiStore((state) => state.setThemePreference);
    const clearStoredPin = useUiStore((state) => state.clearStoredPin);
    const accounts = useFinanceStore((state) => state.accounts);
    const categories = useFinanceStore((state) => state.categories);
    const transactions = useFinanceStore((state) => state.transactions);
    const budgets = useFinanceStore((state) => state.budgets);
    const recurringRules = useFinanceStore((state) => state.recurringRules);
    const goals = useFinanceStore((state) => state.goals);
    const tabNavigation = navigation.getParent();
    const rootNavigation = tabNavigation?.getParent();
    const trailingText = (value) => (<Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
      {value}
    </Text>);
    const valuePill = (value) => (<View style={{
            backgroundColor: theme.colors.tint,
            borderRadius: theme.radii.chip,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.compact,
        }}>
      <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
        {value}
      </Text>
    </View>);
    const cycleThemePreference = () => {
        const order = THEME_OPTIONS.map((option) => option.value);
        const next = order[(order.indexOf(themePreference) + 1) % order.length];
        void setThemePreference(next);
    };
    const themeLabel = THEME_OPTIONS.find((option) => option.value === themePreference)?.label ?? "System";
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
            await shareDocument(
                "MoneyMap CSV export",
                exportFileName("moneymap-transactions", "csv"),
                csv,
            );
        }
        catch (error) {
            Alert.alert("Export failed", error instanceof Error ? error.message : "Could not share CSV.");
        }
    };
    const handleBackup = async () => {
        Alert.alert(
            "Share Plaintext Backup?",
            "This backup contains your unencrypted accounts, balances, and complete transaction history. Share only with trusted destinations.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Share Backup",
                    onPress: async () => {
                        try {
                            const backup = buildBackup({ accounts, categories, transactions, budgets, recurringRules, goals });
                            await shareDocument(
                                "MoneyMap backup",
                                exportFileName("moneymap-backup", "json"),
                                serializeBackup(backup),
                            );
                        }
                        catch (error) {
                            Alert.alert("Backup failed", error instanceof Error ? error.message : "Could not share backup.");
                        }
                    },
                },
            ],
        );
    };
    return (<ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="settings-screen">
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
        Settings
      </Text>

      <SettingsSection title="SECURITY">
        <SettingsRow emoji="🔒" label="Optional app lock (PIN + biometric)" onPress={() => rootNavigation?.navigate("AppLock")} trailing={<Toggle enabled={appLockEnabled && hasPin} label="App lock" onChange={(enabled) => void handleAppLockToggle(enabled)}/>}/>
        <SettingsRow emoji="🛡️" label="Encrypted database · separate key" trailing={trailingText("On")}/>
      </SettingsSection>

      <SettingsSection title="DATA">
        <SettingsRow emoji="📤" label="Export as CSV" onPress={() => void handleExportCsv()} trailing={trailingText("›")}/>
        <SettingsRow emoji="💾" label="Backup data" onPress={() => void handleBackup()} trailing={trailingText("›")}/>
        <SettingsRow emoji="♻️" label="Restore from backup" onPress={() => navigation.navigate("PasteImport", { mode: "backup" })} trailing={trailingText("›")}/>
        <SettingsRow emoji="📥" label="Import data (CSV / Excel)" onPress={() => navigation.navigate("Import")} trailing={trailingText("›")}/>
      </SettingsSection>

      <SettingsSection title="PREFERENCES">
        <OptionChipRow
          accessibilityLabel="Currency symbol"
          label="💱 Currency symbol"
          onChange={(value) => void setCurrencySymbol(value)}
          options={CURRENCY_OPTIONS}
          value={currencySymbol}
        />
        <SettingsRow emoji="🎨" label="Theme" onPress={cycleThemePreference} subtitle="Light / Dark / System" trailing={valuePill(themeLabel)}/>
        <SettingsRow emoji="🗂️" label="Manage categories" onPress={() => navigation.navigate("ManageCategories")} trailing={trailingText("›")}/>
        <SettingsRow emoji="🏦" label="Manage accounts" onPress={() => navigation.navigate("ManageAccounts")} trailing={trailingText("›")}/>
      </SettingsSection>

      <SettingsSection title="SMART FEATURES">
        <SettingsRow emoji="✨" label="Offline tips + online personalization" onPress={() => {
            tabNavigation?.navigate("Home", { screen: "SmartTips" });
        }} subtitle="Offline always available · online opt-in" trailing={<Toggle enabled={smartTipsEnabled} label="Budget-based tips" onChange={(enabled) => {
            if (!enabled) {
                void setSmartTipsEnabled(false);
                return;
            }
            if (smartTipsConsentAccepted) {
                void setSmartTipsEnabled(true);
                return;
            }
            Alert.alert(
                "Enable Smart Tips?",
                "When online, MoneyMap may send an anonymized budget summary to Google Gemini: period, remaining budget, per-category spend ratios, and currency symbol. Raw transactions, notes, and account names never leave this device. Offline tips always stay local.",
                [
                    { text: "Not now", style: "cancel", onPress: () => { void declineSmartTipsConsent(); } },
                    { text: "I understand", onPress: () => { void acceptSmartTipsConsent(); } },
                ],
            );
        }}/>}/>
        <SettingsRow emoji="🔔" label="Recurring bill reminders" onPress={() => tabNavigation?.navigate("Budgets", { screen: "Recurring" })} trailing={<Toggle enabled={remindersEnabled} label="Recurring bill reminders" onChange={(enabled) => void setRemindersEnabled(enabled)}/>}/>
        {remindersEnabled && (notificationPermissionDenied || notificationHint) ? (
          <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small, marginTop: theme.spacing.sm }}>
            {notificationHint ?? "Notification permission is off. Bill alerts stay in-app only until you allow notifications."}
          </Text>
        ) : null}
      </SettingsSection>
    </ScreenContainer>);
}
