import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { BudgetCard } from "../components/BudgetCard";
import { DashedButton } from "../components/Buttons";
import { MonthChip } from "../components/MonthChip";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextPromptModal } from "../components/TextPromptModal";
import {
  budgetSummary,
  buildBudgetCards,
  categoriesForType,
} from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import type { BudgetsStackParamList } from "../navigation/routes";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

type BudgetsProps = NativeStackScreenProps<BudgetsStackParamList, "BudgetsOverview">;

// The budget list demonstrates normal, warning, and over states from frame 13:40.
export function BudgetsScreen({ navigation }: BudgetsProps) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
  const addBudget = useFinanceStore((state) => state.addBudget);
  const deleteBudgetByCategoryName = useFinanceStore((state) => state.deleteBudgetByCategoryName);
  const [adding, setAdding] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [showLimitPrompt, setShowLimitPrompt] = useState(false);
  const [editingLimit, setEditingLimit] = useState<string | null>(null);

  const { categoriesById } = useMemo(() => mapsFromState({ accounts: [], categories }), [categories]);

  const cards = useMemo(
    () => buildBudgetCards(budgets, transactions, categoriesById, selectedMonthYear),
    [budgets, transactions, categoriesById, selectedMonthYear],
  );

  const summary = useMemo(() => budgetSummary(cards), [cards]);

  const beginAddBudget = () => {
    const expenseCategories = categoriesForType(categories, "EXPENSE");
    const usedIds = new Set(
      budgets
        .filter((budget) => budget.monthYear === selectedMonthYear)
        .map((budget) => budget.categoryId),
    );
    const nextCategory = expenseCategories.find((category) => !usedIds.has(category.id));
    if (nextCategory === undefined) {
      Alert.alert("Budgets complete", "Every expense category already has a budget this month.");
      return;
    }
    setPendingCategory(nextCategory.name);
    setShowLimitPrompt(true);
  };

  const handleLimitConfirm = async (value: string) => {
    if (pendingCategory === null || adding) {
      return;
    }
    setAdding(true);
    try {
      const limitMinor = parseDecimalToMinor(value.replace(/[₱$,]/g, "") || "0");
      if (limitMinor <= 0) {
        throw new Error("Enter a positive budget limit.");
      }
      await addBudget({
        categoryName: pendingCategory,
        limitMinor,
        monthYear: selectedMonthYear,
      });
      setShowLimitPrompt(false);
      setPendingCategory(null);
    } catch (error: unknown) {
      Alert.alert("Add budget failed", error instanceof Error ? error.message : "Could not add budget.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.lg }} testID="budgets-screen">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
          Budgets
        </Text>
        <MonthChip />
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label, flex: 1 }}>
          {formatMinor(summary.spentMinor, { currencySymbol, showCents: false })} of{" "}
          {formatMinor(summary.limitMinor, { currencySymbol, showCents: false })} total budget spent
        </Text>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Recurring")}>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
            Bills
          </Text>
        </Pressable>
      </View>
      {cards.length === 0 ? (
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
          No budgets yet for this month. Add one to track spending limits.
        </Text>
      ) : (
        cards.map((budget) => (
          <Pressable
            key={budget.name}
            accessibilityHint="Long press to edit or delete this budget"
            accessibilityRole="button"
            onLongPress={() => {
              Alert.alert(budget.name, "Edit limit or remove this budget.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Edit limit",
                  onPress: () => {
                    setEditingLimit(budget.name);
                    setPendingCategory(budget.name);
                    setShowLimitPrompt(true);
                  },
                },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    void deleteBudgetByCategoryName(budget.name, selectedMonthYear).catch((error: unknown) => {
                      Alert.alert(
                        "Delete failed",
                        error instanceof Error ? error.message : "Could not delete budget.",
                      );
                    });
                  },
                },
              ]);
            }}
          >
            <BudgetCard {...budget} currencySymbol={currencySymbol} />
          </Pressable>
        ))
      )}
      <DashedButton disabled={adding} onPress={beginAddBudget}>
        {adding ? "Adding…" : "＋ Add budget"}
      </DashedButton>
      <TextPromptModal
        confirmLabel="Save budget"
        initialValue={
          editingLimit === null
            ? "5000.00"
            : ((cards.find((card) => card.name === editingLimit)?.limitMinor ?? 500_000) / 100).toFixed(2)
        }
        keyboardType="decimal-pad"
        message={pendingCategory === null ? undefined : `Monthly limit for ${pendingCategory}`}
        onCancel={() => {
          setShowLimitPrompt(false);
          setPendingCategory(null);
          setEditingLimit(null);
        }}
        onConfirm={(value) => {
          void handleLimitConfirm(value).then(() => setEditingLimit(null));
        }}
        placeholder="5000.00"
        title={editingLimit === null ? "Budget limit" : "Edit budget limit"}
        visible={showLimitPrompt}
      />
    </ScreenContainer>
  );
}
