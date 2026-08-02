import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { ProgressBar } from "../components/ProgressBar";
import { MonthChip } from "../components/MonthChip";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { SpendingDonut } from "../components/SpendingDonut";
import { TransactionRow } from "../components/TransactionRow";
import {
  buildBudgetCards,
  computeDashboardTotals,
  recentUiTransactions,
  spendingByCategory,
} from "../domain/services/financeView";
import { formatMinor } from "../domain/services/money";
import type { HomeStackParamList, MainTabParamList } from "../navigation/routes";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";

type DashboardProps = NativeStackScreenProps<HomeStackParamList, "Dashboard">;

// The Dashboard is a faithful flexible translation of Figma frame 7:2.
export function DashboardScreen({ navigation }: DashboardProps) {
  const theme = useTheme();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const accounts = useFinanceStore((state) => state.accounts);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);

  const { accountsById, categoriesById } = useMemo(
    () => mapsFromState({ accounts, categories }),
    [accounts, categories],
  );

  const totals = useMemo(
    () => computeDashboardTotals(accounts, transactions, selectedMonthYear),
    [accounts, transactions, selectedMonthYear],
  );

  const spending = useMemo(
    () => spendingByCategory(transactions, categoriesById, selectedMonthYear),
    [transactions, categoriesById, selectedMonthYear],
  );

  const budgetSnapshots = useMemo(
    () => buildBudgetCards(budgets, transactions, categoriesById, selectedMonthYear).slice(0, 2),
    [budgets, transactions, categoriesById, selectedMonthYear],
  );

  const recent = useMemo(
    () => recentUiTransactions(transactions, categoriesById, accountsById, 5),
    [transactions, categoriesById, accountsById],
  );

  const donutSegments =
    spending.segments.length > 0
      ? spending.segments.map((segment) => ({
          label: segment.label,
          percent: segment.percent,
          color: segment.color,
        }))
      : [
          { label: "No spend", percent: 100, color: theme.colors.chartGray },
        ];

  const fab = (
    <Pressable
      accessibilityLabel="Add transaction"
      accessibilityRole="button"
      onPress={() => navigation.navigate("Entry")}
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radii.fab,
        bottom: theme.spacing.card,
        height: theme.sizes.fab,
        justifyContent: "center",
        position: "absolute",
        right: theme.spacing.screen,
        shadowColor: theme.colors.primary,
        width: theme.sizes.fab,
        zIndex: 10,
        ...theme.shadows.fab,
      }}
    >
      <Text
        style={{
          color: theme.mode === "dark" ? theme.colors.onAccent : theme.colors.onPrimary,
          fontFamily: theme.fonts.medium,
          fontSize: theme.typeScale.fabGlyph,
        }}
      >
        +
      </Text>
    </Pressable>
  );

  return (
    <ScreenContainer
      contentContainerStyle={{ gap: theme.spacing.screen, paddingBottom: theme.sizes.fabClearance }}
      floating={fab}
      testID="dashboard-screen"
    >
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
          Dashboard
        </Text>
        <MonthChip />
      </View>

      <View
        style={{
          backgroundColor: theme.colors.deepPrimary,
          borderRadius: theme.radii.balance,
          gap: theme.spacing.xs,
          padding: theme.spacing.hero,
        }}
      >
        <Text style={{ color: theme.colors.heroSubtext, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Total Balance
        </Text>
        <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.heroAmount }}>
          {formatMinor(totals.balanceMinor)}
        </Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.md, paddingTop: theme.spacing.keyGap }}>
          {[
            { arrow: "↓", label: "Income", amount: totals.incomeMinor },
            { arrow: "↑", label: "Expenses", amount: totals.expenseMinor },
          ].map((stat) => (
            <View
              key={stat.label}
              style={{
                backgroundColor: theme.colors.heroPill,
                borderRadius: theme.radii.row,
                flex: 1,
                gap: theme.spacing.xxs,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.keyGap,
              }}
            >
              <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
                <Text style={{ color: theme.colors.heroMeta, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                  {stat.arrow}
                </Text>
                <Text style={{ color: theme.colors.heroMeta, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                  {stat.label}
                </Text>
              </View>
              <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.statAmount }}>
                {formatMinor(stat.amount, { showCents: false })}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <SectionCard shadowed style={{ gap: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
          Spending by Category
        </Text>
        <SpendingDonut
          segments={donutSegments}
          totalMinor={spending.totalMinor > 0 ? spending.totalMinor : totals.expenseMinor}
        />
      </SectionCard>

      <SectionCard shadowed style={{ gap: theme.spacing.lg }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
            Budgets
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.spacing.sm}
            onPress={() => tabNavigation?.navigate("Budgets", { screen: "BudgetsOverview" })}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              See all
            </Text>
          </Pressable>
        </View>
        {budgetSnapshots.length === 0 ? (
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
            No budgets for this month yet.
          </Text>
        ) : (
          budgetSnapshots.map((budget) => (
            <View key={budget.name} style={{ gap: theme.spacing.compact }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                  {budget.name}
                </Text>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
                  {formatMinor(budget.spentMinor, { showCents: false })} / {formatMinor(budget.limitMinor, { showCents: false })}
                </Text>
              </View>
              <ProgressBar
                color={
                  budget.state === "over"
                    ? theme.colors.expense
                    : budget.state === "warning"
                      ? theme.colors.warning
                      : theme.colors.primary
                }
                percent={budget.percent}
              />
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard style={{ gap: theme.spacing.md }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
            Recent Transactions
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.spacing.sm}
            onPress={() => tabNavigation?.navigate("History", { screen: "HistoryList" })}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              See all
            </Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
            No transactions yet. Tap + to add one.
          </Text>
        ) : (
          recent.map((transaction) => <TransactionRow key={transaction.id} {...transaction} />)
        )}
      </SectionCard>
    </ScreenContainer>
  );
}
