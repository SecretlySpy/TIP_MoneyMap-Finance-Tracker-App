import {
  buildBudgetCards,
  budgetSummary,
  categoryEmoji,
  shiftMonthYear,
  toMonthYear,
  transactionInMonth,
} from "./financeView";

/**
 * @typedef {{ before: string, amountMinor: number, after: string, approximate?: boolean }} TipMoneyCopy
 * @typedef {{ id: string, emoji: string, title: string|TipMoneyCopy, meta: string|TipMoneyCopy, tag: string|TipMoneyCopy }} SmartTip
 * @typedef {{
 *   monthYear: string,
 *   remainingMinor: number,
 *   limitMinor: number,
 *   spentMinor: number,
 *   daysLeftInMonth: number,
 *   dailyAllowanceMinor: number,
 *   tips: SmartTip[],
 * }} SmartTipsSnapshot
 */

/**
 * Calendar days remaining in the month of `monthYear` from `now` (inclusive of today).
 * If viewing a past month, returns 0; future month returns full month length.
 * @param {string} monthYear
 * @param {Date} [now]
 */
export function daysLeftInMonth(monthYear, now = new Date()) {
  const [yearText, monthText] = monthYear.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    return 1;
  }
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const currentMonthYear = toMonthYear(now);
  if (monthYear < currentMonthYear) {
    return 0;
  }
  if (monthYear > currentMonthYear) {
    return lastDay;
  }
  const today = now.getDate();
  return Math.max(0, lastDay - today + 1);
}

/**
 * @param {import('../types').Transaction[]} transactions
 * @param {string} monthYear
 */
function expenseTransactionsInMonth(transactions, monthYear) {
  return transactions.filter(
    (tx) => tx.type === "EXPENSE" && transactionInMonth(tx, monthYear),
  );
}

/**
 * @param {number} remainingMinor
 * @param {number} daysLeft
 */
export function computeDailyAllowanceMinor(remainingMinor, daysLeft) {
  if (remainingMinor <= 0 || daysLeft <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(remainingMinor / daysLeft));
}

/**
 * Tip: remaining budget ÷ days left.
 * @returns {SmartTip | null}
 */
function tipDailyAllowance(remainingMinor, daysLeft, dailyMinor) {
  if (remainingMinor <= 0 || daysLeft <= 0 || dailyMinor <= 0) {
    return null;
  }
  return {
    id: "daily-allowance",
    emoji: "📅",
    title: "Daily allowance",
    meta: {
      before: "",
      amountMinor: remainingMinor,
      after: ` left ÷ ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    },
    tag: {
      before: "~",
      amountMinor: dailyMinor,
      after: "/day",
      approximate: true,
    },
  };
}

/**
 * Tip: category on pace to exceed budget before month end.
 * @returns {SmartTip | null}
 */
function tipBudgetPace(cards, daysLeft, daysInMonth) {
  if (daysLeft <= 0 || daysInMonth <= 0) {
    return null;
  }
  const elapsed = Math.max(1, daysInMonth - daysLeft + 1);
  /** @type {{ card: object, projectedMinor: number, overMinor: number } | null} */
  let worst = null;
  for (const card of cards) {
    if (card.limitMinor <= 0 || card.spentMinor <= 0) {
      continue;
    }
    const projectedMinor = Math.round((card.spentMinor / elapsed) * daysInMonth);
    const overMinor = projectedMinor - card.limitMinor;
    if (overMinor <= 0) {
      continue;
    }
    if (worst === null || overMinor > worst.overMinor) {
      worst = { card, projectedMinor, overMinor };
    }
  }
  if (worst === null) {
    return null;
  }
  return {
    id: `pace-${worst.card.name.toLowerCase().replace(/\s+/g, "-")}`,
    emoji: worst.card.emoji || categoryEmoji(worst.card.name),
    title: `${worst.card.name} is trending over`,
    meta: {
      before: "On pace for ",
      amountMinor: worst.projectedMinor,
      after: ` (${worst.card.percent}% used so far)`,
    },
    tag: {
      before: "+",
      amountMinor: worst.overMinor,
      after: " over",
    },
  };
}

/**
 * Tip: repeated small expense → monthly total (student coffee/load pattern).
 * @returns {SmartTip | null}
 */
function tipRepeatSmallExpense(transactions, monthYear) {
  const expenses = expenseTransactionsInMonth(transactions, monthYear)
    .filter((tx) => tx.amountMinor > 0 && tx.amountMinor <= 25_000);
  if (expenses.length < 3) {
    return null;
  }

  /** @type {Map<string, { count: number, amountMinor: number, note: string|null, categoryId: number }>} */
  const groups = new Map();
  for (const tx of expenses) {
    const noteKey = (tx.note ?? "").trim().toLowerCase();
    const key = noteKey.length > 0
      ? `note:${noteKey}`
      : `cat-amt:${tx.categoryId}:${tx.amountMinor}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        count: 1,
        amountMinor: tx.amountMinor,
        note: tx.note,
        categoryId: tx.categoryId,
      });
    }
  }

  let best = null;
  for (const group of groups.values()) {
    if (group.count < 3) {
      continue;
    }
    const monthlyMinor = group.amountMinor * group.count;
    if (best === null || monthlyMinor > best.monthlyMinor) {
      best = { ...group, monthlyMinor };
    }
  }
  if (best === null) {
    return null;
  }

  const label = best.note?.trim()
    || "small purchase";
  return {
    id: "repeat-small",
    emoji: "🔁",
    title: {
      before: "",
      amountMinor: best.amountMinor,
      after: ` × ${best.count} (${label})`,
    },
    meta: "Repeated small spends this month",
    tag: {
      before: "",
      amountMinor: best.monthlyMinor,
      after: "/mo",
    },
  };
}

/**
 * Tip: this month vs previous month category spend delta.
 * @returns {SmartTip | null}
 */
function tipPeriodComparison(transactions, categoriesById, monthYear) {
  const previousMonth = shiftMonthYear(monthYear, -1);
  const current = expenseTransactionsInMonth(transactions, monthYear);
  const previous = expenseTransactionsInMonth(transactions, previousMonth);
  if (current.length === 0 || previous.length === 0) {
    return null;
  }

  /** @type {Map<number, number>} */
  const currentByCat = new Map();
  /** @type {Map<number, number>} */
  const previousByCat = new Map();
  for (const tx of current) {
    currentByCat.set(tx.categoryId, (currentByCat.get(tx.categoryId) ?? 0) + tx.amountMinor);
  }
  for (const tx of previous) {
    previousByCat.set(tx.categoryId, (previousByCat.get(tx.categoryId) ?? 0) + tx.amountMinor);
  }

  let best = null;
  for (const [categoryId, spentMinor] of currentByCat) {
    const prior = previousByCat.get(categoryId) ?? 0;
    if (prior <= 0) {
      continue;
    }
    const delta = spentMinor - prior;
    if (delta === 0) {
      continue;
    }
    if (best === null || Math.abs(delta) > Math.abs(best.delta)) {
      const category = categoriesById.get(categoryId);
      best = {
        categoryId,
        name: category?.name ?? "Category",
        emoji: categoryEmoji(category?.name ?? "Other"),
        delta,
        spentMinor,
        prior,
      };
    }
  }
  if (best === null) {
    return null;
  }

  const up = best.delta > 0;
  return {
    id: `compare-${best.categoryId}`,
    emoji: best.emoji,
    title: `${best.name} vs last month`,
    meta: {
      before: up ? "Up " : "Down ",
      amountMinor: Math.abs(best.delta),
      after: up ? " from last month" : " from last month",
    },
    tag: up ? "Watch it" : "Nice save",
  };
}

/**
 * Student-framed food daily budget tip when a Food budget exists.
 * @returns {SmartTip | null}
 */
function tipFoodDailyBudget(cards, daysLeft) {
  const food = cards.find((card) => card.name.toLowerCase() === "food");
  if (!food || food.limitMinor <= 0 || daysLeft <= 0) {
    return null;
  }
  const remaining = Math.max(0, food.limitMinor - food.spentMinor);
  if (remaining <= 0) {
    return {
      id: "food-over",
      emoji: "🍜",
      title: "Food budget used up",
      meta: "Try carinderia or home-cooked meals for the rest of the month",
      tag: "Student tip",
    };
  }
  const perDay = computeDailyAllowanceMinor(remaining, daysLeft);
  return {
    id: "food-daily",
    emoji: "🍜",
    title: "Per-day food budget",
    meta: {
      before: "",
      amountMinor: remaining,
      after: " left for food this month",
    },
    tag: {
      before: "~",
      amountMinor: perDay,
      after: "/day",
      approximate: true,
    },
  };
}

/**
 * Derive offline Smart Tips from the user's own budgets and transactions.
 * Pure — no I/O, no network.
 *
 * @param {{
 *   budgets: object[],
 *   transactions: object[],
 *   categories: object[] | Map<number, object>,
 *   monthYear: string,
 *   now?: Date,
 * }} input
 * @returns {SmartTipsSnapshot}
 */
export function deriveSmartTips(input) {
  const now = input.now ?? new Date();
  const monthYear = input.monthYear || toMonthYear(now);
  const categoriesById = input.categories instanceof Map
    ? input.categories
    : new Map((input.categories ?? []).map((category) => [category.id, category]));

  const cards = buildBudgetCards(
    input.budgets ?? [],
    input.transactions ?? [],
    categoriesById,
    monthYear,
  );
  const summary = budgetSummary(cards);
  const daysLeft = daysLeftInMonth(monthYear, now);
  const [yearText, monthText] = monthYear.split("-");
  const daysInMonth = new Date(Number(yearText), Number(monthText), 0).getDate();
  const remainingMinor = Math.max(0, summary.limitMinor - summary.spentMinor);
  const dailyAllowanceMinor = computeDailyAllowanceMinor(remainingMinor, daysLeft);

  /** @type {Array<SmartTip | null>} */
  const candidates = [
    tipDailyAllowance(remainingMinor, daysLeft, dailyAllowanceMinor),
    tipFoodDailyBudget(cards, daysLeft),
    tipBudgetPace(cards, daysLeft, daysInMonth),
    tipRepeatSmallExpense(input.transactions ?? [], monthYear),
    tipPeriodComparison(input.transactions ?? [], categoriesById, monthYear),
  ];

  const tips = candidates.filter((tip) => tip !== null);

  // Empty but honest state when there is not enough data yet.
  if (tips.length === 0) {
    tips.push({
      id: "empty-data",
      emoji: "✨",
      title: "Log a few spends to unlock tips",
      meta: "Tips use your budgets and transactions — fully offline",
      tag: "Get started",
    });
  }

  return {
    monthYear,
    remainingMinor,
    limitMinor: summary.limitMinor,
    spentMinor: summary.spentMinor,
    daysLeftInMonth: daysLeft,
    dailyAllowanceMinor,
    tips,
  };
}
