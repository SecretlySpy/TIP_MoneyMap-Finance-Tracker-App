import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BottomSheet } from "../components/BottomSheet";
import { PrimaryButton } from "../components/Buttons";
import { Chip } from "../components/Chip";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { categoryEmoji, resolveDisplayEmoji } from "../domain/services/emoji";
import { categoriesForType } from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import { listAccountChips, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function EditTransactionScreen({ navigation, route }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.categories);
  const accounts = useFinanceStore((state) => state.accounts);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);

  const transactionId = Number(route?.params?.transactionId);
  const transaction = transactions.find((item) => item.id === transactionId);

  // Missing record state
  if (!transaction) {
    return (
      <ScreenContainer contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} testID="edit-missing-transaction-screen">
        <View style={{ alignItems: "center", gap: theme.spacing.lg, justifyContent: "center", paddingVertical: theme.spacing.xxl }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.avatarBg,
              borderRadius: theme.radii.round,
              height: 64,
              justifyContent: "center",
              width: 64,
            }}
          >
            <Text style={{ fontSize: 32 }}>⚠️</Text>
          </View>
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.screenTitle,
              textAlign: "center",
            }}
          >
            Transaction unavailable
          </Text>
          <Text
            style={{
              color: theme.colors.sub,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.body,
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            This transaction could not be found. It may have been deleted.
          </Text>
          <PrimaryButton onPress={() => navigation.goBack()} style={{ marginTop: theme.spacing.md }}>
            Back to History
          </PrimaryButton>
        </View>
      </ScreenContainer>
    );
  }

  const isRecurring = transaction.recurringRuleId !== null;

  // Form State
  const [type, setType] = useState(transaction.type);
  const [amountStr, setAmountStr] = useState(
    (transaction.amountMinor / 100).toFixed(2).replace(/\.00$/, ""),
  );
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [accountId, setAccountId] = useState(transaction.accountId);
  const [dateEpochMillis, setDateEpochMillis] = useState(transaction.dateEpochMillis);
  const [note, setNote] = useState(transaction.note ?? "");

  // Sheets and Status
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Calendar State for Date Picker Sheet (Frame 18c)
  const initialDate = new Date(dateEpochMillis);
  const [calYear, setCalYear] = useState(initialDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initialDate.getMonth());
  const [tempSelectedDate, setTempSelectedDate] = useState(dateEpochMillis);

  const typeCategories = useMemo(
    () => categoriesForType(categories, type),
    [categories, type],
  );
  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived || a.id === accountId),
    [accounts, accountId],
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  const displayEmoji = selectedCategory
    ? resolveDisplayEmoji({ icon: selectedCategory.icon, name: selectedCategory.name })
    : categoryEmoji("Other");

  const formattedDate = new Date(dateEpochMillis).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Calendar days calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [calYear, calMonth]);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day) => {
    if (!day) return;
    const newDate = new Date(calYear, calMonth, day, 12, 0, 0, 0);
    setTempSelectedDate(newDate.getTime());
  };

  const handleConfirmDate = () => {
    setDateEpochMillis(tempSelectedDate);
    setDatePickerVisible(false);
  };

  const handleSave = async () => {
    const cleaned = amountStr.trim().replace(/[₱$,\s]/g, "");
    const amountMinor = parseDecimalToMinor(cleaned);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setSaveError("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await updateTransaction(transaction.id, {
        amountMinor,
        type,
        categoryId,
        accountId,
        dateEpochMillis: isRecurring ? undefined : dateEpochMillis,
        note: note.trim() || null,
      });
      navigation.goBack();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save transaction changes.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.xl }} testID="edit-transaction-screen">
      {/* Top Header */}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          accessibilityLabel="Cancel edit"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => navigation.goBack()}
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.round,
            borderWidth: 1,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 18 }}>
            ‹
          </Text>
        </Pressable>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.screenTitle,
          }}
        >
          Edit Transaction
        </Text>
        <Pressable
          accessibilityLabel="Save transaction changes"
          accessibilityRole="button"
          disabled={isSaving}
          hitSlop={theme.spacing.md}
          onPress={handleSave}
        >
          <Text
            style={{
              color: isSaving ? theme.colors.sub : theme.colors.primary,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
            }}
          >
            {isSaving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      {/* Frame 18h: Retained Draft on Save Failure Alert */}
      {saveError !== null ? (
        <View
          style={{
            backgroundColor: theme.colors.amberBg,
            borderColor: theme.colors.warning,
            borderRadius: theme.radii.card,
            borderWidth: 1,
            gap: theme.spacing.xs,
            padding: theme.spacing.md,
          }}
          testID="save-error-banner"
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.xs }}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text
              style={{
                color: theme.colors.amberText,
                fontFamily: theme.fonts.bold,
                fontSize: theme.typeScale.body,
              }}
            >
              Could not save changes
            </Text>
          </View>
          <Text
            style={{
              color: theme.colors.amberText,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typeScale.small,
              lineHeight: 18,
            }}
          >
            {saveError}. Your edits are still here. Review and try again.
          </Text>
        </View>
      ) : null}

      {/* Expense / Income Type Toggle */}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
          borderRadius: theme.radii.chip,
          borderWidth: 1,
          flexDirection: "row",
          padding: theme.spacing.xs,
        }}
      >
        <Pressable
          accessibilityLabel="Expense type"
          accessibilityRole="button"
          onPress={() => {
            setType("EXPENSE");
            // If current category is not expense, switch to first expense category
            const expenseCats = categoriesForType(categories, "EXPENSE");
            if (!expenseCats.some((c) => c.id === categoryId) && expenseCats.length > 0) {
              setCategoryId(expenseCats[0].id);
            }
          }}
          style={{
            alignItems: "center",
            backgroundColor: type === "EXPENSE" ? theme.colors.expense : "transparent",
            borderRadius: theme.radii.chip,
            flex: 1,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <Text
            style={{
              color: type === "EXPENSE" ? theme.colors.onPrimary : theme.colors.sub,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
            }}
          >
            Expense
          </Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Income type"
          accessibilityRole="button"
          onPress={() => {
            setType("INCOME");
            // If current category is not income, switch to first income category
            const incomeCats = categoriesForType(categories, "INCOME");
            if (!incomeCats.some((c) => c.id === categoryId) && incomeCats.length > 0) {
              setCategoryId(incomeCats[0].id);
            }
          }}
          style={{
            alignItems: "center",
            backgroundColor: type === "INCOME" ? theme.colors.income : "transparent",
            borderRadius: theme.radii.chip,
            flex: 1,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <Text
            style={{
              color: type === "INCOME" ? theme.colors.onPrimary : theme.colors.sub,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
            }}
          >
            Income
          </Text>
        </Pressable>
      </View>

      {/* Amount Input */}
      <SectionCard style={{ gap: theme.spacing.xs, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Amount
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
          <Text
            style={{
              color: type === "EXPENSE" ? theme.colors.expense : theme.colors.income,
              fontFamily: theme.fonts.bold,
              fontSize: 32,
            }}
          >
            {currencySymbol}
          </Text>
          <TextInput
            accessibilityLabel="Transaction amount"
            keyboardType="decimal-pad"
            onChangeText={(val) => setAmountStr(val)}
            placeholder="0.00"
            placeholderTextColor={theme.colors.sub}
            style={{
              color: theme.colors.text,
              flex: 1,
              fontFamily: theme.fonts.bold,
              fontSize: 32,
              padding: 0,
            }}
            value={amountStr}
          />
        </View>
      </SectionCard>

      {/* Date Field & Frame 18f Recurring Guard */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Date
          </Text>
          {isRecurring ? (
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderRadius: theme.radii.chip,
                flexDirection: "row",
                gap: theme.spacing.xs,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xxs,
              }}
            >
              <Text style={{ fontSize: 12 }}>🔒</Text>
              <Text
                style={{
                  color: theme.colors.sub,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.small,
                }}
              >
                Locked
              </Text>
            </View>
          ) : null}
        </View>

        {isRecurring ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              {formattedDate}
            </Text>
            {/* Frame 18f Banner */}
            <View
              style={{
                backgroundColor: theme.colors.amberBg,
                borderColor: theme.colors.warning,
                borderRadius: theme.radii.card,
                borderWidth: 1,
                gap: theme.spacing.xxs,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                Recurring transaction date is locked
              </Text>
              <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small, lineHeight: 18 }}>
                To protect the generation schedule of this recurring bill, the date of this occurrence cannot be changed.
              </Text>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityLabel={`Change date, currently ${formattedDate}`}
            accessibilityRole="button"
            onPress={() => {
              setCalYear(new Date(dateEpochMillis).getFullYear());
              setCalMonth(new Date(dateEpochMillis).getMonth());
              setTempSelectedDate(dateEpochMillis);
              setDatePickerVisible(true);
            }}
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: theme.spacing.xs,
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
              <Text style={{ fontSize: 18 }}>📅</Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {formattedDate}
              </Text>
            </View>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
              Change ›
            </Text>
          </Pressable>
        )}
      </SectionCard>

      {/* Category Selector */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
          Category
        </Text>
        <Pressable
          accessibilityLabel={`Category: ${selectedCategory?.name ?? "Other"}`}
          accessibilityRole="button"
          onPress={() => setCategoryPickerVisible(true)}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: theme.spacing.xs,
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderRadius: theme.radii.round,
                height: 36,
                justifyContent: "center",
                width: 36,
              }}
            >
              <Text style={{ fontSize: 18 }}>{displayEmoji}</Text>
            </View>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              {selectedCategory?.name ?? "Other"}
            </Text>
          </View>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Choose ›
          </Text>
        </Pressable>
      </SectionCard>

      {/* Account Selector */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
          Account
        </Text>
        <Pressable
          accessibilityLabel={`Account: ${selectedAccount?.name ?? "Account"}`}
          accessibilityRole="button"
          onPress={() => setAccountPickerVisible(true)}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: theme.spacing.xs,
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderRadius: theme.radii.round,
                height: 36,
                justifyContent: "center",
                width: 36,
              }}
            >
              <Text style={{ fontSize: 16 }}>💳</Text>
            </View>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              {selectedAccount?.name ?? "Account"}
            </Text>
          </View>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            Choose ›
          </Text>
        </Pressable>
      </SectionCard>

      {/* Note Input */}
      <SectionCard style={{ gap: theme.spacing.xs, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Note (optional)
        </Text>
        <TextInput
          accessibilityLabel="Transaction note"
          maxLength={150}
          multiline
          numberOfLines={2}
          onChangeText={(val) => setNote(val)}
          placeholder="Add a note or memo…"
          placeholderTextColor={theme.colors.sub}
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.regular,
            fontSize: theme.typeScale.body,
            minHeight: 48,
            padding: 0,
          }}
          value={note}
        />
      </SectionCard>

      {/* Save Button */}
      <PrimaryButton
        accessibilityLabel="Save changes"
        disabled={isSaving}
        onPress={handleSave}
        style={{ marginBottom: theme.spacing.xxl, marginTop: theme.spacing.sm }}
      >
        {isSaving ? "Saving changes…" : "Save Changes"}
      </PrimaryButton>

      {/* Frame 18c: Date Picker BottomSheet */}
      <BottomSheet
        onClose={() => setDatePickerVisible(false)}
        testID="date-picker-sheet"
        title="Select Date"
        visible={datePickerVisible}
      >
        <View style={{ gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
          {/* Calendar Header with Navigation */}
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              hitSlop={theme.spacing.md}
              onPress={handlePrevMonth}
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderRadius: theme.radii.round,
                height: 36,
                justifyContent: "center",
                width: 36,
              }}
            >
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 16 }}>‹</Text>
            </Pressable>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
              {MONTH_NAMES[calMonth]} {calYear}
            </Text>
            <Pressable
              accessibilityLabel="Next month"
              accessibilityRole="button"
              hitSlop={theme.spacing.md}
              onPress={handleNextMonth}
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderRadius: theme.radii.round,
                height: 36,
                justifyContent: "center",
                width: 36,
              }}
            >
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 16 }}>›</Text>
            </Pressable>
          </View>

          {/* Weekday Labels */}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {DAYS_OF_WEEK.map((day, idx) => (
              <View key={idx} style={{ alignItems: "center", width: 40 }}>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Day Grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start" }}>
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <View key={idx} style={{ height: 40, width: "14.28%" }} />;
              }
              const dayDate = new Date(calYear, calMonth, day, 12, 0, 0, 0).getTime();
              const isSelected =
                new Date(tempSelectedDate).getFullYear() === calYear &&
                new Date(tempSelectedDate).getMonth() === calMonth &&
                new Date(tempSelectedDate).getDate() === day;

              return (
                <Pressable
                  key={idx}
                  accessibilityLabel={`${MONTH_NAMES[calMonth]} ${day}, ${calYear}`}
                  accessibilityRole="button"
                  onPress={() => handleSelectDay(day)}
                  style={{
                    alignItems: "center",
                    height: 40,
                    justifyContent: "center",
                    width: "14.28%",
                  }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: isSelected ? theme.colors.primary : "transparent",
                      borderRadius: theme.radii.round,
                      height: 34,
                      justifyContent: "center",
                      width: 34,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected
                          ? theme.mode === "dark" ? theme.colors.onAccent : theme.colors.onPrimary
                          : theme.colors.text,
                        fontFamily: isSelected ? theme.fonts.bold : theme.fonts.regular,
                        fontSize: theme.typeScale.body,
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Bottom Action Button */}
          <PrimaryButton
            accessibilityLabel={`Use ${new Date(tempSelectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
            onPress={handleConfirmDate}
            style={{ marginTop: theme.spacing.sm }}
          >
            {`Use ${new Date(tempSelectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
          </PrimaryButton>
        </View>
      </BottomSheet>

      {/* Category Picker BottomSheet */}
      <BottomSheet
        onClose={() => setCategoryPickerVisible(false)}
        testID="category-picker-sheet"
        title="Select Category"
        visible={categoryPickerVisible}
      >
        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}>
          {typeCategories.map((cat) => {
            const isSelected = cat.id === categoryId;
            const emoji = resolveDisplayEmoji({ icon: cat.icon, name: cat.name });
            return (
              <Chip
                key={cat.id}
                onPress={() => {
                  setCategoryId(cat.id);
                  setCategoryPickerVisible(false);
                }}
                selected={isSelected}
              >
                {emoji} {cat.name}
              </Chip>
            );
          })}
        </ScrollView>
      </BottomSheet>

      {/* Account Picker BottomSheet */}
      <BottomSheet
        onClose={() => setAccountPickerVisible(false)}
        testID="account-picker-sheet"
        title="Select Account"
        visible={accountPickerVisible}
      >
        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}>
          {activeAccounts.map((acc) => {
            const isSelected = acc.id === accountId;
            return (
              <Chip
                key={acc.id}
                onPress={() => {
                  setAccountId(acc.id);
                  setAccountPickerVisible(false);
                }}
                selected={isSelected}
              >
                {acc.name}{acc.isArchived ? " (archived)" : ""}
              </Chip>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </ScreenContainer>
  );
}
