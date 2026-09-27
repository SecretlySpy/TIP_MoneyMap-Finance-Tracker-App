import { Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

/**
 * 01 Splash Screen: First-run onboarding matching Figma screen 01 Splash.
 */
export function SplashScreen({ navigation }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const setHasSeenSplash = useUiStore((state) => state.setHasSeenSplash);
  const isLocked = useUiStore((state) => state.isLocked);
  const hasPin = useUiStore((state) => state.hasPin);

  const handleGetStarted = async () => {
    if (setHasSeenSplash) {
      await setHasSeenSplash(true);
    }
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    if (isLocked && hasPin) {
      navigation?.replace?.("AppLock");
    } else {
      navigation?.replace?.("Main");
    }
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
      scroll={false}
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
        <PrimaryButton onPress={() => void handleGetStarted()}>
          Get started
        </PrimaryButton>
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
