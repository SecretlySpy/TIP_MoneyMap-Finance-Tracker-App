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
        error: `Split item ${i + 1} must have a positive amount.`,
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
    error: isValid ? null : "Split amounts do not equal the purchase total.",
  };
}

/**
 * Formats split equation string according to the mathematical invariant.
 * Example: "₱300 + ₱200 = ₱500".
 * @param {Array<{ amountMinor: number }>} splits
 * @param {number} totalMinor
 * @param {string} currencySymbol
 * @param {{ showCents?: boolean }} [options]
 * @returns {string}
 */
export function formatSplitEquation(splits, totalMinor, currencySymbol = "₱", options = {}) {
  const hasCentavos = (Array.isArray(splits) && splits.some((s) => (Number(s.amountMinor) || 0) % 100 !== 0)) || (Number(totalMinor) || 0) % 100 !== 0;
  const showCents = options.showCents ?? hasCentavos;
  // Individually rounded historic allocations need not add to the rounded total.
  if (currencySymbol === "₱" && hasCentavos) {
    return `Split total ${formatMinor(totalMinor, { currencySymbol })}`;
  }
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
 * Generates a stable unique identifier for a split transaction group.
 * Format: spg_<timestamp>_<random>
 * @returns {string}
 */
export function generateSplitGroupId() {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  return `spg_${timestamp}_${rand}`;
}

/**
 * Strips technical "(Split X/Y)" suffix from note text.
 * @param {string | null | undefined} note
 * @returns {string | null}
 */
export function stripSplitSuffix(note) {
  if (typeof note !== "string") return "";
  const cleaned = note.replace(/\s*[\(\[]\s*Split\s+\d+(\/|\s+of\s+)\d+\s*[\]\)]\s*$/i, "").trim();
  return cleaned;
}

/**
 * Extracts parent/overall purchase note by removing generated category suffix and split suffix.
 * E.g., "School supplies - Books (Split 1/2)" -> "School supplies"
 * @param {string | null | undefined} note
 * @param {string | null | undefined} categoryName
 * @returns {string | null}
 */
export function extractParentNote(note, categoryName) {
  const stripped = stripSplitSuffix(note);
  if (!stripped) return null;
  if (categoryName) {
    const catLower = categoryName.toLowerCase();
    const strippedLower = stripped.toLowerCase();
    if (strippedLower.endsWith(` - ${catLower}`)) {
      const parent = stripped.slice(0, -(categoryName.length + 3)).trim();
      return parent.length > 0 ? parent : null;
    }
    if (strippedLower.endsWith(`: ${catLower}`)) {
      const parent = stripped.slice(0, -(categoryName.length + 2)).trim();
      return parent.length > 0 ? parent : null;
    }
    if (strippedLower === catLower) {
      return null;
    }
  }
  const separatorMatch = stripped.match(/^(.*?)\s*[-:]\s*[^-:]+$/);
  if (separatorMatch && separatorMatch[1].trim().length > 0) {
    return separatorMatch[1].trim();
  }
  return stripped;
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

  const splitGroupId = parentTransaction.splitGroupId ?? undefined;

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
    splitGroupId,
  }));
}

/**
 * Groups raw database transactions into logical items for history and dashboard.
 * Preserves normal single transactions and combines split allocations into one logical purchase.
 * @param {Array<object>} transactions
 * @param {Array<object>} [transactionGroups]
 * @returns {Array<object>}
 */
export function groupTransactionsBySplit(transactions, transactionGroups = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  const groupsById = new Map();
  for (const group of transactionGroups ?? []) {
    if (group && group.id) {
      groupsById.set(group.id, group);
    }
  }

  const splitBuckets = new Map();
  const unassigned = [];

  for (const tx of transactions) {
    if (tx.splitGroupId) {
      const list = splitBuckets.get(tx.splitGroupId) ?? [];
      list.push(tx);
      splitBuckets.set(tx.splitGroupId, list);
    } else {
      unassigned.push(tx);
    }
  }

  const result = [];

  // 1. Process explicit splitGroupId buckets
  for (const [groupId, allocations] of splitBuckets.entries()) {
    if (allocations.length >= 2) {
      const sorted = [...allocations].sort((a, b) => a.id - b.id);
      const groupMeta = groupsById.get(groupId);
      const first = sorted[0];
      const totalAmountMinor = sorted.reduce((sum, a) => sum + (Number(a.amountMinor) || 0), 0);
      
      let title = groupMeta?.title?.trim() || null;
      if (!title) {
        for (const a of sorted) {
          const parent = extractParentNote(a.note, a.categoryName);
          if (parent) {
            title = parent;
            break;
          }
        }
      }

      result.push({
        id: `group:${groupId}`,
        isGroup: true,
        splitGroupId: groupId,
        title,
        amountMinor: totalAmountMinor,
        type: first.type || "EXPENSE",
        accountId: groupMeta?.accountId ?? first.accountId,
        dateEpochMillis: groupMeta?.dateEpochMillis ?? first.dateEpochMillis,
        allocations: sorted,
        allocationCount: sorted.length,
        splitCategoryCount: sorted.length,
        categoryId: first.categoryId,
      });
    } else {
      // Degraded to single allocation
      result.push(...allocations);
    }
  }

  // 2. Identify provable legacy split transactions among unassigned
  const remainingUnassigned = [];
  const legacyBuckets = new Map();

  for (const tx of unassigned) {
    let legacyKey = null;

    if (tx.sourceKey && typeof tx.sourceKey === "string") {
      const match = tx.sourceKey.match(/^(?:split:)?(.*?)(?::split)?:\d+$/i);
      if (match && match[1]) {
        legacyKey = `source:${tx.accountId}:${tx.dateEpochMillis}:${match[1]}`;
      }
    }

    if (!legacyKey && tx.note && typeof tx.note === "string") {
      const noteMatch = tx.note.match(/^(.*?)\s*[\(\[]\s*Split\s+(\d+)\/(\d+)\s*[\]\)]\s*$/i);
      if (noteMatch) {
        const baseNote = noteMatch[1].trim();
        const totalSplits = parseInt(noteMatch[3], 10);
        const parentTitle = extractParentNote(tx.note, tx.categoryName) || baseNote;
        legacyKey = `note:${tx.accountId}:${tx.dateEpochMillis}:${tx.type}:${parentTitle}:${totalSplits}`;
      }
    }

    if (legacyKey) {
      const list = legacyBuckets.get(legacyKey) ?? [];
      list.push(tx);
      legacyBuckets.set(legacyKey, list);
    } else {
      remainingUnassigned.push(tx);
    }
  }

  for (const [key, allocations] of legacyBuckets.entries()) {
    if (allocations.length >= 2) {
      const sorted = [...allocations].sort((a, b) => a.id - b.id);
      const first = sorted[0];
      const totalAmountMinor = sorted.reduce((sum, a) => sum + (Number(a.amountMinor) || 0), 0);
      let title = null;
      for (const a of sorted) {
        const parent = extractParentNote(a.note, a.categoryName);
        if (parent) {
          title = parent;
          break;
        }
      }
      if (!title) {
        title = stripSplitSuffix(first.note) || `Expense · ${sorted.length} categories`;
      }

      const syntheticGroupId = `legacy_${first.id}`;
      result.push({
        id: `group:${syntheticGroupId}`,
        isGroup: true,
        splitGroupId: syntheticGroupId,
        title,
        amountMinor: totalAmountMinor,
        type: first.type || "EXPENSE",
        accountId: first.accountId,
        dateEpochMillis: first.dateEpochMillis,
        allocations: sorted,
        allocationCount: sorted.length,
        splitCategoryCount: sorted.length,
        categoryId: first.categoryId,
      });
    } else {
      remainingUnassigned.push(...allocations);
    }
  }

  // 3. Add remaining non-split unassigned transactions
  result.push(...remainingUnassigned);

  return result;
}

