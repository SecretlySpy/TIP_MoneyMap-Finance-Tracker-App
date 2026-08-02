import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { useTheme } from "../theme/tokens";

interface SectionCardProps {
  readonly children: ReactNode;
  readonly padding?: number;
  readonly shadowed?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

// Section cards share one radius, surface, clipping, and optional elevation recipe.
export function SectionCard({ children, padding, shadowed = false, style }: SectionCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.card,
          padding: padding ?? theme.spacing.card,
          shadowColor: theme.colors.shadow,
          ...(shadowed ? theme.shadows.card : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
