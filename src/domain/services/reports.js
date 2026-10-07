import { shiftMonthYear, toMonthYear, transactionInMonth } from "./financeView";

/**
 * Computes monthly cash flow trend (Income vs Expense vs Net Savings)
 * Explicit rule: Transfers are excluded from cash flow totals.
 */
export function computeCashFlowTrends({
  transactions,
  months = 6,
  endMonthYear = toMonthYear(new Date()),
}) {
  const monthKeys = [];
  let currentKey = endMonthYear;

  for (let i = 0; i < months; i++) {
    monthKeys.unshift(currentKey);
    currentKey = shiftMonthYear(currentKey, -1);
  }

  return monthKeys.map((mKey) => {
    let incomeMinor = 0;
    let expenseMinor = 0;

    for (const tx of transactions) {
      if (!transactionInMonth(tx, mKey)) continue;
      if (tx.type === "INCOME") {
        incomeMinor += tx.amountMinor;
      } else if (tx.type === "EXPENSE") {
        expenseMinor += tx.amountMinor;
      }
      // Transfers are excluded by design
    }

    const netSavingsMinor = incomeMinor - expenseMinor;
    const savingsRatePercent =
      incomeMinor > 0 ? Math.round((netSavingsMinor / incomeMinor) * 100) : 0;

    return {
      monthYear: mKey,
      incomeMinor,
      expenseMinor,
      netSavingsMinor,
      savingsRatePercent,
    };
  });
}

/**
 * Calculates student debt payoff schedule (Credit cards, SPayLater/BNPL, student loans, tuition installments)
 * Projections are estimates and separate from recorded ledger data.
 */
export function calculateDebtPayoffSchedule({
  principalMinor,
  annualInterestRatePercent = 0,
  monthlyPaymentMinor,
  maxMonths = 120,
}) {
  if (principalMinor <= 0) {
    return {
      canPayoff: true,
      monthsToPayoff: 0,
      totalInterestMinor: 0,
      totalPaidMinor: 0,
      schedule: [],
    };
  }

  if (monthlyPaymentMinor <= 0) {
    return {
      canPayoff: false,
      error: "Monthly payment must be greater than zero.",
      monthsToPayoff: 0,
      totalInterestMinor: 0,
      totalPaidMinor: 0,
      schedule: [],
    };
  }

  const monthlyRate = annualInterestRatePercent / 100 / 12;
  const initialMonthlyInterest = Math.round(principalMinor * monthlyRate);

  if (annualInterestRatePercent > 0 && monthlyPaymentMinor <= initialMonthlyInterest) {
    return {
      canPayoff: false,
      error: "Monthly payment is too low to cover accruing interest.",
      monthsToPayoff: 0,
      totalInterestMinor: 0,
      totalPaidMinor: 0,
      schedule: [],
    };
  }

  let remainingMinor = principalMinor;
  let totalInterestMinor = 0;
  let monthsCount = 0;
  const schedule = [];

  while (remainingMinor > 0 && monthsCount < maxMonths) {
    monthsCount++;
    const interestMinor = Math.round(remainingMinor * monthlyRate);
    totalInterestMinor += interestMinor;

    const paymentThisMonth = Math.min(monthlyPaymentMinor, remainingMinor + interestMinor);
    const principalPaidThisMonth = paymentThisMonth - interestMinor;
    remainingMinor = Math.max(0, remainingMinor - principalPaidThisMonth);

    schedule.push({
      month: monthsCount,
      paymentMinor: paymentThisMonth,
      principalPaidMinor: principalPaidThisMonth,
      interestPaidMinor: interestMinor,
      remainingMinor,
    });
  }

  return {
    canPayoff: remainingMinor === 0,
    monthsToPayoff: monthsCount,
    totalInterestMinor,
    totalPaidMinor: principalMinor + totalInterestMinor,
    schedule,
  };
}
