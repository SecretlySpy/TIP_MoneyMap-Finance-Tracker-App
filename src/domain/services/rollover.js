import { shiftMonthYear, transactionInMonth } from "./financeView";

/**
 * Formula: prior carry + this month limit - actual spending = next carry
 * A positive carry indicates surplus budget to roll forward.
 * A negative carry indicates overspending/deficit carried forward.
 */
export function computeCategoryRollover({
  categoryId,
  monthYear,
  budgets,
  transactions,
  maxMonthsBack = 12,
}) {
  const currentBudget = budgets.find(
    (b) => b.categoryId === categoryId && b.monthYear === monthYear
  );
  const currentLimitMinor = currentBudget ? currentBudget.limitMinor : 0;

  // Calculate prior month
  const priorMonthYear = shiftMonthYear(monthYear, -1);
  const priorBudget = budgets.find(
    (b) => b.categoryId === categoryId && b.monthYear === priorMonthYear
  );

  if (!priorBudget) {
    return {
      priorMonthYear,
      priorCarryMinor: 0,
      currentLimitMinor,
      effectiveLimitMinor: currentLimitMinor,
      hasPriorBudget: false,
    };
  }

  // Calculate prior month spending
  let priorSpentMinor = 0;
  for (const tx of transactions) {
    if (
      tx.type === "EXPENSE" &&
      tx.categoryId === categoryId &&
      transactionInMonth(tx, priorMonthYear)
    ) {
      priorSpentMinor += tx.amountMinor;
    }
  }

  const priorCarryMinor = priorBudget.limitMinor - priorSpentMinor;
  const effectiveLimitMinor = Math.max(0, currentLimitMinor + priorCarryMinor);

  return {
    priorMonthYear,
    priorCarryMinor,
    priorLimitMinor: priorBudget.limitMinor,
    priorSpentMinor,
    currentLimitMinor,
    effectiveLimitMinor,
    hasPriorBudget: true,
  };
}

/**
 * Copy all budgets from a previous month into a target month
 */
export function getBudgetsToCopy({ fromMonthYear, toMonthYear, budgets }) {
  const sourceBudgets = budgets.filter((b) => b.monthYear === fromMonthYear);
  const existingCategoryIds = new Set(
    budgets.filter((b) => b.monthYear === toMonthYear).map((b) => b.categoryId)
  );

  return sourceBudgets.filter((b) => !existingCategoryIds.has(b.categoryId));
}

/**
 * Student Semester Planning Templates (amounts in PHP minor units)
 */
export const SEMESTER_TEMPLATES = [
  {
    id: "standard-student",
    name: "Standard Student Semester",
    description: "Balanced budget for tuition, books, commute, meals, and emergency fund.",
    categories: [
      { name: "Food", amountMinor: 450_000, emoji: "🍜" },
      { name: "Transport", amountMinor: 200_000, emoji: "🚌" },
      { name: "School Supplies", amountMinor: 150_000, emoji: "📚" },
      { name: "Load/Data", amountMinor: 50_000, emoji: "📱" },
      { name: "Emergency Buffer", amountMinor: 100_000, emoji: "🛡️" },
    ],
  },
  {
    id: "commuter-student",
    name: "Daily Commuter Plan",
    description: "Optimized for daily transit (jeep, bus, LRT) and campus meals.",
    categories: [
      { name: "Food", amountMinor: 350_000, emoji: "🍜" },
      { name: "Transport", amountMinor: 250_000, emoji: "🚌" },
      { name: "Load/Data", amountMinor: 40_000, emoji: "📱" },
      { name: "School Projects", amountMinor: 120_000, emoji: "📑" },
      { name: "Emergency Buffer", amountMinor: 80_000, emoji: "🛡️" },
    ],
  },
  {
    id: "dormer-student",
    name: "Dormer / Boarding House Plan",
    description: "Covers monthly dorm rent, utilities, groceries, and laundry.",
    categories: [
      { name: "Rent & Boarding", amountMinor: 500_000, emoji: "🏠" },
      { name: "Food & Groceries", amountMinor: 550_000, emoji: "🛒" },
      { name: "School Supplies", amountMinor: 100_000, emoji: "📚" },
      { name: "Laundry & Personal", amountMinor: 120_000, emoji: "🧺" },
      { name: "Emergency Buffer", amountMinor: 150_000, emoji: "🛡️" },
    ],
  },
];
