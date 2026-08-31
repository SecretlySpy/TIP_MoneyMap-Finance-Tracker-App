import { Pressable } from "react-native";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
// Chips expose their selected state to screen readers and preserve 30+ px touch height.
export function Chip({ children, onPress, selected = false, style }) {
    const theme = useTheme();
    // Visual height stays on the design grid; hitSlop lifts the touch target to >=44dp.
    return (<Pressable accessibilityRole="button" accessibilityState={{ selected }} disabled={onPress === undefined} hitSlop={{ bottom: theme.spacing.sm, left: theme.spacing.xs, right: theme.spacing.xs, top: theme.spacing.sm }} onPress={onPress} style={[
            {
                alignItems: "center",
                backgroundColor: selected ? theme.colors.tint : theme.colors.surface,
                borderColor: selected ? theme.colors.primary : theme.colors.outline,
                borderRadius: theme.radii.chip,
                borderWidth: 1,
                justifyContent: "center",
                minHeight: 32,
                paddingHorizontal: theme.spacing.md,
            },
            style,
        ]}>
      <Text style={{
            color: selected ? theme.colors.primary : theme.colors.sub,
            fontFamily: selected ? theme.fonts.bold : theme.fonts.medium,
            fontSize: theme.typeScale.label,
        }}>
        {children}
      </Text>
    </Pressable>);
}
