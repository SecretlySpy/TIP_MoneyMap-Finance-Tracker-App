import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { computeAccountBalances, formatMonthChip } from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import { calculateDebtPayoffSchedule, computeCashFlowTrends } from "../domain/services/reports";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

export function ReportsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const accounts = useFinanceStore((state) => state.accounts);
  const transactions = useFinanceStore((state) => state.transactions);
  const transfers = useFinanceStore((state) => state.transfers);

  const [activeTab, setActiveTab] = useState("CASH_FLOW"); // CASH_FLOW | DEBT_PLANNER

  // Debt calculator state
  const [debtPrincipalInput, setDebtPrincipalInput] = useState("1200.00");
  const [debtInterestInput, setDebtInterestInput] = useState("0");
  const [monthlyPaymentInput, setMonthlyPaymentInput] = useState("400.00");

  const cashFlowTrends = useMemo(
    () => computeCashFlowTrends({ transactions, months: 6 }),
    [transactions]
  );

  const accountBalances = useMemo(
    () => computeAccountBalances(accounts, transactions, transfers),
    [accounts, transactions, transfers]
  );

  const totalNetWorthMinor = useMemo(
    () => accountBalances.filter((a) => !a.isArchived).reduce((sum, a) => sum + a.balanceMinor, 0),
    [accountBalances]
  );

  const debtPrincipalMinor = useMemo(() => {
    try {
      return parseDecimalToMinor(debtPrincipalInput.replace(/[^0-9.]/g, "") || "0");
    } catch {
      return 0;
    }
  }, [debtPrincipalInput]);

  const monthlyPaymentMinor = useMemo(() => {
    try {
      return parseDecimalToMinor(monthlyPaymentInput.replace(/[^0-9.]/g, "") || "0");
    } catch {
      return 0;
    }
  }, [monthlyPaymentInput]);

  const debtInterestRate = Number(debtInterestInput.replace(/[^0-9.]/g, "") || "0");

  const payoffResult = useMemo(
    () =>
      calculateDebtPayoffSchedule({
        principalMinor: debtPrincipalMinor,
        annualInterestRatePercent: debtInterestRate,
        monthlyPaymentMinor,
      }),
    [debtPrincipalMinor, debtInterestRate, monthlyPaymentMinor]
  );

  const applyDebtPreset = (principal, rate, payment) => {
    setDebtPrincipalInput(principal);
    setDebtInterestInput(rate);
    setMonthlyPaymentInput(payment);
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="reports-screen">
      {/* Header */}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
          </Pressable>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
            Reports & Insights
          </Text>
        </View>
      </View>

      {/* Tabs */}
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
        {[
          { key: "CASH_FLOW", label: "Cash Flow Trends" },
          { key: "DEBT_PLANNER", label: "Student Debt Planner" },
        ].map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
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
                  fontSize: theme.typeScale.small,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "CASH_FLOW" ? (
        <View style={{ gap: theme.spacing.lg }}>
          {/* Net Worth Summary */}
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
              CURRENT TOTAL NET WORTH
            </Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
              {formatMinor(totalNetWorthMinor, { currencySymbol })}
            </Text>
            <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
              Across {accounts.filter((a) => !a.isArchived).length} active student accounts
            </Text>
          </SectionCard>

          {/* Transfers Excluded Notice */}
          <View
            style={{
              backgroundColor: theme.colors.tint,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.card,
              borderWidth: 1,
              gap: theme.spacing.xxs,
              padding: theme.spacing.md,
            }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
              ℹ️ Transfers Excluded by Design
            </Text>
            <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.small }}>
              Account transfers are movement between your own wallets and are excluded from income and expenses to keep savings rates accurate.
            </Text>
          </View>

          {/* 6-Month Cash Flow Cards */}
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              Monthly Inflows vs Outflows
            </Text>
            {cashFlowTrends.map((trend) => (
              <SectionCard key={trend.monthYear} padding={theme.spacing.md} style={{ gap: theme.spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                    {formatMonthChip(trend.monthYear)}
                  </Text>
                  <View
                    style={{
                      backgroundColor: trend.netSavingsMinor >= 0 ? theme.colors.track : theme.colors.tint,
                      borderRadius: theme.radii.chip,
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: trend.netSavingsMinor >= 0 ? theme.colors.income : theme.colors.expense,
                        fontFamily: theme.fonts.bold,
                        fontSize: theme.typeScale.small,
                      }}
                    >
                      {trend.netSavingsMinor >= 0 ? "+" : ""}{formatMinor(trend.netSavingsMinor, { currencySymbol })}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                    Income: {formatMinor(trend.incomeMinor, { currencySymbol })}
                  </Text>
                  <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                    Expenses: {formatMinor(trend.expenseMinor, { currencySymbol })}
                  </Text>
                </View>
                {trend.incomeMinor > 0 ? (
                  <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                    Savings Rate: {trend.savingsRatePercent}%
                  </Text>
                ) : null}
              </SectionCard>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.lg }}>
          {/* Debt Calculator Form */}
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              Student Debt & Payoff Calculator
            </Text>
            <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
              Simulate installments for SPayLater/Lazada BNPL, tuition installment schedules, or cards.
            </Text>

            {/* Presets */}
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny }}>
                QUICK PRESETS
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
                <Chip onPress={() => applyDebtPreset("1200.00", "0", "400.00")}>
                  SPayLater 0% (₱1.2k)
                </Chip>
                <Chip onPress={() => applyDebtPreset("15000.00", "0", "3000.00")}>
                  Tuition Plan (₱15k)
                </Chip>
                <Chip onPress={() => applyDebtPreset("5000.00", "24", "1000.00")}>
                  Card 24% (₱5k)
                </Chip>
              </View>
            </View>

            {/* Principal Input */}
            <View style={{ gap: theme.spacing.xxs }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Remaining Balance ({currencySymbol})
              </Text>
              <TextInput
                accessibilityLabel="Debt balance"
                keyboardType="numeric"
                onChangeText={setDebtPrincipalInput}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radii.input,
                  borderWidth: 1,
                  color: theme.colors.text,
                  height: 44,
                  paddingHorizontal: theme.spacing.md,
                }}
                value={debtPrincipalInput}
              />
            </View>

            {/* Interest Rate Input */}
            <View style={{ gap: theme.spacing.xxs }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Annual Interest Rate (% APR — 0 for zero-interest promos)
              </Text>
              <TextInput
                accessibilityLabel="Interest rate"
                keyboardType="numeric"
                onChangeText={setDebtInterestInput}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radii.input,
                  borderWidth: 1,
                  color: theme.colors.text,
                  height: 44,
                  paddingHorizontal: theme.spacing.md,
                }}
                value={debtInterestInput}
              />
            </View>

            {/* Monthly Payment Input */}
            <View style={{ gap: theme.spacing.xxs }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Target Monthly Payment ({currencySymbol})
              </Text>
              <TextInput
                accessibilityLabel="Monthly payment"
                keyboardType="numeric"
                onChangeText={setMonthlyPaymentInput}
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                  borderRadius: theme.radii.input,
                  borderWidth: 1,
                  color: theme.colors.text,
                  height: 44,
                  paddingHorizontal: theme.spacing.md,
                }}
                value={monthlyPaymentInput}
              />
            </View>
          </SectionCard>

          {/* Payoff Result */}
          {payoffResult.canPayoff ? (
            <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                ESTIMATED PAYOFF PLAN
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>Time to Debt-Free</Text>
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
                    {payoffResult.monthsToPayoff} months
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>Total Interest</Text>
                  <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                    {formatMinor(payoffResult.totalInterestMinor, { currencySymbol })}
                  </Text>
                  <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                    Total: {formatMinor(payoffResult.totalPaidMinor, { currencySymbol })}
                  </Text>
                </View>
              </View>

              {/* Monthly breakdown */}
              {payoffResult.schedule.length > 0 ? (
                <View style={{ borderTopColor: theme.colors.outline, borderTopWidth: theme.spacing.hairline, gap: theme.spacing.xs, paddingTop: theme.spacing.sm }}>
                  <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny }}>
                    PAYOFF SCHEDULE (FIRST 6 MONTHS)
                  </Text>
                  {payoffResult.schedule.slice(0, 6).map((item) => (
                    <View key={item.month} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.small }}>
                        Month {item.month}: {formatMinor(item.paymentMinor, { currencySymbol })}
                      </Text>
                      <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                        Balance: {formatMinor(item.remainingMinor, { currencySymbol })}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </SectionCard>
          ) : (
            <SectionCard padding={theme.spacing.lg} style={{ borderColor: theme.colors.expense, borderWidth: 1 }}>
              <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold }}>
                ⚠️ Payment Too Low
              </Text>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small, marginTop: 4 }}>
                {payoffResult.error ?? "Increase your monthly payment to cover interest."}
              </Text>
            </SectionCard>
          )}

          {/* Legal / Student Notice */}
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny, textAlign: "center" }}>
            * Projections are estimates and completely separate from recorded ledger data.
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}
