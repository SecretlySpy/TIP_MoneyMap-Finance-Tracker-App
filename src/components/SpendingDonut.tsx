import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { formatMinor } from "../domain/services/money";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";

export interface DonutSegment {
  readonly color: string;
  readonly label: string;
  readonly percent: number;
}

interface SpendingDonutProps {
  readonly segments: readonly DonutSegment[];
  readonly totalMinor: number;
}

// A circular O(n) accumulation maps category percentages to non-overlapping arcs.
export function SpendingDonut({ segments, totalMinor }: SpendingDonutProps) {
  const theme = useTheme();
  const radius = 50;
  const center = theme.sizes.donut / 2;
  const circumference = 2 * Math.PI * radius;
  let consumedPercent = 0;

  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.hero, width: "100%" }}>
      <View style={{ height: theme.sizes.donut, width: theme.sizes.donut }}>
        <Svg height={theme.sizes.donut} width={theme.sizes.donut}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            {segments.map((segment) => {
              const dashLength = (segment.percent / 100) * circumference;
              const dashOffset = -(consumedPercent / 100) * circumference;
              consumedPercent += segment.percent;
              return (
                <Circle
                  cx={center}
                  cy={center}
                  fill="none"
                  key={segment.label}
                  r={radius}
                  stroke={segment.color}
                  strokeDasharray={[dashLength, circumference - dashLength]}
                  strokeDashoffset={dashOffset}
                  strokeWidth={20}
                />
              );
            })}
          </G>
        </Svg>
        <View
          pointerEvents="none"
          style={{ alignItems: "center", bottom: 0, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 0 }}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.listName }}>
            {formatMinor(totalMinor, { showCents: false })}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: theme.spacing.keyGap }}>
        {segments.map((segment) => (
          <View key={segment.label} style={{ alignItems: "center", flexDirection: "row" }}>
            <View
              style={{ backgroundColor: segment.color, borderRadius: theme.radii.round, height: 10, marginRight: theme.spacing.md, width: 10 }}
            />
            <Text style={{ color: theme.colors.text, flex: 1, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              {segment.label}
            </Text>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              {segment.percent}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
