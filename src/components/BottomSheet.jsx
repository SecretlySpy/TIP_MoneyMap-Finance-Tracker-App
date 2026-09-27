import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

/**
 * Reusable modal BottomSheet matching Figma 08, 08b, 09b, 10b task states.
 */
export function BottomSheet({
  children,
  onClose,
  testID = "bottom-sheet",
  title,
  visible,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Dismiss sheet"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.scrim}
        />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radii.balance,
            borderTopRightRadius: theme.radii.balance,
            gap: theme.spacing.md,
            paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
            paddingHorizontal: theme.spacing.screen,
            paddingTop: theme.spacing.md,
            width: "100%",
          }}
        >
          {/* Grabber */}
          <View
            style={{
              alignSelf: "center",
              backgroundColor: theme.colors.outline,
              borderRadius: theme.radii.round,
              height: 5,
              marginBottom: theme.spacing.xs,
              width: 44,
            }}
          />

          {title ? (
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.subScreenTitle,
              }}
            >
              {title}
            </Text>
          ) : null}

          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
});
