import { ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { contentMaxWidthForViewport, useTheme } from "../theme/tokens";
// This wrapper applies the Figma safe area, responsive width, and screen padding once.
export function ScreenContainer({ children, contentContainerStyle, floating, safeBottom = false, scroll = true, testID, }) {
    const theme = useTheme();
    const { width: viewportWidth } = useWindowDimensions();
    const isTablet = viewportWidth >= theme.sizes.tabletBreakpoint;
    const contentStyle = [
        {
            alignSelf: "center",
            paddingBottom: theme.spacing.screen,
            paddingHorizontal: isTablet ? theme.spacing.xxl : theme.spacing.screen,
            paddingTop: theme.spacing.top,
            width: "100%",
            maxWidth: contentMaxWidthForViewport(viewportWidth, theme.sizes),
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
