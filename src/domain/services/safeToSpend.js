import { buildBudgetCards, budgetSummary, transactionInMonth } from "./financeView";

/**
 * Pure Safe-to-Spend: remaining budgets − upcoming recurring − goal reserves.
 * All values integer minor units.
 *
 * @param {{
 *   budgets: object[],
 *   transactions: object[],
 *   categoriesById: Map<number, object>,
 *   recurringRules: object[],
 *   goals: object[],
 *   monthYear: string,
 *   nowEpochMillis?: number,
 * }} input
 */
export function computeSafeToSpend(input) {
  const now = input.nowEpochMillis ?? Date.now();
  const cards = buildBudgetCards(
    input.budgets ?? [],
    input.transactions ?? [],
    input.categoriesById,
    input.monthYear,
  );
  const summary = budgetSummary(cards);
  const remainingBudgetsMinor = Math.max(0, summary.limitMinor - summary.spentMinor);

  const upcomingRecurringMinor = (input.recurringRules ?? [])
    .filter((rule) => rule.isActive && rule.type === "EXPENSE")
    .filter((rule) => transactionInMonth(
      { dateEpochMillis: rule.nextRunEpochMillis, type: "EXPENSE", amountMinor: 1 },
      input.monthYear,
    ) || rule.nextRunEpochMillis <= now + 14 * 24 * 60 * 60 * 1000)
    .reduce((sum, rule) => sum + Math.max(0, rule.amountMinor), 0);

  // Reserves: remaining toward incomplete, non-archived goals.
  const goalReservesMinor = (input.goals ?? [])
    .filter((goal) => !goal.isArchived)
    .reduce((sum, goal) => {
      const remaining = Math.max(0, goal.targetMinor - goal.currentMinor);
      return sum + remaining;
    }, 0);

  // Cap goal drag so open-ended large goals don't zero the card permanently.
  const cappedGoalReserves = Math.min(goalReservesMinor, remainingBudgetsMinor);

  const safeMinor = remainingBudgetsMinor - upcomingRecurringMinor - cappedGoalReserves;
  let state = "comfortable";
  if (safeMinor <= 0) {
    state = "over";
  } else if (remainingBudgetsMinor > 0 && safeMinor < remainingBudgetsMinor * 0.2) {
    state = "tight";
  }

  return {
    remainingBudgetsMinor,
    upcomingRecurringMinor,
    goalReservesMinor: cappedGoalReserves,
    safeMinor,
    state,
  };
}
