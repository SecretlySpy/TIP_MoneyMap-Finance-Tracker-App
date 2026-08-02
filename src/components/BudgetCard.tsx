import { View } from "react-native";

import { formatMinor } from "../domain/services/money";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { ProgressBar } from "./ProgressBar";
import { SectionCard } from "./SectionCard";

export type BudgetState = "normal" | "warning" | "over";

export interface BudgetCardProps {
  readonly emoji: string;
  readonly limitMinor: number;
  readonly name: string;
  readonly percent: number;
  readonly spentMinor: number;
  readonly state: BudgetState;
}

function statusText(percent: number, state: BudgetState): string {
  if (state === "warning") return `${percent}% — approaching limit`;
  if (state === "over") return `${percent}% — over budget`;
  return `${percent}%`;
}

// Budget state selects one semantic color while reported percentages remain unclamped.
export function BudgetCard({ emoji, limitMinor, name, percent, spentMinor, state }: BudgetCardProps) {
  const theme = useTheme();
  const stateColor =
    state === "warning"
      ? theme.colors.warning
      : state === "over"
        ? theme.colors.expense
        : theme.colors.primary;

  return (
    <SectionCard style={{ gap: theme.spacing.keyGap }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
        <Text style={{ fontFamily: theme.fonts.regular, fontSize: 17 }}>{emoji}</Text>
        <Text
          style={{ color: theme.colors.text, flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.listName }}
        >
          {name}
        </Text>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          {formatMinor(spentMinor, { showCents: false })} / {formatMinor(limitMinor, { showCents: false })}
        </Text>
      </View>
      <ProgressBar color={stateColor} percent={percent} />
      <Text style={{ color: stateColor, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
        {statusText(percent, state)}
      </Text>
    </SectionCard>
  );
}
