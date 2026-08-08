import { Pressable } from "react-native";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
// Primary actions use the exact 51 px Figma height and brand fill.
export function PrimaryButton({ accessibilityLabel, children, disabled = false, onPress, style }) {
    const theme = useTheme();
    const label = accessibilityLabel ?? (typeof children === "string" ? children : undefined);
    return (<Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[
            {
                alignItems: "center",
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radii.button,
                height: theme.sizes.primaryButton,
                justifyContent: "center",
                opacity: disabled ? 0.45 : 1,
                width: "100%",
            },
            style,
        ]}>
      <Text style={{
            color: theme.mode === "dark" ? theme.colors.onAccent : theme.colors.onPrimary,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.cardHeader,
        }}>
        {children}
      </Text>
    </Pressable>);
}
// Dashed secondary actions retain the approved outline treatment and 44 px height.
export function DashedButton({ accessibilityLabel, children, disabled = false, onPress, style }) {
    const theme = useTheme();
    const label = accessibilityLabel ?? (typeof children === "string" ? children : undefined);
    return (<Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[
            {
                alignItems: "center",
                borderColor: theme.colors.primary,
                borderRadius: theme.radii.row,
                borderStyle: "dashed",
                borderWidth: 1.5,
                height: theme.sizes.secondaryButton,
                justifyContent: "center",
                opacity: disabled ? 0.45 : 1,
                width: "100%",
            },
            style,
        ]}>
      <Text style={{
            color: theme.colors.primary,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.body,
        }}>
        {children}
      </Text>
    </Pressable>);
}
