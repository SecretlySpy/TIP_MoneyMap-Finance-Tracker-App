import { View } from "react-native";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { PrimaryButton } from "./Buttons";

/**
 * Shared empty-state block used across list screens.
 * Keeps illustration, copy, and optional CTA consistent.
 */
export function EmptyState({
  emoji = "📭",
  title,
  message,
  actionLabel,
  onAction,
  testID = "empty-state",
}) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  // Do not set accessible on this container: that merges children into one node and
  // hides the CTA from getByRole("button", { name: actionLabel }).
  return (
    <View
      style={{
        alignItems: "center",
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: theme.spacing.screen,
        paddingVertical: theme.spacing.xxl,
      }}
      testID={testID}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.tint,
          borderRadius: theme.radii.round,
          height: theme.sizes.emptyCircle,
          justifyContent: "center",
          width: theme.sizes.emptyCircle,
        }}
      >
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.entryAmount }}>
          {emoji}
        </Text>
      </View>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.bold,
          fontSize: theme.typeScale.emptyTitle,
          marginTop: theme.spacing.lg,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            color: theme.colors.sub,
            fontFamily: theme.fonts.regular,
            fontSize: theme.typeScale.body,
            lineHeight: theme.spacing.screen,
            marginTop: theme.spacing.md,
            textAlign: "center",
          }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton
          onPress={onAction}
          style={{
            alignSelf: "center",
            height: theme.sizes.secondaryButton,
            marginTop: theme.spacing.lg,
            minWidth: theme.sizes.emptyActionWidth,
          }}
        >
          {actionLabel}
        </PrimaryButton>
      ) : null}
    </View>
  );
}
