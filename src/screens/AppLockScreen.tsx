import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { ScreenContainer } from "../components/ScreenContainer";
import type { RootStackParamList } from "../navigation/routes";
import { useTheme } from "../theme/tokens";

type AppLockProps = NativeStackScreenProps<RootStackParamList, "AppLock">;

const lockKeypad = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["👆", "0", "⌫"],
] as const;

// This frame implements PIN feedback and biometric affordance without storing credentials.
export function AppLockScreen({ navigation }: AppLockProps) {
  const theme = useTheme();
  const [pin, setPin] = useState("12");
  const handleKey = (key: string) => {
    if (key === "⌫") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (key === "👆") {
      navigation.goBack();
      return;
    }
    setPin((current) => (current.length < 4 ? `${current}${key}` : current));
  };

  return (
    <ScreenContainer
      contentContainerStyle={{
        alignItems: "center",
        paddingHorizontal: theme.spacing.xxl,
        paddingTop: theme.sizes.lockTopInset,
      }}
      safeBottom
      scroll={false}
      testID="app-lock-screen"
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.tint,
          borderRadius: theme.radii.round,
          height: theme.sizes.lockCircle,
          justifyContent: "center",
          width: theme.sizes.lockCircle,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.heroAmount }}>🔒</Text>
      </View>

      <View style={{ alignItems: "center", gap: theme.spacing.xxs, marginTop: theme.spacing.xxl }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.lockTitle }}>
          Finance Tracker
        </Text>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
          Enter your PIN to unlock
        </Text>
      </View>

      <View
        accessibilityLabel={`${pin.length} of 4 PIN digits entered`}
        style={{ flexDirection: "row", gap: theme.spacing.card, marginTop: theme.spacing.xxl }}
      >
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={{
              backgroundColor: index < pin.length ? theme.colors.primary : theme.colors.outline,
              borderRadius: theme.radii.round,
              height: theme.sizes.pinDot,
              width: theme.sizes.pinDot,
            }}
          />
        ))}
      </View>

      <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.xxl, width: theme.sizes.lockContentWidth }}>
        {lockKeypad.map((row, rowIndex) => (
          <View key={`lock-row-${rowIndex}`} style={{ flexDirection: "row", gap: theme.spacing.lg }}>
            {row.map((key) => (
              <Pressable
                accessibilityLabel={key === "👆" ? "Use fingerprint" : key === "⌫" ? "Delete PIN digit" : key}
                accessibilityRole="button"
                key={key}
                onPress={() => handleKey(key)}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radii.card,
                  borderWidth: theme.spacing.hairline,
                  flex: 1,
                  height: theme.sizes.lockKey,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.lockKeypad }}>
                  {key}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        hitSlop={theme.spacing.md}
        onPress={() => navigation.goBack()}
        style={{ marginTop: theme.spacing.xxl }}
      >
        <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
          Use fingerprint instead
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}
