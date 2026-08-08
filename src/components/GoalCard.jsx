import { Pressable, View } from "react-native";
import { formatMinor } from "../domain/services/money";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { ProgressBar } from "./ProgressBar";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function deadlineLabel(epochMillis) {
  if (epochMillis == null) {
    return null;
  }
  const d = new Date(epochMillis);
  return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * @param {{
 *   name: string,
 *   currentMinor: number,
 *   targetMinor: number,
 *   progressPercent: number,
 *   deadlineEpochMillis?: number|null,
 *   isComplete?: boolean,
 *   isOverdue?: boolean,
 *   currencySymbol?: string,
 *   onContribute?: () => void,
 * }} props
 */
export function GoalCard({
  name,
  currentMinor,
  targetMinor,
  progressPercent,
  deadlineEpochMillis = null,
  isComplete = false,
  isOverdue = false,
  currencySymbol,
  onContribute,
}) {
  const theme = useTheme();
  const storeSymbol = useUiStore((s) => s.currencySymbol);
  const symbol = currencySymbol ?? storeSymbol;
  const barColor = isComplete
    ? theme.colors.income
    : isOverdue
      ? theme.colors.expense
      : progressPercent >= 80
        ? theme.colors.warning
        : theme.colors.primary;
  const due = deadlineLabel(deadlineEpochMillis);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.text,
            flex: 1,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.body,
          }}
        >
          {isComplete ? "✅ " : "🎯 "}
          {name}
        </Text>
        {onContribute && !isComplete ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.spacing.sm}
            onPress={onContribute}
            style={{ minHeight: 44, justifyContent: "center", paddingLeft: theme.spacing.md }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
              Contribute
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
        {formatMinor(currentMinor, { currencySymbol: symbol, showCents: false })}
        {" / "}
        {formatMinor(targetMinor, { currencySymbol: symbol, showCents: false })}
        {due ? ` · due ${due}` : ""}
        {isOverdue ? " · overdue" : ""}
      </Text>
      <ProgressBar color={barColor} percent={progressPercent} />
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.tiny }}>
        {Math.min(progressPercent, 999)}%
        {isComplete ? " — complete" : ""}
      </Text>
    </View>
  );
}
