import { Pressable } from "react-native";
import { formatMonthChip, shiftMonthYear, } from "../domain/services/financeView";
import { useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
// Month selection is visually identical on Dashboard and Budgets.
export function MonthChip({ label, onPress }) {
    const theme = useTheme();
    const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
    const setSelectedMonthYear = useFinanceStore((state) => state.setSelectedMonthYear);
    const resolvedLabel = label ?? formatMonthChip(selectedMonthYear);
    const handlePress = onPress ??
        (() => {
            setSelectedMonthYear(shiftMonthYear(selectedMonthYear, -1));
        });
    const handleLongPress = onPress === undefined
        ? () => {
            setSelectedMonthYear(shiftMonthYear(selectedMonthYear, 1));
        }
        : undefined;
    return (<Pressable accessibilityHint="Tap for previous month. Long press for next month." accessibilityLabel={`Selected month ${resolvedLabel}`} accessibilityRole="button" onLongPress={handleLongPress} onPress={handlePress} style={{
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.chip,
            borderWidth: theme.spacing.hairline,
            flexDirection: "row",
            gap: theme.spacing.compact,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
        }}>
      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
        {resolvedLabel}
      </Text>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
        ▾
      </Text>
    </Pressable>);
}
