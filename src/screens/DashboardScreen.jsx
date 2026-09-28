import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { MonthChip } from "../components/MonthChip";
import { SafeToSpendCard } from "../components/SafeToSpendCard";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { SpendingDonut } from "../components/SpendingDonut";
import { TransactionRow } from "../components/TransactionRow";
import {
  computeDashboardTotals,
  recentUiTransactions,
  spendingByCategory,
} from "../domain/services/financeView";
import { formatMinor } from "../domain/services/money";
import { computeSafeToSpend } from "../domain/services/safeToSpend";
import { computeDueReminders } from "../services/reminders";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

// Figma 03 Dashboard: Balance → Safe-to-Spend (+ reminder pill) → quick tiles → Donut → Recent
export function DashboardScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const remindersEnabled = useUiStore((state) => state.remindersEnabled);
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
  const donutSegments = spending.segments.length > 0
    ? spending.segments.map((segment) => ({
      label: segment.label,
      percent: segment.percent,
      color: segment.color,
    }))
    : [{ label: "No spend", percent: 100, color: theme.colors.chartGray }];

  const reminderText = (() => {
    if (dueReminders.length === 0) {
      return null;
    }
    const first = dueReminders[0];
    const duePhrase = first.daysUntilDue === 0
      ? "due today"
      : first.daysUntilDue === 1
        ? "due tomorrow"
        : `due in ${first.daysUntilDue} days`;
    const extra = dueReminders.length - 1;
    return `${first.bill.name} ${duePhrase}`
      + (extra > 0 ? ` · +${extra} bill${extra === 1 ? "" : "s"}` : "");
  })();

  const quickActions = [
    {
      label: "🧾 History",
      onPress: () => tabNavigation?.navigate("History", { screen: "HistoryList" }),
    },
    {
      label: "📊 Budgets",
      onPress: () => tabNavigation?.navigate("Budgets", { screen: "BudgetsOverview" }),
    },
    {
      label: "🔁 Recurring",
      onPress: () => tabNavigation?.navigate("Budgets", { screen: "Recurring" }),
    },
    {
      label: "✨ Smart Tips",
      onPress: () => navigation.navigate("SmartTips"),
    },
    {
      label: "🍜 Student Eats",
      onPress: () => navigation.navigate("StudentEats"),
    },
    {
      label: "🎯 Goals",
      onPress: () => tabNavigation?.navigate("Settings", { screen: "Goals" }),
    },
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
        goalReserveCount={safeToSpend.goalReserveCount}
        goalReservesMinor={safeToSpend.goalReservesMinor}
        onReminderPress={() => tabNavigation?.navigate("Budgets", { screen: "Recurring" })}
        overCommittedMinor={safeToSpend.overCommittedMinor}
        remainingBudgetsMinor={safeToSpend.remainingBudgetsMinor}
        reminderText={reminderText}
        safeMinor={safeToSpend.safeMinor}
        state={safeToSpend.state}
        upcomingRecurringCount={safeToSpend.upcomingRecurringCount}
        upcomingRecurringMinor={safeToSpend.upcomingRecurringMinor}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {quickActions.map((action) => (
          <Pressable
            accessibilityLabel={action.label.replace(/^\S+\s/, "")}
            accessibilityRole="button"
            key={action.label}
            onPress={action.onPress}
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radii.row,
              flexBasis: "30%",
              flexGrow: 1,
              flexDirection: "row",
              gap: theme.spacing.sm,
              justifyContent: "center",
              minHeight: theme.sizes.secondaryButton,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            }}
          >
            <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
              {action.label.split(" ")[0]}
            </Text>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
              {action.label.replace(/^\S+\s/, "")}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionCard shadowed style={{ gap: theme.spacing.lg }}>
        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
            Spending by Category
          </Text>
          <Pressable
            accessibilityLabel="See all budgets"
            accessibilityRole="button"
            hitSlop={theme.spacing.sm}
            onPress={() => tabNavigation?.navigate("Budgets", { screen: "BudgetsOverview" })}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
              See all
            </Text>
          </Pressable>
        </View>
        {spending.totalMinor <= 0 ? (
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
            No expenses this month yet — your donut fills as you log spends.
          </Text>
        ) : null}
        <SpendingDonut
          segments={donutSegments}
          totalMinor={spending.totalMinor > 0 ? spending.totalMinor : totals.expenseMinor}
        />
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
            actionLabel="+ Add transaction"
            emoji="🧾"
            message="Log allowance and daily spends to fill this list."
            onAction={() => navigation.navigate("Entry")}
            title="No transactions yet"
          />
        ) : (
          recent.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              {...transaction}
              onPress={() => navigation.navigate("TransactionDetail", { transactionId: transaction.id })}
            />
          ))
        )}
      </SectionCard>
    </ScreenContainer>
  );
}
