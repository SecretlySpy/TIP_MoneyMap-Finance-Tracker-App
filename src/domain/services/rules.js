/**
 * Transaction Rules Domain Service (P2 Power Tools)
 * Merchant/note keyword rules for automatic category assignment.
 * Preview-first, local-only, never mutates ledger without confirmation.
 */

/**
 * Creates a normalized rule object.
 * @param {{ id?: string | number, pattern: string, categoryId: number, categoryName: string, matchType?: "CONTAINS" | "EXACT" | "STARTS_WITH" }} param0
 */
export function createRule({ id, pattern, categoryId, categoryName, matchType = "CONTAINS" }) {
  if (!pattern || typeof pattern !== "string" || !pattern.trim()) {
    throw new Error("Rule pattern cannot be empty.");
  }
  if (!categoryId && categoryId !== 0) {
    throw new Error("Rule must designate a valid categoryId.");
  }

  return {
    id: id ?? `rule:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    pattern: pattern.trim().toLowerCase(),
    categoryId: Number(categoryId),
    categoryName: categoryName || "Categorized",
    matchType,
  };
}

/**
 * Evaluates whether a transaction note matches a rule.
 * @param {string} note
 * @param {{ pattern: string, matchType?: string }} rule
 * @returns {boolean}
 */
export function testRule(note, rule) {
  if (!note || typeof note !== "string" || !rule?.pattern) return false;
  const normalizedNote = note.toLowerCase().trim();
  const pattern = rule.pattern.toLowerCase().trim();

  switch (rule.matchType) {
    case "EXACT":
      return normalizedNote === pattern;
    case "STARTS_WITH":
      return normalizedNote.startsWith(pattern);
    case "CONTAINS":
    default:
      return normalizedNote.includes(pattern);
  }
}

/**
 * Finds the first matching rule for a given note.
 * @param {string} note
 * @param {Array<object>} rules
 * @returns {object | null}
 */
export function matchCategoryRule(note, rules) {
  if (!note || !Array.isArray(rules)) return null;
  for (const rule of rules) {
    if (testRule(note, rule)) {
      return rule;
    }
  }
  return null;
}

/**
 * Previews rule matches across transactions (pure preview, 0 mutations).
 * @param {Array<object>} transactions
 * @param {Array<object>} rules
 * @returns {Array<{ transactionId: number, originalCategoryId: number, proposedCategoryId: number, proposedCategoryName: string, matchedRule: object }>}
 */
export function applyRulesPreview(transactions, rules) {
  if (!Array.isArray(transactions) || !Array.isArray(rules)) return [];

  const proposals = [];
  for (const tx of transactions) {
    const matched = matchCategoryRule(tx.note, rules);
    if (matched && matched.categoryId !== tx.categoryId) {
      proposals.push({
        transactionId: tx.id,
        note: tx.note,
        originalCategoryId: tx.categoryId,
        proposedCategoryId: matched.categoryId,
        proposedCategoryName: matched.categoryName,
        matchedRule: matched,
      });
    }
  }

  return proposals;
}
