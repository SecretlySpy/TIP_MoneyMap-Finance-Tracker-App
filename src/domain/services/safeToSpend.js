import { buildBudgetCards, budgetSummary } from "./financeView";
import { advanceNextRunEpochMillis } from "./recurringCatchUp";

const MAX_PROJECTED_RECURRING_RUNS = 366;

function monthBounds(monthYear) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthYear ?? ""));
  if (match === null) {
    throw new Error("monthYear must use YYYY-MM format.");
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error("monthYear must use a real calendar month.");
  }
  return {
    start: new Date(year, monthIndex, 1, 0, 0, 0, 0).getTime(),
    end: new Date(year, monthIndex + 1, 1, 0, 0, 0, 0).getTime() - 1,
    year,
    monthIndex,
  };
}

function monthlyGoalContribution(goal, bounds) {
  if (goal.isArchived || goal.deadlineEpochMillis === null) {
    return 0;
  }
  const remaining = Math.max(0, goal.targetMinor - goal.currentMinor);
  if (remaining === 0 || goal.createdEpochMillis > bounds.end) {
    return 0;
  }
  const deadline = new Date(goal.deadlineEpochMillis);
  const monthsThroughDeadline =
    (deadline.getFullYear() - bounds.year) * 12
    + deadline.getMonth()
    - bounds.monthIndex
    + 1;
  return Math.ceil(remaining / Math.max(1, monthsThroughDeadline));
}

function projectedRecurring(rule, postedRuns, bounds) {
  const empty = { count: 0, minor: 0 };
  if (!rule.isActive || rule.type !== "EXPENSE" || rule.nextRunEpochMillis > bounds.end) {
    return empty;
  }
  let nextRun = rule.nextRunEpochMillis;
  let minor = 0;
  let count = 0;
  let guard = 0;
  const frequency = ["DAILY", "WEEKLY", "MONTHLY"].includes(rule.frequency)
    ? rule.frequency
    : "MONTHLY";
  while (nextRun <= bounds.end && guard < MAX_PROJECTED_RECURRING_RUNS) {
    if (nextRun >= bounds.start && !postedRuns?.has(nextRun)) {
      minor += Math.max(0, rule.amountMinor);
      count += 1;
    }
    nextRun = advanceNextRunEpochMillis(nextRun, frequency, rule.anchorDay);
    guard += 1;
  }
  return { count, minor };
}

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
  const bounds = monthBounds(input.monthYear);
  const cards = buildBudgetCards(
    input.budgets ?? [],
    input.transactions ?? [],
    input.categoriesById,
    input.monthYear,
  );
  const summary = budgetSummary(cards);
  const rawBudgetHeadroomMinor = summary.limitMinor - summary.spentMinor;
  const remainingBudgetsMinor = Math.max(0, rawBudgetHeadroomMinor);

  // Index posted occurrences once instead of scanning the ledger for every rule.
  const postedRunsByRule = new Map();
  for (const transaction of input.transactions ?? []) {
    if (transaction.recurringRuleId == null) continue;
    if (!postedRunsByRule.has(transaction.recurringRuleId)) {
      postedRunsByRule.set(transaction.recurringRuleId, new Set());
    }
    postedRunsByRule.get(transaction.recurringRuleId).add(transaction.dateEpochMillis);
  }
  const projected = (input.recurringRules ?? []).map((rule) =>
    projectedRecurring(rule, postedRunsByRule.get(rule.id), bounds)
  );
  const upcomingRecurringMinor = projected.reduce((sum, item) => sum + item.minor, 0);
  const upcomingRecurringCount = projected.reduce((sum, item) => sum + item.count, 0);

  // Only deadline-based monthly contributions are commitments for this month.
  const goalContributions = (input.goals ?? []).map((goal) => monthlyGoalContribution(goal, bounds));
  const goalReservesMinor = goalContributions.reduce((sum, minor) => sum + minor, 0);
  const goalReserveCount = goalContributions.filter((minor) => minor > 0).length;

  const rawSafeMinor = rawBudgetHeadroomMinor - upcomingRecurringMinor - goalReservesMinor;
  const safeMinor = Math.max(0, rawSafeMinor);
  const overCommittedMinor = Math.max(0, -rawSafeMinor);
  const hasCommitments = summary.limitMinor > 0
    || upcomingRecurringMinor > 0
    || goalReservesMinor > 0;
  let state;
  if (!hasCommitments) {
    // Nothing to measure against yet: the card should invite setup, not warn.
    state = "unset";
  } else if (rawSafeMinor <= 0) {
    state = "over";
  } else if (remainingBudgetsMinor > 0 && safeMinor < remainingBudgetsMinor * 0.2) {
    state = "tight";
  } else {
    state = "comfortable";
  }

  return {
    remainingBudgetsMinor,
    upcomingRecurringMinor,
    upcomingRecurringCount,
    goalReservesMinor,
    goalReserveCount,
    safeMinor,
    overCommittedMinor,
    state,
  };
}
