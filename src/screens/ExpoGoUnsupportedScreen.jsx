import { useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText as Text } from "../components/AppText";
import { getTheme, resolveThemeMode } from "../theme/tokens";

/**
 * Expo Go has no SQLCipher native module. Show install steps instead of crashing.
 */
export function ExpoGoUnsupportedScreen() {
  const theme = getTheme(resolveThemeMode("system", useColorScheme()));
  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.bg, flex: 1 }} testID="expo-go-unsupported-screen">
      <View
        accessible
        accessibilityRole="alert"
        style={{
          flex: 1,
          gap: theme.spacing.xl,
          justifyContent: "center",
          paddingHorizontal: theme.spacing.top,
        }}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.subScreenTitle,
          }}
        >
          Expo Go cannot run MoneyMap
        </Text>
        <Text
          style={{
            color: theme.colors.sub,
            fontFamily: theme.fonts.regular,
            fontSize: theme.typeScale.body,
            lineHeight: theme.spacing.top,
          }}
        >
          MoneyMap stores data in SQLCipher, which is not included in Expo Go. Scanning the QR code in
          Expo Go will crash or show a native-module error.
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.medium,
            fontSize: theme.typeScale.body,
            lineHeight: theme.spacing.top,
          }}
        >
          Use an Android development build instead: install Node 22, run npm ci, start an emulator or
          device, then run npm run android.
        </Text>
      </View>
    </SafeAreaView>
  );
}
