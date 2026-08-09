/**
 * Pure guards for delete/archive decisions (no I/O).
 */

/**
 * @param {number} categoryId
 * @param {{ transactions?: object[], budgets?: object[], recurringRules?: object[] }} refs
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canDeleteCategory(categoryId, refs = {}) {
  const txCount = (refs.transactions ?? []).filter((tx) => tx.categoryId === categoryId).length;
  const budgetCount = (refs.budgets ?? []).filter((b) => b.categoryId === categoryId).length;
  const ruleCount = (refs.recurringRules ?? []).filter((r) => r.categoryId === categoryId).length;
  if (txCount + budgetCount + ruleCount === 0) {
    return { ok: true };
  }
  const parts = [];
  if (txCount > 0) parts.push(`${txCount} transaction${txCount === 1 ? "" : "s"}`);
  if (budgetCount > 0) parts.push(`${budgetCount} budget${budgetCount === 1 ? "" : "s"}`);
  if (ruleCount > 0) parts.push(`${ruleCount} recurring rule${ruleCount === 1 ? "" : "s"}`);
  return {
    ok: false,
    reason: `Cannot delete: still used by ${parts.join(", ")}.`,
  };
}

/**
 * @param {number} accountId
 * @param {{ accounts?: object[], transactions?: object[], recurringRules?: object[] }} refs
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canDeleteAccount(accountId, refs = {}) {
  const active = (refs.accounts ?? []).filter((a) => !a.isArchived && a.id !== accountId);
  if (active.length === 0) {
    return {
      ok: false,
      reason: "Keep at least one active account.",
    };
  }
  const txCount = (refs.transactions ?? []).filter((tx) => tx.accountId === accountId).length;
  const ruleCount = (refs.recurringRules ?? []).filter((r) => r.accountId === accountId).length;
  if (txCount + ruleCount === 0) {
    return { ok: true };
  }
  const parts = [];
  if (txCount > 0) parts.push(`${txCount} transaction${txCount === 1 ? "" : "s"}`);
  if (ruleCount > 0) parts.push(`${ruleCount} recurring rule${ruleCount === 1 ? "" : "s"}`);
  return {
    ok: false,
    reason: `Cannot delete: still used by ${parts.join(", ")}.`,
  };
}

/**
 * @param {number} accountId
 * @param {{ accounts?: object[], transactions?: object[], recurringRules?: object[] }} refs
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canArchiveAccount(accountId, refs = {}) {
  return canDeleteAccount(accountId, refs);
}

/**
 * @param {string} name
 * @param {'EXPENSE'|'INCOME'} type
 * @param {object[]} categories
 * @param {number} [excludeId]
 */
export function canRenameCategory(name, type, categories, excludeId) {
  const trimmed = String(name ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "Name is required." };
  }
  const clash = (categories ?? []).find(
    (c) =>
      c.id !== excludeId
      && c.type === type
      && c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (clash) {
    return { ok: false, reason: `A ${type.toLowerCase()} category named “${trimmed}” already exists.` };
  }
  return { ok: true, name: trimmed };
}
