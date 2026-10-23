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
import {
  computeSplitBreakdown,
  extractParentNote,
  formatSplitEquation,
  stripSplitSuffix,
  validateSplitSum,
} from "../domain/services/splits";
import { SplitItemEditor } from "../components/SplitItemEditor";
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
  const transactionGroups = useFinanceStore((state) => state.transactionGroups);
  const transfers = useFinanceStore((state) => state.transfers);
  const categories = useFinanceStore((state) => state.categories);
  const accounts = useFinanceStore((state) => state.accounts);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);
  const updateSplitTransactionGroup = useFinanceStore((state) => state.updateSplitTransactionGroup);
  const deleteSplitTransactionGroup = useFinanceStore((state) => state.deleteSplitTransactionGroup);
  const updateAccountTransfer = useFinanceStore((state) => state.updateAccountTransfer);

  const isTransfer = Boolean(route?.params?.isTransfer || route?.params?.transferId);
  const transferId = Number(route?.params?.transferId ?? route?.params?.transactionId);
  const transfer = isTransfer ? transfers.find((item) => item.id === transferId) : null;

  const explicitSplitGroupId = route?.params?.splitGroupId;
  const transactionId = Number(route?.params?.transactionId);
  const transaction = !isTransfer && !isNaN(transactionId) ? transactions.find((item) => item.id === transactionId) : null;

  const resolvedSplitGroupId = explicitSplitGroupId ?? (transaction?.splitGroupId ?? null);
  const isSplitGroup = Boolean(
    resolvedSplitGroupId &&
    (explicitSplitGroupId || (transaction && transactions.filter((t) => t.splitGroupId === resolvedSplitGroupId).length >= 2))
  );

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

  if (isSplitGroup) {
    const groupAllocations = transactions.filter((t) => t.splitGroupId === resolvedSplitGroupId);
    if (groupAllocations.length === 0) {
      return <MissingTransactionView navigation={navigation} theme={theme} />;
    }
    const groupMeta = transactionGroups.find((g) => g.id === resolvedSplitGroupId);
    return (
      <EditSplitPurchaseForm
        accounts={accounts}
        categories={categories}
        currencySymbol={currencySymbol}
        deleteSplitTransactionGroup={deleteSplitTransactionGroup}
        groupAllocations={groupAllocations}
        groupMeta={groupMeta}
        navigation={navigation}
        splitGroupId={resolvedSplitGroupId}
        theme={theme}
        updateSplitTransactionGroup={updateSplitTransactionGroup}
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

function EditSplitPurchaseForm({
  splitGroupId,
  groupMeta,
  groupAllocations,
  navigation,
  theme,
  currencySymbol,
  categories,
  accounts,
  updateSplitTransactionGroup,
  deleteSplitTransactionGroup,
}) {
  const initialTotalMinor = groupAllocations.reduce((sum, a) => sum + (Number(a.amountMinor) || 0), 0);
  const [totalMinor, setTotalMinor] = useState(initialTotalMinor);
  const [totalStr, setTotalStr] = useState(
    initialTotalMinor % 100 === 0 ? String(initialTotalMinor / 100) : (initialTotalMinor / 100).toFixed(2)
  );

  let initialTitle = groupMeta?.title?.trim() || "";
  if (!initialTitle) {
    for (const a of groupAllocations) {
      const parent = extractParentNote(a.note, categories.find((c) => c.id === a.categoryId)?.name);
      if (parent) {
        initialTitle = parent;
        break;
      }
    }
  }

  const [title, setTitle] = useState(initialTitle);
  const [accountId, setAccountId] = useState(groupMeta?.accountId ?? groupAllocations[0]?.accountId);
  const [dateEpochMillis, setDateEpochMillis] = useState(groupMeta?.dateEpochMillis ?? groupAllocations[0]?.dateEpochMillis ?? Date.now());

  const [splits, setSplits] = useState(() =>
    groupAllocations.map((a) => {
      const cat = categories.find((c) => c.id === a.categoryId);
      return {
        id: a.id,
        categoryId: a.categoryId,
        categoryName: cat?.name ?? "Other",
        amountMinor: a.amountMinor,
        rawAmount: a.amountMinor % 100 === 0 ? String(a.amountMinor / 100) : (a.amountMinor / 100).toFixed(2),
        note: stripSplitSuffix(a.note) || "",
      };
    })
  );

  const [activeSplitId, setActiveSplitId] = useState(splits[0]?.id ?? null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [categoryPickerTargetId, setCategoryPickerTargetId] = useState(null);
  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => !a.isArchived || a.id === accountId),
    [accounts, accountId],
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "EXPENSE"),
    [categories],
  );

  const formattedDate = new Date(dateEpochMillis).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const hasCentavos = splits.some((s) => (Number(s.amountMinor) || 0) % 100 !== 0) || totalMinor % 100 !== 0;
  const splitValidation = validateSplitSum(splits, totalMinor, { requireCategory: true });
  const splitBreakdown = computeSplitBreakdown({ totalMinor, splits });

  const handleTotalChange = (text) => {
    setTotalStr(text);
    const cleaned = text.trim().replace(/[₱$,\s]/g, "");
    const parsed = parseDecimalToMinor(cleaned);
    if (Number.isInteger(parsed) && parsed >= 0) {
      setTotalMinor(parsed);
    }
  };

  const handleSplitAmountChange = (splitId, text) => {
    const cleaned = text.trim().replace(/[₱$,\s]/g, "");
    const parsed = parseDecimalToMinor(cleaned);
    setSplits((prev) =>
      prev.map((s) => {
        if (s.id !== splitId) return s;
        return {
          ...s,
          rawAmount: text,
          amountMinor: Number.isInteger(parsed) && parsed >= 0 ? parsed : 0,
        };
      })
    );
  };

  const handleAddSplit = () => {
    const newId = `new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const currentSum = splits.reduce((acc, s) => acc + (Number(s.amountMinor) || 0), 0);
    const remaining = Math.max(0, totalMinor - currentSum);

    const usedCatIds = new Set(splits.map((s) => s.categoryId));
    const nextCat = expenseCategories.find((c) => !usedCatIds.has(c.id)) || expenseCategories[0];

    const newSplit = {
      id: newId,
      categoryId: nextCat?.id,
      categoryName: nextCat?.name ?? "Other",
      amountMinor: remaining,
      rawAmount: remaining % 100 === 0 ? String(remaining / 100) : (remaining / 100).toFixed(2),
      note: "",
    };

    setSplits((prev) => [...prev, newSplit]);
    setActiveSplitId(newId);
  };

  const handleRemoveSplit = (splitId) => {
    if (splits.length <= 1) {
      return;
    }
    setSplits((prev) => prev.filter((s) => s.id !== splitId));
  };

  const handleCategorySelect = (selectedCat) => {
    if (!categoryPickerTargetId) return;
    setSplits((prev) =>
      prev.map((s) => {
        if (s.id !== categoryPickerTargetId) return s;
        return {
          ...s,
          categoryId: selectedCat.id,
          categoryName: selectedCat.name,
        };
      })
    );
    setCategoryPickerVisible(false);
    setCategoryPickerTargetId(null);
  };

  const handleSave = async () => {
    if (!splitValidation.isValid) {
      setSaveError(splitValidation.error || "Allocated sum must equal total amount.");
      return;
    }
    if (totalMinor <= 0) {
      setSaveError("Total amount must be greater than zero.");
      return;
    }
    if (!accountId) {
      setSaveError("Please select an account.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      await updateSplitTransactionGroup(splitGroupId, {
        title: title.trim() || null,
        accountId,
        dateEpochMillis,
        splits: splits.map((s) => ({
          id: typeof s.id === "number" ? s.id : undefined,
          amountMinor: s.amountMinor,
          categoryId: s.categoryId,
          categoryName: s.categoryName,
          note: s.note?.trim() || null,
        })),
      });
      navigation.goBack();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save split transaction changes.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntirePurchase = async () => {
    try {
      setIsDeleting(true);
      await deleteSplitTransactionGroup(splitGroupId);
      setDeleteSheetVisible(false);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        "Delete failed",
        error instanceof Error ? error.message : "Could not delete split purchase.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const canSave = splitValidation.isValid && totalMinor > 0 && !isSaving;

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.xl }} testID="edit-split-purchase-screen">
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
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 18 }}>‹</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
          Edit Split Purchase
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {saveError ? (
        <View
          style={{
            backgroundColor: theme.colors.amberBg,
            borderColor: theme.colors.warning,
            borderRadius: theme.radii.card,
            borderWidth: 1,
            padding: theme.spacing.md,
          }}
        >
          <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.bold }}>⚠️ {saveError}</Text>
        </View>
      ) : null}

      {/* Total Purchase Amount Input */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny, letterSpacing: 1 }}>
          TOTAL PURCHASE AMOUNT
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: 28 }}>
            {currencySymbol}
          </Text>
          <TextInput
            accessibilityLabel="Total purchase amount"
            keyboardType="decimal-pad"
            onChangeText={handleTotalChange}
            placeholder="0.00"
            placeholderTextColor={theme.colors.sub}
            style={{
              color: theme.colors.text,
              flex: 1,
              fontFamily: theme.fonts.bold,
              fontSize: 28,
              padding: 0,
            }}
            testID="edit-split-total-input"
            value={totalStr}
          />
        </View>
      </SectionCard>

      {/* Purchase Title / Note */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny, letterSpacing: 1 }}>
          PURCHASE TITLE / NOTE
        </Text>
        <TextInput
          accessibilityLabel="Purchase title"
          maxLength={120}
          onChangeText={setTitle}
          placeholder="e.g. School supplies, Grocery run"
          placeholderTextColor={theme.colors.sub}
          style={{
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.chip,
            borderWidth: 1,
            color: theme.colors.text,
            fontFamily: theme.fonts.regular,
            fontSize: theme.typeScale.body,
            minHeight: 44,
            paddingHorizontal: theme.spacing.md,
          }}
          testID="edit-split-title-input"
          value={title}
        />
      </SectionCard>

      {/* Paid From Account */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny, letterSpacing: 1 }}>
          PAID FROM ACCOUNT
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -theme.spacing.sm }}>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm, paddingHorizontal: theme.spacing.sm }}>
            {activeAccounts.map((account) => {
              const isSelected = account.id === accountId;
              return (
                <Chip
                  key={account.id}
                  label={account.name}
                  onPress={() => setAccountId(account.id)}
                  selected={isSelected}
                />
              );
            })}
          </View>
        </ScrollView>
      </SectionCard>

      {/* Date Picker */}
      <SectionCard style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny, letterSpacing: 1 }}>
          PURCHASE DATE
        </Text>
        <Pressable
          accessibilityLabel={`Change purchase date, current is ${formattedDate}`}
          accessibilityRole="button"
          onPress={() => setDatePickerVisible(true)}
          style={{
            alignItems: "center",
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.chip,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 44,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            {formattedDate}
          </Text>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: 18 }}>📅</Text>
        </Pressable>
      </SectionCard>

      {/* Split Allocations Breakdown Card */}
      <SectionCard style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
            Category Allocations ({splits.length})
          </Text>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
            {formatSplitEquation(splits, totalMinor, currencySymbol, { showCents: hasCentavos })}
          </Text>
        </View>

        {/* Transition to Single Allocation Notice */}
        {splits.length === 1 ? (
          <View
            style={{
              backgroundColor: theme.colors.tint,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.row,
              borderWidth: 1,
              padding: theme.spacing.sm,
            }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
              ℹ️ Single allocation: Saving with 1 category will transition this purchase into a standard single-category transaction.
            </Text>
          </View>
        ) : null}

        {/* Split Item Editors */}
        <View style={{ gap: theme.spacing.sm }}>
          {splits.map((split, idx) => (
            <SplitItemEditor
              categoryIcon={categories.find((c) => c.id === split.categoryId)?.icon}
              currencySymbol={currencySymbol}
              index={idx}
              isActive={activeSplitId === split.id}
              key={split.id}
              onAmountChange={(text) => handleSplitAmountChange(split.id, text)}
              onAmountFocus={() => setActiveSplitId(split.id)}
              onCategoryPress={() => {
                setActiveSplitId(split.id);
                setCategoryPickerTargetId(split.id);
                setCategoryPickerVisible(true);
              }}
              canRemove={splits.length > 1}
              onRemove={() => handleRemoveSplit(split.id)}
              onSelect={() => setActiveSplitId(split.id)}
              split={split}
            />
          ))}
        </View>

        {/* Add Split Button */}
        <Pressable
          accessibilityLabel="Add category split"
          accessibilityRole="button"
          hitSlop={theme.spacing.xs}
          onPress={handleAddSplit}
          style={{
            alignItems: "center",
            borderColor: theme.colors.primary,
            borderRadius: theme.radii.row,
            borderStyle: "dashed",
            borderWidth: 1.5,
            justifyContent: "center",
            minHeight: 44,
            paddingVertical: theme.spacing.sm,
          }}
          testID="edit-add-split-btn"
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            + Add Another Category
          </Text>
        </Pressable>

        {/* Validation Status Bar */}
        <View style={{ borderTopColor: theme.colors.outline, borderTopWidth: 1, gap: 4, paddingTop: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
              Allocated Total: {formatMinor(splitBreakdown?.sumMinor || 0, { currencySymbol, showCents: hasCentavos })}
            </Text>
            <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
              Purchase Total: {formatMinor(totalMinor, { currencySymbol, showCents: hasCentavos })}
            </Text>
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing.xxs }}>
            {splitValidation.isValid ? (
              <Text style={{ color: theme.colors.income, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                ✓ Exact sum verified
              </Text>
            ) : (
              <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {splitValidation.diffMinor > 0
                  ? `Remaining: ${formatMinor(splitValidation.diffMinor, { currencySymbol, showCents: hasCentavos })}`
                  : `Over by: ${formatMinor(Math.abs(splitValidation.diffMinor), { currencySymbol, showCents: hasCentavos })}`}
              </Text>
            )}
            {!splitValidation.isValid ? (
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                Must equal total to save
              </Text>
            ) : null}
          </View>
        </View>
      </SectionCard>

      {/* Save Button */}
      <PrimaryButton
        accessibilityLabel="Save split changes"
        disabled={!canSave}
        onPress={handleSave}
        style={{ marginTop: theme.spacing.sm }}
      >
        {isSaving ? "Saving changes…" : "Save Changes"}
      </PrimaryButton>

      {/* Delete Purchase Button */}
      <Pressable
        accessibilityLabel="Delete entire purchase"
        accessibilityRole="button"
        onPress={() => setDeleteSheetVisible(true)}
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.expense,
          borderRadius: theme.radii.button,
          borderWidth: 1.5,
          height: theme.sizes.primaryButton,
          justifyContent: "center",
          marginBottom: theme.spacing.xxl,
          width: "100%",
        }}
      >
        <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
          Delete Entire Purchase
        </Text>
      </Pressable>

      {/* Date Picker Sheet */}
      <CalendarPickerSheet
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(epochMillis) => {
          setDateEpochMillis(epochMillis);
          setDatePickerVisible(false);
        }}
        selectedDateEpochMillis={dateEpochMillis}
        testID="split-date-picker-sheet"
        title="Select Purchase Date"
        visible={datePickerVisible}
      />

      {/* Category Picker Sheet */}
      <BottomSheet
        onClose={() => {
          setCategoryPickerVisible(false);
          setCategoryPickerTargetId(null);
        }}
        title="Choose Category"
        visible={categoryPickerVisible}
      >
        <ScrollView style={{ maxHeight: 380 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}>
            {expenseCategories.map((cat) => (
              <Chip
                key={cat.id}
                label={`${resolveDisplayEmoji({ icon: cat.icon, name: cat.name })} ${cat.name}`}
                onPress={() => handleCategorySelect(cat)}
                selected={splits.find((s) => s.id === categoryPickerTargetId)?.categoryId === cat.id}
              />
            ))}
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Delete Confirmation Sheet */}
      <BottomSheet
        onClose={() => setDeleteSheetVisible(false)}
        testID="delete-split-confirmation-sheet"
        title="Delete this entire purchase?"
        visible={deleteSheetVisible}
      >
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.md }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
            This will delete all {splits.length} category allocations for this purchase. Account balances will be restored. This cannot be undone.
          </Text>
          <PrimaryButton
            accessibilityLabel="Confirm Delete"
            disabled={isDeleting}
            onPress={handleDeleteEntirePurchase}
            style={{ backgroundColor: theme.colors.expense }}
          >
            {isDeleting ? "Deleting…" : "Confirm Delete"}
          </PrimaryButton>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeleteSheetVisible(false)}
            style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
          >
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium }}>Cancel</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}
