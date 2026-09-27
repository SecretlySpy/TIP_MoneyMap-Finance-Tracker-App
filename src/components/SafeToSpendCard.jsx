import { Pressable, View } from "react-native";
import { formatMinor } from "../domain/services/money";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { SectionCard } from "./SectionCard";

/**
 * Figma 03 Dashboard "Safe to Spend" card: label + headroom/bill/goal formula
 * on one row, the safe amount below, and an optional due-bill reminder pill.
 * @param {{
 *   safeMinor: number,
 *   state: 'comfortable'|'tight'|'over'|'unset',
 *   currencySymbol: string,
 *   remainingBudgetsMinor: number,
 *   upcomingRecurringMinor: number,
 *   upcomingRecurringCount?: number,
 *   goalReservesMinor: number,
 *   goalReserveCount?: number,
 *   overCommittedMinor: number,
 *   reminderText?: string|null,
 *   onReminderPress?: () => void,
 * }} props
 */
export function SafeToSpendCard({
  safeMinor,
  state,
  currencySymbol,
  remainingBudgetsMinor,
  upcomingRecurringMinor,
  upcomingRecurringCount = 0,
  goalReservesMinor,
  goalReserveCount = 0,
  overCommittedMinor,
  reminderText = null,
  onReminderPress,
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
  const money = (minor) => formatMinor(minor, { currencySymbol, showCents: false });
  const formulaParts = [`${money(remainingBudgetsMinor)} headroom`];
  if (upcomingRecurringMinor > 0) {
    formulaParts.push(`${money(upcomingRecurringMinor)} bill${upcomingRecurringCount === 1 ? "" : "s"}`);
  }
  if (goalReservesMinor > 0) {
    formulaParts.push(`${money(goalReservesMinor)} goal${goalReserveCount === 1 ? "" : "s"}`);
  }

  return (
    <SectionCard
      shadowed
      style={{
        backgroundColor: theme.colors.surface,
        gap: theme.spacing.sm,
        borderColor: theme.colors.outline,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
          SAFE TO SPEND
        </Text>
        {state !== "unset" ? (
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.sub,
              flexShrink: 1,
              fontFamily: theme.fonts.medium,
              fontSize: theme.typeScale.small,
              textAlign: "right",
            }}
          >
            {formulaParts.join(" − ")}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: amountColor,
          fontFamily: theme.fonts.bold,
          fontSize: theme.typeScale.heroAmount,
        }}
      >
        {state === "unset" ? "—" : money(Math.max(0, safeMinor))}
      </Text>
      {state === "unset" ? (
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          Add a monthly budget and this shows what is left to spend.
        </Text>
      ) : null}
      {state === "tight" ? (
        <Text style={{ color: theme.colors.warning, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.tiny }}>
          Spend carefully — little headroom left this month.
        </Text>
      ) : null}
      {state === "over" && overCommittedMinor > 0 ? (
        <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.tiny }}>
          Commitments exceed this month&apos;s budget by {money(overCommittedMinor)}.
        </Text>
      ) : null}
      {reminderText ? (
        <Pressable
          accessibilityRole="button"
          onPress={onReminderPress}
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.amberBg,
            borderRadius: theme.radii.row,
            flexDirection: "row",
            gap: theme.spacing.sm,
            marginTop: theme.spacing.xs,
            minHeight: theme.sizes.secondaryButton,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>🔔</Text>
          <Text style={{ color: theme.colors.amberText, flex: 1, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
            {reminderText}
          </Text>
        </Pressable>
      ) : null}
    </SectionCard>
  );
}
