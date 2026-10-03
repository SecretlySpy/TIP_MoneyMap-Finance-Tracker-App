import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import { formatMonthChip, toMonthYear } from "../domain/services/financeView";
import { useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { CalendarPickerSheet } from "./CalendarPickerSheet";

function periodDate(monthYear) {
    const [yearText, monthText] = monthYear.split("-");
    const year = Number(yearText);
    const month = Number(monthText) - 1;
    if (!Number.isInteger(year) || month < 0 || month > 11) {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0).getTime();
    }
    return new Date(year, month, 1, 12, 0, 0, 0).getTime();
}

// One explicit period control replaces the former undiscoverable tap/long-press shortcuts.
export function MonthChip({ label, onPress }) {
    const theme = useTheme();
    const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
    const setSelectedMonthYear = useFinanceStore((state) => state.setSelectedMonthYear);
    const resolvedLabel = label ?? formatMonthChip(selectedMonthYear);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => periodDate(selectedMonthYear));

    useEffect(() => {
        setSelectedDate((current) => toMonthYear(new Date(current)) === selectedMonthYear
            ? current
            : periodDate(selectedMonthYear));
    }, [selectedMonthYear]);

    return (<>
      <Pressable
        accessibilityHint="Opens period calendar with previous, next, and direct month and year controls."
        accessibilityLabel={`Selected month ${resolvedLabel}`}
        accessibilityRole="button"
        onPress={onPress ?? (() => setCalendarVisible(true))}
        style={{
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.chip,
            borderWidth: theme.spacing.hairline,
            flexDirection: "row",
            gap: theme.spacing.compact,
            minHeight: 44,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
        }}
      >
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          {resolvedLabel}
        </Text>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
          ▾
        </Text>
      </Pressable>
      {onPress === undefined ? (
        <CalendarPickerSheet
          onClose={() => setCalendarVisible(false)}
          onConfirm={(epochMillis) => {
              setSelectedDate(epochMillis);
              setSelectedMonthYear(toMonthYear(new Date(epochMillis)));
              setCalendarVisible(false);
          }}
          selectedDateEpochMillis={selectedDate}
          testID="period-calendar-sheet"
          title="Select budget period"
          visible={calendarVisible}
        />
      ) : null}
    </>);
}
