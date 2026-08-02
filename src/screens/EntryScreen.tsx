import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import {
  accountChipLabel,
  categoriesForType,
  categoryEmoji,
  toMonthYear,
} from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor, updateMoneyInput } from "../domain/services/money";
import type { AccountType, TransactionType } from "../domain/types";
import type { HomeStackParamList } from "../navigation/routes";
import { listAccountChips, useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";

type EntryProps = NativeStackScreenProps<HomeStackParamList, "Entry">;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
] as const;

function todayLabel(now = new Date()): string {
  return `Today, ${MONTH_SHORT[now.getMonth()]} ${now.getDate()}`;
}

// The entry screen keeps the Figma three-step flow while all money stays integer minor units.
export function EntryScreen({ navigation }: EntryProps) {
  const theme = useTheme();
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const setSelectedMonthYear = useFinanceStore((state) => state.setSelectedMonthYear);

  const [transactionType, setTransactionType] = useState<TransactionType>("EXPENSE");
  const [amountInput, setAmountInput] = useState("0");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedAccountType, setSelectedAccountType] = useState<AccountType>("CASH");
  const [saving, setSaving] = useState(false);

  const accountChips = useMemo(() => listAccountChips(accounts), [accounts]);
  const typeCategories = useMemo(
    () => categoriesForType(categories, transactionType),
    [categories, transactionType],
  );

  const categoryCells = useMemo(() => {
    const cells = typeCategories.slice(0, 8).map((category) => ({
      emoji: categoryEmoji(category.name),
      label: category.name,
    }));
    while (cells.length > 0 && cells.length % 4 !== 0) {
      cells.push({ emoji: "", label: "" });
    }
    return cells;
  }, [typeCategories]);

  useEffect(() => {
    const first = typeCategories[0];
    if (first === undefined) {
      setSelectedCategory("");
      return;
    }
    if (!typeCategories.some((category) => category.name === selectedCategory)) {
      setSelectedCategory(first.name);
    }
  }, [typeCategories, selectedCategory]);

  const amountMinor = useMemo(() => {
    try {
      return parseDecimalToMinor(amountInput);
    } catch {
      return 0;
    }
  }, [amountInput]);

  const amountColor = transactionType === "EXPENSE" ? theme.colors.expense : theme.colors.income;
  const selectedAccountLabel = accountChipLabel(selectedAccountType).replace(/^\S+\s/, "");
  const canSave = amountMinor > 0 && selectedCategory !== "" && !saving;

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        accountType: selectedAccountType,
        amountMinor,
        categoryName: selectedCategory,
        type: transactionType,
      });
      setSelectedMonthYear(toMonthYear());
      navigation.goBack();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save transaction.";
      Alert.alert("Save failed", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer
      contentContainerStyle={{ gap: theme.spacing.card }}
      safeBottom
      testID="entry-screen"
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
        <Pressable
          accessibilityLabel="Close add transaction"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.subScreenTitle }}>
            ✕
          </Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Add Transaction
        </Text>
      </View>

      <View
        accessibilityRole="tablist"
        style={{
          backgroundColor: theme.colors.track,
          borderRadius: theme.radii.balance,
          flexDirection: "row",
          height: theme.sizes.entryToggle,
          padding: theme.spacing.xs,
        }}
      >
        {(["EXPENSE", "INCOME"] as const).map((type) => {
          const selected = transactionType === type;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={type}
              onPress={() => setTransactionType(type)}
              style={{
                alignItems: "center",
                backgroundColor: selected ? theme.colors.surface : theme.colors.track,
                borderRadius: theme.radii.chip,
                flex: 1,
                height: theme.sizes.entrySegment,
                justifyContent: "center",
                shadowColor: theme.colors.shadow,
                ...(selected ? theme.shadows.card : {}),
              }}
            >
              <Text
                style={{
                  color: selected ? theme.colors.text : theme.colors.sub,
                  fontFamily: selected ? theme.fonts.bold : theme.fonts.medium,
                  fontSize: theme.typeScale.body,
                }}
              >
                {type === "EXPENSE" ? "Expense" : "Income"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ alignItems: "center", height: theme.sizes.entryAmountBlock, justifyContent: "center" }}>
        <Text style={{ color: amountColor, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.entryAmount }}>
          {formatMinor(amountMinor)}
        </Text>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
          {selectedAccountLabel} · {todayLabel()}
        </Text>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
          Category
        </Text>
        {[categoryCells.slice(0, 4), categoryCells.slice(4, 8)].map((row, rowIndex) => (
          <View key={`category-row-${rowIndex}`} style={{ flexDirection: "row", gap: theme.spacing.md }}>
            {row.map((category, cellIndex) => {
              if (category.label === "") {
                return <View key={`empty-${rowIndex}-${cellIndex}`} style={{ flex: 1 }} />;
              }
              const selected = selectedCategory === category.label;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={category.label}
                  onPress={() => setSelectedCategory(category.label)}
                  style={{
                    alignItems: "center",
                    backgroundColor: selected ? theme.colors.tint : theme.colors.surface,
                    borderColor: selected ? theme.colors.primary : theme.colors.outline,
                    borderRadius: theme.radii.row,
                    borderWidth: selected ? 1.5 : theme.spacing.hairline,
                    flex: 1,
                    height: theme.sizes.categoryCell,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: 20 }}>
                    {category.emoji}
                  </Text>
                  <Text
                    style={{
                      color: selected ? theme.colors.primary : theme.colors.sub,
                      fontFamily: selected ? theme.fonts.bold : theme.fonts.medium,
                      fontSize: theme.typeScale.small,
                      marginTop: theme.spacing.xs,
                    }}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ gap: theme.spacing.keyGap }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
          Account
        </Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.keyGap }}>
          {accountChips.map((account) => (
            <Chip
              key={account.type}
              onPress={() => setSelectedAccountType(account.type)}
              selected={selectedAccountType === account.type}
              style={{ height: theme.sizes.accountChip }}
            >
              {account.label}
            </Chip>
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.keyGap }}>
        {keypadRows.map((row, rowIndex) => (
          <View key={`keypad-row-${rowIndex}`} style={{ flexDirection: "row", gap: theme.spacing.keyGap }}>
            {row.map((key) => (
              <Pressable
                accessibilityLabel={key === "⌫" ? "Delete digit" : key === "." ? "Decimal point" : key}
                accessibilityRole="button"
                key={key}
                onPress={() => setAmountInput((current) => updateMoneyInput(current, key))}
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radii.row,
                  borderWidth: theme.spacing.hairline,
                  flex: 1,
                  height: theme.sizes.entryKey,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.keypad }}>
                  {key}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <PrimaryButton disabled={!canSave} onPress={() => void handleSave()}>
        {saving ? "Saving…" : "Save Transaction"}
      </PrimaryButton>
    </ScreenContainer>
  );
}
