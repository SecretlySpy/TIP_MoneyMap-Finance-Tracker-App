import { View } from "react-native";

import { useTheme } from "../theme/tokens";

interface ProgressBarProps {
  readonly color?: string;
  readonly percent: number;
}

// Progress is clamped for rendering while the visible caption may still report overspend.
export function ProgressBar({ color, percent }: ProgressBarProps) {
  const theme = useTheme();
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clampedPercent }}
      style={{
        backgroundColor: theme.colors.track,
        borderRadius: theme.radii.progress,
        height: theme.sizes.progress,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <View
        style={{
          backgroundColor: color ?? theme.colors.primary,
          borderRadius: theme.radii.progress,
          height: "100%",
          width: `${clampedPercent}%`,
        }}
      />
    </View>
  );
}
