/**
 * Pure recurring catch-up planning.
 * Money stays in integer minor units; this module only schedules timestamps and post descriptors.
 */

const MAX_CATCH_UP_POSTS_PER_RULE = 366;

/**
 * Advance a run instant by one frequency period.
 * MONTHLY uses calendar months and clamps end-of-month overflow (Jan 31 → Feb 28/29).
 * @param {number} epochMillis
 * @param {'DAILY'|'WEEKLY'|'MONTHLY'} frequency
 * @returns {number}
 */
export function advanceNextRunEpochMillis(epochMillis, frequency) {
  if (!Number.isSafeInteger(epochMillis)) {
    throw new Error("epochMillis must be a safe integer.");
  }
  const cursor = new Date(epochMillis);
  if (Number.isNaN(cursor.getTime())) {
    throw new Error("epochMillis is not a valid date.");
  }

  if (frequency === "DAILY") {
    cursor.setDate(cursor.getDate() + 1);
    return cursor.getTime();
  }
  if (frequency === "WEEKLY") {
    cursor.setDate(cursor.getDate() + 7);
    return cursor.getTime();
  }
  if (frequency === "MONTHLY") {
    const dayOfMonth = cursor.getDate();
    cursor.setMonth(cursor.getMonth() + 1, dayOfMonth);
    // Overflow (e.g. Jan 31 → Mar 2/3): pin to the last day of the intended month.
    if (cursor.getDate() !== dayOfMonth) {
      cursor.setDate(0);
    }
    return cursor.getTime();
  }
  throw new Error(`Unsupported frequency: ${frequency}`);
}

/**
 * Plan every missed post for one rule without mutating it.
 * A period posts at most once: each planned run equals the rule's nextRun at that step.
 *
 * @param {{ isActive: boolean, nextRunEpochMillis: number, frequency: 'DAILY'|'WEEKLY'|'MONTHLY', id?: number, amountMinor?: number, type?: string, categoryId?: number, accountId?: number, note?: string|null }} rule
 * @param {number} nowEpochMillis
 * @returns {{ posts: Array<{ runEpochMillis: number }>, nextRunEpochMillis: number, skippedInactive: boolean }}
 */
export function planRecurringCatchUp(rule, nowEpochMillis) {
  if (!Number.isSafeInteger(nowEpochMillis)) {
    throw new Error("nowEpochMillis must be a safe integer.");
  }
  if (!rule.isActive) {
    return {
      posts: [],
      nextRunEpochMillis: rule.nextRunEpochMillis,
      skippedInactive: true,
    };
  }

  /** @type {Array<{ runEpochMillis: number }>} */
  const posts = [];
  let nextRun = rule.nextRunEpochMillis;
  let guard = 0;

  while (nextRun <= nowEpochMillis && guard < MAX_CATCH_UP_POSTS_PER_RULE) {
    posts.push({ runEpochMillis: nextRun });
    nextRun = advanceNextRunEpochMillis(nextRun, rule.frequency);
    guard += 1;
  }

  return {
    posts,
    nextRunEpochMillis: nextRun,
    skippedInactive: false,
  };
}

/**
 * Plan catch-up across many rules (pure).
 * @param {Array<object>} rules
 * @param {number} nowEpochMillis
 */
export function planAllRecurringCatchUp(rules, nowEpochMillis) {
  return rules.map((rule) => ({
    ruleId: rule.id,
    ...planRecurringCatchUp(rule, nowEpochMillis),
  }));
}
