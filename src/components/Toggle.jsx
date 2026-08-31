import { Pressable, View } from "react-native";
import { useTheme } from "../theme/tokens";
// The control matches the 44x24 Figma switch and remains a semantic native switch target.
export function Toggle({ enabled, label, onChange }) {
    const theme = useTheme();
    return (<Pressable accessibilityLabel={label} accessibilityRole="switch" accessibilityState={{ checked: enabled }} hitSlop={{ bottom: theme.spacing.md, left: theme.spacing.sm, right: theme.spacing.sm, top: theme.spacing.md }} onPress={() => onChange(!enabled)} style={{ opacity: 1 }}>
      <View style={{
            backgroundColor: enabled ? theme.colors.primary : theme.colors.track,
            borderRadius: theme.radii.round,
            height: theme.sizes.toggleHeight,
            justifyContent: "center",
            paddingHorizontal: 3,
            width: theme.sizes.toggleWidth,
        }}>
        <View style={{
            alignSelf: enabled ? "flex-end" : "flex-start",
            backgroundColor: theme.colors.onPrimary,
            borderRadius: theme.radii.round,
            height: theme.sizes.toggleKnob,
            width: theme.sizes.toggleKnob,
        }}/>
      </View>
    </Pressable>);
}
