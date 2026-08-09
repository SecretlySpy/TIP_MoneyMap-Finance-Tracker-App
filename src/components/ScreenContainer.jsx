import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/tokens";
// This wrapper applies the Figma safe area, responsive width, and screen padding once.
export function ScreenContainer({ children, contentContainerStyle, floating, safeBottom = false, scroll = true, testID, }) {
    const theme = useTheme();
    const contentStyle = [
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
    return (<SafeAreaView edges={safeBottom ? ["top", "bottom", "left", "right"] : ["top", "left", "right"]} style={{ flex: 1, backgroundColor: theme.colors.bg }} testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
      {floating}
    </SafeAreaView>);
}
