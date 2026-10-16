import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BottomSheet } from "../components/BottomSheet";
import { PrimaryButton } from "../components/Buttons";
import { CalendarPickerSheet } from "../components/CalendarPickerSheet";
import { Chip } from "../components/Chip";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { categoryEmoji, resolveDisplayEmoji } from "../domain/services/emoji";
import { accountChipLabel, categoriesForType, computeAccountBalances } from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import { listAccountChips, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

function MissingTransactionView({ navigation, theme }) {
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

function MissingTransferView({ navigation, theme }) {
  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} testID="edit-missing-transfer-screen">
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
          Transfer unavailable
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
          This transfer could not be found. It may have been deleted.
        </Text>
        <PrimaryButton onPress={() => navigation.goBack()} style={{ marginTop: theme.spacing.md }}>
          Back to History
        </PrimaryButton>
      </View>
    </ScreenContainer>
  );
}

export function EditTransactionScreen({ navigation, route }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const transactions = useFinanceStore((state) => state.transactions);
  const transfers = useFinanceStore((state) => state.transfers);
  const categories = useFinanceStore((state) => state.categories);
  const accounts = useFinanceStore((state) => state.accounts);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);
  const updateAccountTransfer = useFinanceStore((state) => state.updateAccountTransfer);

  const isTransfer = Boolean(route?.params?.isTransfer || route?.params?.transferId);
  const transferId = Number(route?.params?.transferId ?? route?.params?.transactionId);
  const transfer = isTransfer ? transfers.find((item) => item.id === transferId) : null;

  const transactionId = Number(route?.params?.transactionId);
  const transaction = !isTransfer ? transactions.find((item) => item.id === transactionId) : null;

  if (isTransfer) {
    if (!transfer) {
      return <MissingTransferView navigation={navigation} theme={theme} />;
    }
    return (
      <EditTransferForm
        accounts={accounts}
        currencySymbol={currencySymbol}
        navigation={navigation}
        theme={theme}
        transactions={transactions}
        transfer={transfer}
        transfers={transfers}
        updateAccountTransfer={updateAccountTransfer}
      />
    );
  }

  if (!transaction) {
    return <MissingTransactionView navigation={navigation} theme={theme} />;
  }

  return (
    <EditTransactionForm
      accounts={accounts}
      categories={categories}
      currencySymbol={currencySymbol}
      navigation={navigation}
      theme={theme}
      transaction={transaction}
      updateTransaction={updateTransaction}
    />
  );
}

function EditTransactionForm({
  transaction,
  navigation,
  theme,
  currencySymbol,
  categories,
  accounts,
  updateTransaction,
}) {
  const isRecurring = transaction.recurringRuleId !== null || transaction.scheduledDateEpochMillis !== null;

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
              color: type === "EXPENSE" ? (theme.mode === "dark" ? theme.colors.onAccent : theme.colors.onPrimary) : theme.colors.sub,
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
              color: type === "INCOME" ? (theme.mode === "dark" ? theme.colors.onAccent : theme.colors.onPrimary) : theme.colors.sub,
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
            onPress={() => setDatePickerVisible(true)}
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

      <CalendarPickerSheet
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(epochMillis) => {
          setDateEpochMillis(epochMillis);
          setDatePickerVisible(false);
        }}
        selectedDateEpochMillis={dateEpochMillis}
        testID="date-picker-sheet"
        title="Select Date"
        visible={datePickerVisible}
      />

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

function EditTransferForm({
  accounts,
  currencySymbol,
  navigation,
  theme,
  transactions,
  transfer,
  transfers,
  updateAccountTransfer,
}) {
  const [amountStr, setAmountStr] = useState(
    (transfer.amountMinor / 100).toFixed(2).replace(/\.00$/, ""),
  );
  const [fromAccountId, setFromAccountId] = useState(transfer.fromAccountId);
  const [toAccountId, setToAccountId] = useState(transfer.toAccountId);
  const [dateEpochMillis, setDateEpochMillis] = useState(transfer.dateEpochMillis);
  const [note, setNote] = useState(transfer.note ?? "");

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived || a.id === fromAccountId || a.id === toAccountId),
    [accounts, fromAccountId, toAccountId],
  );

  const parsedAmountMinor = useMemo(() => {
    try {
      const cleaned = amountStr.trim().replace(/[₱$,\s]/g, "");
      return parseDecimalToMinor(cleaned);
    } catch {
      return 0;
    }
  }, [amountStr]);

  const sameAccountError = fromAccountId === toAccountId;
  const canSave = parsedAmountMinor > 0 && !sameAccountError && !isSaving && fromAccountId !== null && toAccountId !== null;

  // Exact projected balance preview: exclude current transfer, then apply edited amounts
  const baseBalances = useMemo(() => {
    const transfersWithoutCurrent = transfers.filter((t) => t.id !== transfer.id);
    return computeAccountBalances(accounts, transactions, transfersWithoutCurrent);
  }, [accounts, transactions, transfers, transfer.id]);

  const fromBaseBalance = baseBalances.find((a) => a.id === fromAccountId)?.balanceMinor ?? 0;
  const toBaseBalance = baseBalances.find((a) => a.id === toAccountId)?.balanceMinor ?? 0;
  const fromProjectedBalance = fromBaseBalance - parsedAmountMinor;
  const toProjectedBalance = toBaseBalance + parsedAmountMinor;

  const fromAccountObj = accounts.find((a) => a.id === fromAccountId);
  const toAccountObj = accounts.find((a) => a.id === toAccountId);

  const formattedDate = new Date(dateEpochMillis).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleSave = async () => {
    if (!canSave) {
      if (sameAccountError) {
        setSaveError("Choose two different accounts.");
      } else if (parsedAmountMinor <= 0) {
        setSaveError("Please enter a valid amount greater than zero.");
      }
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await updateAccountTransfer(transfer.id, {
        amountMinor: parsedAmountMinor,
        fromAccountId,
        toAccountId,
        dateEpochMillis,
        note: note.trim() || null,
      });
      navigation.goBack();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save transfer changes.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.xl }} testID="edit-transfer-screen">
      {/* Header */}
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
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 18 }}>‹</Text>
        </Pressable>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.screenTitle,
          }}
        >
          Edit Transfer
        </Text>
        <Pressable
          accessibilityLabel="Save transfer changes"
          accessibilityRole="button"
          disabled={!canSave}
          hitSlop={theme.spacing.md}
          onPress={handleSave}
        >
          <Text
            style={{
              color: canSave ? theme.colors.primary : theme.colors.sub,
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

      {/* Phase 2 Frame 299:2782 / Transfer 01b: Same account error */}
      {sameAccountError ? (
        <View
          testID="same-account-error"
          style={{
            backgroundColor: theme.colors.avatarBg,
            borderColor: theme.colors.expense,
            borderRadius: theme.radii.row,
            borderWidth: 1,
            gap: theme.spacing.xs,
            padding: theme.spacing.md,
          }}
        >
          <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            Choose two different accounts
          </Text>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small, lineHeight: 18 }}>
            Same-account transfers are blocked. Negative balances are allowed and explained.
          </Text>
        </View>
      ) : null}

      {/* Amount Card */}
      <SectionCard style={{ gap: theme.spacing.xs, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Transfer Amount
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 32 }}>
            {currencySymbol}
          </Text>
          <TextInput
            accessibilityLabel="Transfer amount"
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

      {/* From Account */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
          From Account
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.keyGap }}>
          {activeAccounts.map((account) => (
            <Chip
              key={`from-${account.id}`}
              onPress={() => setFromAccountId(account.id)}
              selected={fromAccountId === account.id}
              style={{ height: theme.sizes.accountChip }}
              testID={`edit-from-account-${account.id}`}
            >
              {accountChipLabel(account.type)} · {account.name}
            </Chip>
          ))}
        </View>
      </SectionCard>

      {/* Swap Button */}
      <View style={{ alignItems: "center" }}>
        <Pressable
          accessibilityLabel="Swap accounts"
          accessibilityRole="button"
          hitSlop={theme.spacing.sm}
          onPress={() => {
            const temp = fromAccountId;
            setFromAccountId(toAccountId);
            setToAccountId(temp);
          }}
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.round,
            borderWidth: 1,
            flexDirection: "row",
            gap: theme.spacing.xs,
            minHeight: 44,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.xs,
          }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
            Swap accounts
          </Text>
        </Pressable>
      </View>

      {/* To Account */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
          To Account
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.keyGap }}>
          {activeAccounts.map((account) => (
            <Chip
              key={`to-${account.id}`}
              onPress={() => setToAccountId(account.id)}
              selected={toAccountId === account.id}
              style={{ height: theme.sizes.accountChip }}
              testID={`edit-to-account-${account.id}`}
            >
              {accountChipLabel(account.type)} · {account.name}
            </Chip>
          ))}
        </View>
      </SectionCard>

      {/* Date */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
          Date
        </Text>
        <Pressable
          accessibilityLabel={`Change date, currently ${formattedDate}`}
          accessibilityRole="button"
          onPress={() => setDatePickerVisible(true)}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 44,
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
      </SectionCard>

      {/* Note */}
      <SectionCard style={{ gap: theme.spacing.xs, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Note (optional)
        </Text>
        <TextInput
          accessibilityLabel="Transfer note"
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

      {/* Balance Preview Card */}
      <SectionCard
        style={{
          borderColor: theme.colors.outline,
          borderWidth: 1,
          gap: theme.spacing.xs,
          padding: theme.spacing.md,
        }}
      >
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny }}>
          POST-TRANSFER BALANCE PREVIEW
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.small }}>
            {fromAccountObj?.name ?? "From"}: {formatMinor(fromBaseBalance, { currencySymbol })} → {formatMinor(fromProjectedBalance, { currencySymbol })}
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.small }}>
            {toAccountObj?.name ?? "To"}: {formatMinor(toBaseBalance, { currencySymbol })} → {formatMinor(toProjectedBalance, { currencySymbol })}
          </Text>
        </View>
        {fromProjectedBalance < 0 ? (
          <Text style={{ color: theme.colors.expense, fontSize: theme.typeScale.tiny, fontFamily: theme.fonts.bold }}>
            ⚠️ Overdraft warning: from account balance will be negative.
          </Text>
        ) : null}
      </SectionCard>

      {/* Save Button */}
      <PrimaryButton
        accessibilityLabel="Save changes"
        disabled={!canSave}
        onPress={handleSave}
        style={{ marginBottom: theme.spacing.xxl, marginTop: theme.spacing.sm }}
      >
        {isSaving ? "Saving changes…" : "Save Changes"}
      </PrimaryButton>

      <CalendarPickerSheet
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(epochMillis) => {
          setDateEpochMillis(epochMillis);
          setDatePickerVisible(false);
        }}
        selectedDateEpochMillis={dateEpochMillis}
        testID="transfer-date-picker-sheet"
        title="Select Date"
        visible={datePickerVisible}
      />
    </ScreenContainer>
  );
}
