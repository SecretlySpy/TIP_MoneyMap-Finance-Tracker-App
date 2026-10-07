/**
 * Local recurring transaction detection.
 * Pure detection service - NEVER mutates the database or creates ledger rows automatically.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeMerchant(note) {
  if (!note || typeof note !== "string") return "";
  return note
    .trim()
    .toLowerCase()
    .replace(/[—–-].*$/, "") // Remove sub-notes like "Lunch — Jollibee" -> "lunch"
    .replace(/\s+/g, " ")
    .trim();
}

export function detectRecurringCandidates({
  transactions,
  recurringRules = [],
  dismissedKeys = [],
}) {
  // 1. Identify existing rule signatures to avoid recommending duplicate bills
  const existingRuleNotes = new Set(
    recurringRules.map((rule) => (rule.note ? normalizeMerchant(rule.note) : ""))
  );

  // 2. Filter expenses with a note
  const validExpenses = transactions.filter(
    (tx) => tx.type === "EXPENSE" && tx.note && tx.note.trim().length >= 2
  );

  // 3. Group by normalized merchant and account
  const groups = new Map();
  for (const tx of validExpenses) {
    const merchant = normalizeMerchant(tx.note);
    if (!merchant || existingRuleNotes.has(merchant)) {
      continue;
    }
    const groupKey = `${tx.accountId || 0}:${merchant}`;
    const list = groups.get(groupKey) || [];
    list.push(tx);
    groups.set(groupKey, list);
  }

  const candidates = [];

  for (const [groupKey, txList] of groups.entries()) {
    if (txList.length < 2) continue;

    // Sort by date ascending
    txList.sort((a, b) => a.dateEpochMillis - b.dateEpochMillis);

    // Calculate intervals between occurrences
    const intervals = [];
    for (let i = 1; i < txList.length; i++) {
      const diffDays = Math.round((txList[i].dateEpochMillis - txList[i - 1].dateEpochMillis) / DAY_MS);
      if (diffDays > 0) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) continue;

    const avgIntervalDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    let frequency = null;
    if (avgIntervalDays >= 5 && avgIntervalDays <= 10) {
      frequency = "WEEKLY";
    } else if (avgIntervalDays >= 24 && avgIntervalDays <= 38) {
      frequency = "MONTHLY";
    }

    if (!frequency) {
      continue; // Irregular cadence, skip
    }

    // Check amount consistency
    const amounts = txList.map((t) => t.amountMinor);
    const avgAmountMinor = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
    const latestTx = txList[txList.length - 1];
    const previousAmounts = amounts.slice(0, -1);
    const prevAvgAmount = previousAmounts.length > 0
      ? Math.round(previousAmounts.reduce((a, b) => a + b, 0) / previousAmounts.length)
      : avgAmountMinor;

    // Detect price change if latest is >5% different from previous average
    const priceChangeRatio = Math.abs(latestTx.amountMinor - prevAvgAmount) / (prevAvgAmount || 1);
    const hasPriceChange = previousAmounts.length > 0 && priceChangeRatio > 0.05;

    // Next expected charge date
    const intervalDays = frequency === "WEEKLY" ? 7 : 30;
    const nextExpectedEpochMillis = latestTx.dateEpochMillis + intervalDays * DAY_MS;

    const [accIdStr, merchant] = groupKey.split(":");
    const accountId = Number(accIdStr);
    const candidateKey = `detected:${accountId}:${merchant}:${frequency}`;

    if (dismissedKeys.includes(candidateKey)) {
      continue;
    }

    const count = txList.length;
    const cadenceLabel = frequency === "WEEKLY" ? "weekly" : "monthly";
    const confidenceExplanation = `Charged ${count} times ${cadenceLabel} (approx. every ${Math.round(avgIntervalDays)} days).`;

    candidates.push({
      key: candidateKey,
      merchant: latestTx.note.trim(),
      normalizedMerchant: merchant,
      accountId: latestTx.accountId,
      categoryId: latestTx.categoryId,
      frequency,
      cadenceLabel,
      occurrenceCount: count,
      usualAmountMinor: prevAvgAmount,
      latestAmountMinor: latestTx.amountMinor,
      hasPriceChange,
      priceChangeDifferenceMinor: latestTx.amountMinor - prevAvgAmount,
      confidenceExplanation,
      lastChargedEpochMillis: latestTx.dateEpochMillis,
      nextExpectedEpochMillis,
    });
  }

  // Sort by occurrence count descending, then latest charge date descending
  return candidates.sort((a, b) => {
    if (b.occurrenceCount !== a.occurrenceCount) {
      return b.occurrenceCount - a.occurrenceCount;
    }
    return b.lastChargedEpochMillis - a.lastChargedEpochMillis;
  });
}
