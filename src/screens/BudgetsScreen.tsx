import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { BudgetCard } from "../components/BudgetCard";
import { DashedButton } from "../components/Buttons";
import { MonthChip } from "../components/MonthChip";
import { ScreenContainer } from "../components/ScreenContainer";
import {
  budgetSummary,
  buildBudgetCards,
  categoriesForType,
} from "../domain/services/financeView";
import { formatMinor } from "../domain/services/money";
import type { BudgetsStackParamList } from "../navigation/routes";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";

type BudgetsProps = NativeStackScreenProps<BudgetsStackParamList, "BudgetsOverview">;

const DEFAULT_BUDGET_LIMIT_MINOR = 500_000;

// The budget list demonstrates normal, warning, and over states from frame 13:40.
export function BudgetsScreen(_props: BudgetsProps) {
  const theme = useTheme();
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
  const addBudget = useFinanceStore((state) => state.addBudget);
  const [adding, setAdding] = useState(false);

  const { categoriesById } = useMemo(() => mapsFromState({ accounts: [], categories }), [categories]);

  const cards = useMemo(
    () => buildBudgetCards(budgets, transactions, categoriesById, selectedMonthYear),
    [budgets, transactions, categoriesById, selectedMonthYear],
  );

  const summary = useMemo(() => budgetSummary(cards), [cards]);

  const handleAddBudget = async () => {
    if (adding) {
      return;
    }
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

    setAdding(true);
    try {
      await addBudget({
        categoryName: nextCategory.name,
        limitMinor: DEFAULT_BUDGET_LIMIT_MINOR,
        monthYear: selectedMonthYear,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not add budget.";
      Alert.alert("Add budget failed", message);
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
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
        {formatMinor(summary.spentMinor, { showCents: false })} of {formatMinor(summary.limitMinor, { showCents: false })}{" "}
        total budget spent
      </Text>
      {cards.length === 0 ? (
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
          No budgets yet for this month. Add one to track spending limits.
        </Text>
      ) : (
        cards.map((budget) => <BudgetCard key={budget.name} {...budget} />)
      )}
      <DashedButton disabled={adding} onPress={() => void handleAddBudget()}>
        {adding ? "Adding…" : "＋ Add budget"}
      </DashedButton>
    </ScreenContainer>
  );
}
