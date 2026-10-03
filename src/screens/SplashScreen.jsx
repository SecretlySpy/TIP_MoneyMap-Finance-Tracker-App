import { useState } from "react";
import { Alert, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { DashedButton, PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

/**
 * 01 Splash Screen: First-run onboarding matching Figma screen 01 Splash.
 */
export function SplashScreen({ navigation }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const beginOnboarding = useUiStore((state) => state.beginOnboarding);
  const discardInvalidOnboardingDraft = useUiStore((state) => state.discardInvalidOnboardingDraft);
  const onboardingDraftInvalid = useUiStore((state) => state.onboardingDraftInvalid);
  const onboardingLoadError = useUiStore((state) => state.onboardingLoadError);
  const splashReadError = useUiStore((state) => state.splashReadError);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleGetStarted = async () => {
    // Settings uses this screen as a replayable preview, not as a first-run reset.
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const draft = await beginOnboarding();
      if (draft !== null) {
        navigation?.replace?.("Onboarding");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start setup. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDiscard = () => {
    Alert.alert(
      "Discard saved setup?",
      "Your unfinished account and expense inputs will be removed. Existing saved financial records will stay intact.",
      [
        { text: "Keep setup", style: "cancel" },
        {
          text: "Discard draft",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            setError(null);
            void discardInvalidOnboardingDraft()
              .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not discard setup progress."))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "space-between",
        paddingBottom: theme.spacing.xl,
        paddingHorizontal: theme.spacing.screen,
        paddingTop: theme.sizes.lockTopInset,
      }}
      safeBottom
      testID="splash-screen"
    >
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: theme.spacing.lg }}>
        {/* Brand IconCircle */}
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
          <Text style={{ fontSize: theme.typeScale.heroAmount }}>💰</Text>
        </View>

        {/* Brand Text */}
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.heroAmount,
              textAlign: "center",
            }}
          >
            MoneyMap
          </Text>
          <Text
            style={{
              color: theme.colors.sub,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.body,
              lineHeight: 22,
              textAlign: "center",
            }}
          >
            {"Track your allowance, budgets and bills.\nCore finance works offline."}
          </Text>
        </View>
      </View>

      {/* CTA Section */}
      <View style={{ gap: theme.spacing.md, width: "100%" }}>
        <PrimaryButton disabled={busy} onPress={() => void handleGetStarted()}>
          {busy ? "Starting…" : "Get started"}
        </PrimaryButton>
        {onboardingDraftInvalid ? (
          <DashedButton disabled={busy} onPress={confirmDiscard}>Discard saved setup</DashedButton>
        ) : null}
        {error !== null || onboardingLoadError !== null || splashReadError !== null ? (
          <Text accessibilityRole="alert" style={{ color: theme.colors.expense, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label, textAlign: "center" }}>
            {error ?? splashReadError ?? onboardingLoadError}
          </Text>
        ) : null}
        <Text
          style={{
            color: theme.colors.sub,
            fontFamily: theme.fonts.regular,
            fontSize: theme.typeScale.small,
            textAlign: "center",
          }}
        >
          🔒 Optional app lock is available in Settings
        </Text>
      </View>
    </ScreenContainer>
  );
}
