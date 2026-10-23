import { formatMinor } from "./money";

/**
 * Transaction Split Service (P2 Power Tools)
 * Guarantees exact-sum invariant: sum(splits) === totalMinor
 * All calculations use integer minor units. Local-only.
 */

/**
 * Validates that the sum of splits equals the transaction total.
 * @param {Array<{ amountMinor: number, categoryId?: number, note?: string }>} splits
 * @param {number} totalMinor
 * @returns {{ isValid: boolean, sumMinor: number, diffMinor: number, error: string | null }}
 */
export function validateSplitSum(splits, totalMinor, options = {}) {
  if (!Array.isArray(splits) || splits.length === 0) {
    return {
      isValid: false,
      sumMinor: 0,
      diffMinor: totalMinor,
      error: "At least one split item is required.",
    };
  }

  let sumMinor = 0;
  for (let i = 0; i < splits.length; i++) {
    const item = splits[i];
    const amount = Number(item.amountMinor);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return {
        isValid: false,
        sumMinor,
        diffMinor: totalMinor - sumMinor,
        error: `Split item ${i + 1} must have a positive integer minor amount.`,
      };
    }
    if (options.requireCategory && !item.categoryId && !item.categoryName) {
      return {
        isValid: false,
        sumMinor,
        diffMinor: totalMinor - sumMinor,
        error: `Split item ${i + 1} must have a category.`,
      };
    }
    sumMinor += amount;
  }

  const diffMinor = totalMinor - sumMinor;
  const isValid = diffMinor === 0;

  return {
    isValid,
    sumMinor,
    diffMinor,
    error: isValid ? null : `Splits total (${sumMinor}) does not equal transaction total (${totalMinor}). Difference: ${diffMinor}.`,
  };
}

/**
 * Formats split equation string according to the mathematical invariant.
 * Example: "₱300 + ₱200 = ₱500" or with centavos "₱300.50 + ₱199.50 = ₱500.00"
 * @param {Array<{ amountMinor: number }>} splits
 * @param {number} totalMinor
 * @param {string} currencySymbol
 * @param {{ showCents?: boolean }} [options]
 * @returns {string}
 */
export function formatSplitEquation(splits, totalMinor, currencySymbol = "₱", options = {}) {
  const hasCentavos = (Array.isArray(splits) && splits.some((s) => (Number(s.amountMinor) || 0) % 100 !== 0)) || (Number(totalMinor) || 0) % 100 !== 0;
  const showCents = options.showCents ?? hasCentavos;
  if (!Array.isArray(splits) || splits.length === 0) {
    return `${formatMinor(0, { currencySymbol, showCents })} = ${formatMinor(totalMinor, { currencySymbol, showCents })}`;
  }
  const parts = splits.map((s) => formatMinor(s.amountMinor || 0, { currencySymbol, showCents }));
  return `${parts.join(" + ")} = ${formatMinor(totalMinor, { currencySymbol, showCents })}`;
}

/**
 * Computes split breakdown and remaining unallocated amount.
 * @param {{ totalMinor: number, splits: Array<{ categoryId?: number, categoryName?: string, amountMinor: number, note?: string }> }} input
 */
export function computeSplitBreakdown({ totalMinor, splits = [] }) {
  const sumMinor = splits.reduce((acc, s) => acc + (Number(s.amountMinor) || 0), 0);
  const remainingMinor = totalMinor - sumMinor;
  const items = splits.map((s) => ({
    ...s,
    percentage: totalMinor > 0 ? Math.round(((s.amountMinor || 0) / totalMinor) * 100) : 0,
  }));

  return {
    totalMinor,
    sumMinor,
    remainingMinor,
    isExact: remainingMinor === 0,
    items,
  };
}

/**
 * Builds preview transaction records for saving split items.
 * @param {{ parentTransaction: object, splits: Array<{ categoryId: number, categoryName?: string, amountMinor: number, note?: string }> }} input
 */
export function buildSplitTransactions({ parentTransaction, splits }) {
  const validation = validateSplitSum(splits, parentTransaction.amountMinor);
  if (!validation.isValid) {
    throw new Error(validation.error || "Cannot create split transactions: sum mismatch.");
  }

  return splits.map((split, index) => ({
    type: parentTransaction.type || "EXPENSE",
    accountId: parentTransaction.accountId,
    categoryId: split.categoryId,
    categoryName: split.categoryName,
    amountMinor: split.amountMinor,
    note: (split.note
      ? split.note
      : split.categoryName && parentTransaction.note
      ? `${parentTransaction.note} - ${split.categoryName}`
      : split.categoryName || parentTransaction.note || "Transaction") + ` (Split ${index + 1}/${splits.length})`,
    dateEpochMillis: parentTransaction.dateEpochMillis,
    sourceKey: parentTransaction.sourceKey ? `${parentTransaction.sourceKey}:split:${index}` : undefined,
  }));
}

