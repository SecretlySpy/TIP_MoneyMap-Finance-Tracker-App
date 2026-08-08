import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { GoalCard } from "../components/GoalCard";
import { ProgressBar } from "../components/ProgressBar";
import { MonthChip } from "../components/MonthChip";
import { SafeToSpendCard } from "../components/SafeToSpendCard";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { SpendingDonut } from "../components/SpendingDonut";
import { TransactionRow } from "../components/TransactionRow";
import {
  buildBudgetCards,
  computeDashboardTotals,
  formatMonthChip,
  recentUiTransactions,
  spendingByCategory,
} from "../domain/services/financeView";
import { sortGoalsForDisplay } from "../domain/services/goals";
import { formatMinor } from "../domain/services/money";
import { comparePeriods } from "../domain/services/periodCompare";
import { computeSafeToSpend } from "../domain/services/safeToSpend";
import { computeDueReminders, formatReminderMessage } from "../services/reminders";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

// Hierarchy: Balance → Safe-to-Spend → Reminders → Tips/Eats → Goals → Donut/Budgets/Recent
export function DashboardScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const remindersEnabled = useUiStore((state) => state.remindersEnabled);
  const smartTipsEnabled = useUiStore((state) => state.smartTipsEnabled);
  const tabNavigation = navigation.getParent();
  const accounts = useFinanceStore((state) => state.accounts);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const recurringRules = useFinanceStore((state) => state.recurringRules);
  const goals = useFinanceStore((state) => state.goals);
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
  const dueReminders = useMemo(
    () => (remindersEnabled ? computeDueReminders(recurringRules, categoriesById) : []),
    [remindersEnabled, recurringRules, categoriesById],
  );
  const safeToSpend = useMemo(
    () => computeSafeToSpend({
      budgets,
      transactions,
      categoriesById,
      recurringRules,
      goals: goals ?? [],
      monthYear: selectedMonthYear,
    }),
    [budgets, transactions, categoriesById, recurringRules, goals, selectedMonthYear],
  );
  const goalPreview = useMemo(() => sortGoalsForDisplay(goals ?? []).slice(0, 2), [goals]);
  const period = useMemo(
    () => comparePeriods({
      accounts,
      transactions,
      categoriesById,
      monthYear: selectedMonthYear,
    }),
    [accounts, transactions, categoriesById, selectedMonthYear],
  );
  const donutSegments = spending.segments.length > 0
    ? spending.segments.map((segment) => ({
      label: segment.label,
      percent: segment.percent,
      color: segment.color,
    }))
    : [{ label: "No spend", percent: 100, color: theme.colors.chartGray }];

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
        elevation: 6,
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

  const trendColor =
    period.expenseTrend === "up"
      ? theme.colors.expense
      : period.expenseTrend === "down"
        ? theme.colors.income
        : theme.colors.sub;
  const trendLabel =
    period.expenseTrend === "up"
      ? `↑ ${formatMinor(Math.abs(period.expenseDeltaMinor), { currencySymbol, showCents: false })} vs ${formatMonthChip(period.previousMonthYear)}`
      : period.expenseTrend === "down"
        ? `↓ ${formatMinor(Math.abs(period.expenseDeltaMinor), { currencySymbol, showCents: false })} vs ${formatMonthChip(period.previousMonthYear)}`
        : `Flat vs ${formatMonthChip(period.previousMonthYear)}`;

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
          {formatMinor(totals.balanceMinor, { currencySymbol })}
        </Text>
        <Text style={{ color: theme.colors.heroMeta, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>
          Spend this month {trendLabel}
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
                {formatMinor(stat.amount, { currencySymbol, showCents: false })}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <SafeToSpendCard
        currencySymbol={currencySymbol}
        goalReservesMinor={safeToSpend.goalReservesMinor}
        remainingBudgetsMinor={safeToSpend.remainingBudgetsMinor}
        safeMinor={safeToSpend.safeMinor}
        state={safeToSpend.state}
        upcomingRecurringMinor={safeToSpend.upcomingRecurringMinor}
      />

      {dueReminders.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => tabNavigation?.navigate("Budgets", { screen: "Recurring" })}
          style={{
            backgroundColor: theme.colors.amberBg,
            borderRadius: theme.radii.row,
            gap: theme.spacing.xs,
            padding: theme.spacing.lg,
          }}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            🔔 {formatReminderMessage(dueReminders[0])}
          </Text>
          {dueReminders.length > 1 ? (
            <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
              +{dueReminders.length - 1} more upcoming bill{dueReminders.length - 1 === 1 ? "" : "s"}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {smartTipsEnabled ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("SmartTips")}
            style={{
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radii.row,
              flexGrow: 1,
              minWidth: "46%",
              padding: theme.spacing.lg,
            }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              ✨ Smart Tips
            </Text>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny, marginTop: theme.spacing.xxs }}>
              From your spending
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => tabNavigation?.navigate("Settings", { screen: "SettingsOverview" })}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
              borderRadius: theme.radii.row,
              borderWidth: theme.spacing.hairline,
              flexGrow: 1,
              minWidth: "46%",
              padding: theme.spacing.lg,
            }}
          >
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              ✨ Try Smart Tips
            </Text>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny, marginTop: theme.spacing.xxs }}>
              Offline tips · optional AI · enable in Settings
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("StudentEats")}
          style={{
            backgroundColor: theme.colors.tint,
            borderRadius: theme.radii.row,
            flexGrow: 1,
            minWidth: "46%",
            padding: theme.spacing.lg,
          }}
        >
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
            🍜 Student Eats
          </Text>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny, marginTop: theme.spacing.xxs }}>
            Budget meals near TIP QC
          </Text>
        </Pressable>
      </View>

      <SectionCard shadowed style={{ gap: theme.spacing.lg }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
            Goals
          </Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.spacing.sm}
            onPress={() => tabNavigation?.navigate("Settings", { screen: "Goals" })}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              See all
            </Text>
          </Pressable>
        </View>
        {goalPreview.length === 0 ? (
          <EmptyState
            actionLabel="Create a goal"
            emoji="🎯"
            message="Save for tuition or gadgets — progress stays on-device."
            onAction={() => tabNavigation?.navigate("Settings", { screen: "Goals" })}
            title="No savings goals"
          />
        ) : (
          goalPreview.map((goal) => (
            <GoalCard
              key={goal.id}
              currencySymbol={currencySymbol}
              currentMinor={goal.currentMinor}
              deadlineEpochMillis={goal.deadlineEpochMillis}
              isComplete={goal.isComplete}
              isOverdue={goal.isOverdue}
              name={goal.name}
              progressPercent={goal.progressPercent}
              targetMinor={goal.targetMinor}
            />
          ))
        )}
      </SectionCard>

      <SectionCard shadowed style={{ gap: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
          Spending by Category
        </Text>
        {spending.totalMinor <= 0 ? (
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
            No expenses this month yet — your donut fills as you log spends.
          </Text>
        ) : (
          <Text style={{ color: trendColor, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
            {trendLabel}
          </Text>
        )}
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
          <EmptyState
            actionLabel="Add a budget"
            emoji="📊"
            message="Set category limits to track overspend risk this month."
            onAction={() => tabNavigation?.navigate("Budgets", { screen: "BudgetsOverview" })}
            title="No budgets yet"
          />
        ) : (
          budgetSnapshots.map((budget) => (
            <View key={budget.name} style={{ gap: theme.spacing.compact }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                  {budget.name}
                </Text>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
                  {formatMinor(budget.spentMinor, { currencySymbol, showCents: false })} /{" "}
                  {formatMinor(budget.limitMinor, { currencySymbol, showCents: false })}
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
          <EmptyState
            actionLabel="＋ Add transaction"
            emoji="🧾"
            message="Log allowance and daily spends to fill this list."
            onAction={() => navigation.navigate("Entry")}
            title="No transactions yet"
          />
        ) : (
          recent.map((transaction) => <TransactionRow key={transaction.id} {...transaction} />)
        )}
      </SectionCard>
    </ScreenContainer>
  );
}
