import { shiftMonthYear, transactionInMonth } from "./financeView";
import { formatMinor } from "./money";

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

  // Calculate current month spending
  let actualSpentMinor = 0;
  for (const tx of transactions) {
    if (
      tx.type === "EXPENSE" &&
      tx.categoryId === categoryId &&
      transactionInMonth(tx, monthYear)
    ) {
      actualSpentMinor += tx.amountMinor;
    }
  }

  if (!priorBudget) {
    const nextCarryMinor = currentLimitMinor - actualSpentMinor;
    return {
      priorMonthYear,
      priorCarryMinor: 0,
      priorLimitMinor: 0,
      priorSpentMinor: 0,
      planMinor: currentLimitMinor,
      currentLimitMinor,
      effectiveLimitMinor: currentLimitMinor,
      actualSpentMinor,
      nextCarryMinor,
      formulaDescription: "Prior carry + plan − actual = next carry",
      safeToSpendGuarantee: "No double-count with Safe-to-Spend or goals.",
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
  const nextCarryMinor = priorCarryMinor + currentLimitMinor - actualSpentMinor;

  return {
    priorMonthYear,
    priorCarryMinor,
    priorLimitMinor: priorBudget.limitMinor,
    priorSpentMinor,
    planMinor: currentLimitMinor,
    currentLimitMinor,
    effectiveLimitMinor,
    actualSpentMinor,
    nextCarryMinor,
    formulaDescription: "Prior carry + plan − actual = next carry",
    safeToSpendGuarantee: "No double-count with Safe-to-Spend or goals.",
    hasPriorBudget: true,
  };
}

/**
 * Format rollover formula according to Phase 2 Frame 299:2788
 * Example: "₱200 + ₱2,000 − ₱1,750 = ₱450"
 */
export function formatRolloverEquation(priorCarryMinor, planMinor, actualSpentMinor, nextCarryMinor, currencySymbol = "₱") {
  const p = formatMinor(priorCarryMinor, { currencySymbol, showCents: false });
  const l = formatMinor(planMinor, { currencySymbol, showCents: false });
  const a = formatMinor(actualSpentMinor, { currencySymbol, showCents: false });
  const n = formatMinor(nextCarryMinor, { currencySymbol, showCents: false });
  return `${p} + ${l} − ${a} = ${n}`;
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

import { DEFAULT_STUDENT_TEMPLATES } from "./budgetTemplates";

/**
 * Student Semester Planning Templates (amounts in PHP minor units)
 * Re-exported from domain budgetTemplates service for backwards compatibility.
 */
export const SEMESTER_TEMPLATES = DEFAULT_STUDENT_TEMPLATES;

