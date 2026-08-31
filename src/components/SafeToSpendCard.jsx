import { View } from "react-native";
import { formatMinor } from "../domain/services/money";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { SectionCard } from "./SectionCard";

/**
 * @param {{
 *   safeMinor: number,
 *   state: 'comfortable'|'tight'|'over'|'unset',
 *   currencySymbol: string,
 *   remainingBudgetsMinor: number,
 *   upcomingRecurringMinor: number,
 *   goalReservesMinor: number,
 * }} props
 */
export function SafeToSpendCard({
  safeMinor,
  state,
  currencySymbol,
  remainingBudgetsMinor,
  upcomingRecurringMinor,
  goalReservesMinor,
}) {
  const theme = useTheme();
  const amountColor =
    state === "over"
      ? theme.colors.expense
      : state === "tight"
        ? theme.colors.warning
        : state === "unset"
          ? theme.colors.sub
          : theme.colors.income;
  const headline =
    state === "over"
      ? "Over committed"
      : state === "tight"
        ? "Spend carefully"
        : state === "unset"
          ? "Set a budget to see this"
          : "Safe to spend";

  return (
    <SectionCard
      shadowed
      style={{
        backgroundColor: theme.colors.surface,
        gap: theme.spacing.sm,
        borderColor: theme.colors.outline,
      }}
    >
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
        SAFE TO SPEND
      </Text>
      <Text
        style={{
          color: amountColor,
          fontFamily: theme.fonts.bold,
          fontSize: theme.typeScale.heroAmount,
        }}
      >
        {state === "unset"
          ? "—"
          : formatMinor(Math.max(0, safeMinor), { currencySymbol, showCents: false })}
      </Text>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
        {state === "unset"
          ? "Add a monthly budget and this shows what is left to spend."
          : `After budgets, bills & goals · ${headline}`}
      </Text>
      <View style={{ gap: theme.spacing.xxs, marginTop: theme.spacing.xs }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>
          Budgets left {formatMinor(remainingBudgetsMinor, { currencySymbol, showCents: false })}
          {" · Bills "}
          {formatMinor(upcomingRecurringMinor, { currencySymbol, showCents: false })}
          {" · Goals "}
          {formatMinor(goalReservesMinor, { currencySymbol, showCents: false })}
        </Text>
      </View>
    </SectionCard>
  );
}
