import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { Toggle } from "../components/Toggle";
import type { MainTabParamList, RootStackParamList, SettingsStackParamList } from "../navigation/routes";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

type SettingsProps = NativeStackScreenProps<SettingsStackParamList, "SettingsOverview">;

interface SettingsRowProps {
  readonly emoji: string;
  readonly label: string;
  readonly onPress?: () => void;
  readonly trailing: ReactNode;
}

// Rows share one accessible hit target while allowing text, arrows, or switches at the end.
function SettingsRow({ emoji, label, onPress, trailing }: SettingsRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress === undefined ? "text" : "button"}
      disabled={onPress === undefined}
      onPress={onPress}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.md,
        minHeight: theme.sizes.avatar,
      }}
    >
      <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, width: theme.typeScale.emptyTitle }}>
        {emoji}
      </Text>
      <Text
        style={{
          color: theme.colors.text,
          flex: 1,
          fontFamily: theme.fonts.medium,
          fontSize: theme.typeScale.body,
          lineHeight: theme.typeScale.cardHeader,
        }}
      >
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

interface SettingsSectionProps {
  readonly children: ReactNode;
  readonly title: string;
}

// Section labels and cards follow the exact uppercase grouping from Figma frame 13:105.
function SettingsSection({ children, title }: SettingsSectionProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
        {title}
      </Text>
      <SectionCard padding={theme.spacing.lg}>{children}</SectionCard>
    </View>
  );
}

// The Settings screen is UI-only: switches update preview state but do not enable network access.
export function SettingsScreen({ navigation }: SettingsProps) {
  const theme = useTheme();
  const appLockEnabled = useUiStore((state) => state.appLockEnabled);
  const remindersEnabled = useUiStore((state) => state.remindersEnabled);
  const smartTipsEnabled = useUiStore((state) => state.smartTipsEnabled);
  const setAppLockEnabled = useUiStore((state) => state.setAppLockEnabled);
  const setRemindersEnabled = useUiStore((state) => state.setRemindersEnabled);
  const setSmartTipsEnabled = useUiStore((state) => state.setSmartTipsEnabled);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = tabNavigation?.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const trailingText = (value: string) => (
    <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
      {value}
    </Text>
  );

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="settings-screen">
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
        Settings
      </Text>

      <SettingsSection title="SECURITY">
        <SettingsRow
          emoji="🔒"
          label="App lock (PIN + biometric)"
          onPress={() => rootNavigation?.navigate("AppLock")}
          trailing={<Toggle enabled={appLockEnabled} label="App lock" onChange={setAppLockEnabled} />}
        />
        <SettingsRow emoji="🛡️" label="Encrypted database" trailing={trailingText("On")} />
      </SettingsSection>

      <SettingsSection title="DATA">
        <SettingsRow emoji="📤" label="Export as CSV" onPress={() => undefined} trailing={trailingText("›")} />
        <SettingsRow emoji="💾" label="Backup data" onPress={() => undefined} trailing={trailingText("›")} />
        <SettingsRow emoji="♻️" label="Restore from backup" onPress={() => undefined} trailing={trailingText("›")} />
        <SettingsRow emoji="📥" label={"Import data (CSV/\nExcel)"} onPress={() => undefined} trailing={trailingText("›")} />
      </SettingsSection>

      <SettingsSection title="PREFERENCES">
        <SettingsRow emoji="💱" label="Currency symbol" trailing={trailingText("₱")} />
        <SettingsRow emoji="🎨" label="Theme" trailing={trailingText("System")} />
        <SettingsRow emoji="🗂️" label="Manage categories" onPress={() => undefined} trailing={trailingText("›")} />
        <SettingsRow emoji="🏦" label="Manage accounts" onPress={() => undefined} trailing={trailingText("›")} />
      </SettingsSection>

      <SettingsSection title="SMART FEATURES">
        <SettingsRow
          emoji="✨"
          label={"Budget-based tips\n(uses internet)"}
          onPress={() => tabNavigation?.navigate("Home", { screen: "SmartTips" })}
          trailing={<Toggle enabled={smartTipsEnabled} label="Budget-based tips" onChange={setSmartTipsEnabled} />}
        />
        <SettingsRow
          emoji="🔔"
          label={"Recurring bill\nreminders"}
          onPress={() => tabNavigation?.navigate("Budgets", { screen: "Recurring" })}
          trailing={<Toggle enabled={remindersEnabled} label="Recurring bill reminders" onChange={setRemindersEnabled} />}
        />
      </SettingsSection>

      <View
        accessible
        accessibilityRole="summary"
        style={{
          backgroundColor: theme.colors.tint,
          borderRadius: theme.radii.row,
          padding: theme.spacing.lg,
        }}
      >
        <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
          🔀 Offline-first · AI tips use internet (opt-in)
        </Text>
      </View>
    </ScreenContainer>
  );
}
