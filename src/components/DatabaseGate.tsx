import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

interface DatabaseGateProps {
  readonly children: ReactNode;
}

type InitializationState = "loading" | "ready" | "error";

export function DatabaseGate({ children }: DatabaseGateProps) {
  const theme = useTheme();
  const ensureHydrated = useFinanceStore((state) => state.ensureHydrated);
  const [initializationState, setInitializationState] =
    useState<InitializationState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setInitializationState("loading");

    void ensureHydrated()
      .then(() => {
        if (isMounted) {
          setInitializationState("ready");
        }
      })
      .catch(() => {
        if (isMounted) {
          setInitializationState("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [attempt, ensureHydrated]);

  if (initializationState === "ready") {
    return children;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: theme.spacing.top }}>
        {initializationState === "loading" ? (
          <View accessible accessibilityRole="progressbar" style={{ alignItems: "center", gap: theme.spacing.xl }}>
            <ActivityIndicator color={theme.colors.primary} size="large" accessibilityLabel="Preparing encrypted database" />
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.cardHeader, textAlign: "center" }}>
              Preparing your encrypted finance vault…
            </Text>
          </View>
        ) : (
          <View accessible accessibilityRole="alert" style={{ alignItems: "center", gap: theme.spacing.xl, maxWidth: theme.sizes.maxContentWidth, width: "100%" }}>
            <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle, textAlign: "center" }}>
              MoneyMap could not open your encrypted data.
            </Text>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.cardHeader, lineHeight: theme.spacing.top, textAlign: "center" }}>
              Your records were not changed. Make sure this is a development build, then try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt((currentAttempt) => currentAttempt + 1)}
              style={{ alignItems: "center", backgroundColor: theme.colors.primary, borderRadius: theme.radii.button, justifyContent: "center", minHeight: 48, minWidth: 128, paddingHorizontal: theme.spacing.top, paddingVertical: theme.spacing.md }}
            >
              <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>Retry</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
