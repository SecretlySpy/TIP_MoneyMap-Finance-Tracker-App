import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme/tokens";

interface ScreenContainerProps {
  readonly children: ReactNode;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly floating?: ReactNode;
  readonly safeBottom?: boolean;
  readonly scroll?: boolean;
  readonly testID?: string;
}

// This wrapper applies the Figma safe area, responsive width, and screen padding once.
export function ScreenContainer({
  children,
  contentContainerStyle,
  floating,
  safeBottom = false,
  scroll = true,
  testID,
}: ScreenContainerProps) {
  const theme = useTheme();
  const contentStyle: StyleProp<ViewStyle> = [
    {
      alignSelf: "center",
      paddingBottom: theme.spacing.screen,
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.top,
      width: "100%",
      maxWidth: theme.sizes.maxContentWidth,
    },
    contentContainerStyle,
  ];

  return (
    <SafeAreaView
      edges={safeBottom ? ["top", "bottom", "left", "right"] : ["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      testID={testID}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
      {floating}
    </SafeAreaView>
  );
}
