import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { ScreenContainer } from "../components/ScreenContainer";
import type { RootStackParamList } from "../navigation/routes";
import { isValidPin } from "../services/appLock";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

type AppLockProps = NativeStackScreenProps<RootStackParamList, "AppLock">;

const lockKeypad = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["👆", "0", "⌫"],
] as const;

type LockMode = "unlock" | "create" | "confirm";

// PIN setup/unlock with optional biometric affordance when the native module is present.
export function AppLockScreen({ navigation }: AppLockProps) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const hasPin = useUiStore((state) => state.hasPin);
  const appLockEnabled = useUiStore((state) => state.appLockEnabled);
  const isLocked = useUiStore((state) => state.isLocked);
  const setupPin = useUiStore((state) => state.setupPin);
  const unlockWithPin = useUiStore((state) => state.unlockWithPin);
  const unlockWithBiometrics = useUiStore((state) => state.unlockWithBiometrics);
  const setAppLockEnabled = useUiStore((state) => state.setAppLockEnabled);

  const [mode, setMode] = useState<LockMode>(hasPin ? "unlock" : "create");
  const [pin, setPin] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(hasPin ? "unlock" : "create");
    setPin("");
    setPendingPin("");
    setError(null);
  }, [hasPin]);

  const title =
    mode === "create" ? "Create a 4-digit PIN" : mode === "confirm" ? "Confirm your PIN" : "Enter your PIN to unlock";

  const canLeaveWithoutUnlock = !isLocked || !appLockEnabled || !hasPin;

  const finishUnlock = () => {
    // Root-level lock swaps navigators when isLocked becomes false.
    // Setup/preview navigated from Settings still needs an explicit pop.
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleBiometric = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await unlockWithBiometrics();
      if (result === "success") {
        finishUnlock();
        return;
      }
      if (result === "unavailable") {
        setError("Biometrics are unavailable. Enter your PIN.");
        return;
      }
      setError("Biometric unlock failed. Try your PIN.");
    } finally {
      setBusy(false);
    }
  };

  const handleCompletePin = async (nextPin: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        setPendingPin(nextPin);
        setPin("");
        setMode("confirm");
        return;
      }
      if (mode === "confirm") {
        if (nextPin !== pendingPin) {
          setError("PINs did not match. Try again.");
          setPendingPin("");
          setPin("");
          setMode("create");
          return;
        }
        await setupPin(nextPin);
        setPin("");
        finishUnlock();
        return;
      }
      const ok = await unlockWithPin(nextPin);
      if (!ok) {
        setError("Incorrect PIN.");
        setPin("");
        return;
      }
      finishUnlock();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "PIN action failed.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const handleKey = (key: string) => {
    if (busy) {
      return;
    }
    if (key === "⌫") {
      setPin((current) => current.slice(0, -1));
      setError(null);
      return;
    }
    if (key === "👆") {
      void handleBiometric();
      return;
    }
    setPin((current) => {
      if (current.length >= 4) {
        return current;
      }
      const next = `${current}${key}`;
      if (next.length === 4 && isValidPin(next)) {
        void handleCompletePin(next);
      }
      return next;
    });
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
          {title}
        </Text>
        {error !== null ? (
          <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
            {error}
          </Text>
        ) : null}
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

      {hasPin ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => void handleBiometric()}
          style={{ marginTop: theme.spacing.xxl }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            Use fingerprint instead
          </Text>
        </Pressable>
      ) : canLeaveWithoutUnlock ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => {
            void setAppLockEnabled(false);
            navigation.goBack();
          }}
          style={{ marginTop: theme.spacing.xxl }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            Cancel setup
          </Text>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}
