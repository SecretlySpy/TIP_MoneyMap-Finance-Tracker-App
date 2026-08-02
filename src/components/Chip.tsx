import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable } from "react-native";

import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

interface ChipProps {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly selected?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

// Chips expose their selected state to screen readers and preserve 30+ px touch height.
export function Chip({ children, onPress, selected = false, style }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={onPress === undefined}
      onPress={onPress}
      style={[
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
      ]}
    >
      <Text
        style={{
          color: selected ? theme.colors.primary : theme.colors.sub,
          fontFamily: selected ? theme.fonts.bold : theme.fonts.medium,
          fontSize: theme.typeScale.label,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
