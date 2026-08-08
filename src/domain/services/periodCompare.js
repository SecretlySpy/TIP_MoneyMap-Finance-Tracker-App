import { shiftMonthYear, spendingByCategory, computeDashboardTotals } from "./financeView";

/**
 * Compare selected month totals vs previous month (pure).
 *
 * @param {{
 *   accounts: object[],
 *   transactions: object[],
 *   categoriesById: Map<number, object>,
 *   monthYear: string,
 * }} input
 */
export function comparePeriods(input) {
  const previousMonthYear = shiftMonthYear(input.monthYear, -1);
  const current = computeDashboardTotals(input.accounts, input.transactions, input.monthYear);
  const previous = computeDashboardTotals(input.accounts, input.transactions, previousMonthYear);
  const currentSpend = spendingByCategory(input.transactions, input.categoriesById, input.monthYear);
  const previousSpend = spendingByCategory(input.transactions, input.categoriesById, previousMonthYear);

  const expenseDeltaMinor = current.expenseMinor - previous.expenseMinor;
  const incomeDeltaMinor = current.incomeMinor - previous.incomeMinor;

  let expenseTrend = "flat";
  if (expenseDeltaMinor > 0) expenseTrend = "up";
  if (expenseDeltaMinor < 0) expenseTrend = "down";

  return {
    monthYear: input.monthYear,
    previousMonthYear,
    currentExpenseMinor: current.expenseMinor,
    previousExpenseMinor: previous.expenseMinor,
    expenseDeltaMinor,
    expenseTrend,
    currentIncomeMinor: current.incomeMinor,
    previousIncomeMinor: previous.incomeMinor,
    incomeDeltaMinor,
    currentSpendTotalMinor: currentSpend.totalMinor,
    previousSpendTotalMinor: previousSpend.totalMinor,
  };
}
