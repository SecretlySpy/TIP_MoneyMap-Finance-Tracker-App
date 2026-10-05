import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import { PrimaryButton } from "./Buttons";

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

function localNoon(year, month, day) {
  return new Date(year, month, day, 12, 0, 0, 0).getTime();
}

function safeSelectedDate(epochMillis) {
  const date = new Date(epochMillis);
  if (!Number.isSafeInteger(epochMillis) || Number.isNaN(date.getTime())) {
    const today = new Date();
    return localNoon(today.getFullYear(), today.getMonth(), today.getDate());
  }
  return localNoon(date.getFullYear(), date.getMonth(), date.getDate());
}

function moveDateToMonth(epochMillis, year, month) {
  const current = new Date(epochMillis);
  const lastDay = new Date(year, month + 1, 0).getDate();
  return localNoon(year, month, Math.min(current.getDate(), lastDay));
}

/**
 * Date-only calendar used by transaction entry/edit and monthly budget selection.
 * Local noon avoids date rollover while the database continues to store epoch millis.
 */
export function CalendarPickerSheet({
  onClose,
  onConfirm,
  selectedDateEpochMillis,
  testID = "date-picker-sheet",
  title = "Select date",
  visible,
}) {
  const theme = useTheme();
  const initialDate = safeSelectedDate(selectedDateEpochMillis);
  const initial = new Date(initialDate);
  const [pendingDate, setPendingDate] = useState(initialDate);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [yearInput, setYearInput] = useState(String(initial.getFullYear()));
  const [showMonthYear, setShowMonthYear] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const normalized = safeSelectedDate(selectedDateEpochMillis);
    const date = new Date(normalized);
    setPendingDate(normalized);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setYearInput(String(date.getFullYear()));
    setShowMonthYear(false);
  }, [selectedDateEpochMillis, visible]);

  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [viewMonth, viewYear]);

  const selectViewMonth = (year, month) => {
    const boundedYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
    setViewYear(boundedYear);
    setViewMonth(month);
    setYearInput(String(boundedYear));
    setPendingDate((current) => moveDateToMonth(current, boundedYear, month));
  };

  const shiftMonth = (delta) => {
    const target = new Date(viewYear, viewMonth + delta, 1, 12, 0, 0, 0);
    const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, target.getFullYear()));
    const month = year === target.getFullYear()
      ? target.getMonth()
      : (delta < 0 ? 0 : 11);
    selectViewMonth(year, month);
  };

  const selected = new Date(pendingDate);
  const confirmLabel = selected.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <BottomSheet onClose={onClose} testID={testID} title={title} visible={visible}>
      <View style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable
            accessibilityLabel="Previous month"
            accessibilityRole="button"
            disabled={viewYear === MIN_YEAR && viewMonth === 0}
            hitSlop={theme.spacing.sm}
            onPress={() => shiftMonth(-1)}
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.avatarBg,
              borderRadius: theme.radii.round,
              height: 44,
              justifyContent: "center",
              opacity: viewYear === MIN_YEAR && viewMonth === 0 ? 0.45 : 1,
              width: 44,
            }}
          >
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityHint="Choose a month and enter a year directly"
            accessibilityLabel={`Choose month and year, currently ${MONTH_NAMES[viewMonth]} ${viewYear}`}
            accessibilityRole="button"
            onPress={() => setShowMonthYear((current) => !current)}
            style={{ alignItems: "center", minHeight: 44, paddingHorizontal: theme.spacing.md, justifyContent: "center" }}
          >
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
              {MONTH_NAMES[viewMonth]} {viewYear} ▾
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            disabled={viewYear === MAX_YEAR && viewMonth === 11}
            hitSlop={theme.spacing.sm}
            onPress={() => shiftMonth(1)}
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.avatarBg,
              borderRadius: theme.radii.round,
              height: 44,
              justifyContent: "center",
              opacity: viewYear === MAX_YEAR && viewMonth === 11 ? 0.45 : 1,
              width: 44,
            }}
          >
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 18 }}>›</Text>
          </Pressable>
        </View>

        {showMonthYear ? (
          <View style={{ gap: theme.spacing.sm }} testID={`${testID}-month-year-controls`}>
            <TextInput
              accessibilityLabel="Calendar year"
              keyboardType="number-pad"
              maxLength={4}
              onBlur={() => setYearInput(String(viewYear))}
              onChangeText={(value) => {
                const digits = value.replace(/\D/g, "").slice(0, 4);
                setYearInput(digits);
                const year = Number(digits);
                if (digits.length === 4 && year >= MIN_YEAR && year <= MAX_YEAR) {
                  selectViewMonth(year, viewMonth);
                }
              }}
              style={{
                backgroundColor: theme.colors.bg,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.row,
                borderWidth: 1,
                color: theme.colors.text,
                fontFamily: theme.fonts.medium,
                fontSize: theme.typeScale.body,
                height: 44,
                paddingHorizontal: theme.spacing.md,
              }}
              value={yearInput}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {MONTH_NAMES.map((monthName, month) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: month === viewMonth }}
                  key={monthName}
                  onPress={() => {
                    selectViewMonth(viewYear, month);
                    setShowMonthYear(false);
                  }}
                  style={{
                    alignItems: "center",
                    backgroundColor: month === viewMonth ? theme.colors.tint : theme.colors.surface,
                    borderColor: month === viewMonth ? theme.colors.primary : theme.colors.outline,
                    borderRadius: theme.radii.chip,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 44,
                    width: "31%",
                  }}
                >
                  <Text style={{
                    color: month === viewMonth ? theme.colors.primary : theme.colors.sub,
                    fontFamily: month === viewMonth ? theme.fonts.bold : theme.fonts.medium,
                    fontSize: theme.typeScale.small,
                  }}>
                    {monthName.slice(0, 3)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row" }}>
              {DAYS_OF_WEEK.map((day, index) => (
                <View key={`${day}-${index}`} style={{ alignItems: "center", width: "14.2857%" }}>
                  <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={{ height: 44, width: "14.2857%" }} />;
                }
                const isSelected = selected.getFullYear() === viewYear
                  && selected.getMonth() === viewMonth
                  && selected.getDate() === day;
                return (
                  <Pressable
                    accessibilityLabel={`${MONTH_NAMES[viewMonth]} ${day}, ${viewYear}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={`${viewYear}-${viewMonth}-${day}`}
                    onPress={() => setPendingDate(localNoon(viewYear, viewMonth, day))}
                    style={{ alignItems: "center", height: 44, justifyContent: "center", width: "14.2857%" }}
                  >
                    <View style={{
                      alignItems: "center",
                      backgroundColor: isSelected ? theme.colors.primary : "transparent",
                      borderRadius: theme.radii.round,
                      height: 36,
                      justifyContent: "center",
                      width: 36,
                    }}>
                      <Text style={{
                        color: isSelected
                          ? (theme.mode === "dark" ? theme.colors.onAccent : theme.colors.onPrimary)
                          : theme.colors.text,
                        fontFamily: isSelected ? theme.fonts.bold : theme.fonts.regular,
                        fontSize: theme.typeScale.body,
                      }}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <PrimaryButton
          accessibilityLabel={`Choose ${confirmLabel}`}
          onPress={() => onConfirm(pendingDate)}
          style={{ marginTop: theme.spacing.sm }}
        >
          {`Choose ${confirmLabel}`}
        </PrimaryButton>
      </View>
    </BottomSheet>
  );
}

