/**
 * Pure recurring catch-up planning.
 * Money stays in integer minor units; this module only schedules timestamps and post descriptors.
 */

const MAX_CATCH_UP_POSTS_PER_RULE = 366;

/**
 * Advance a run instant by one frequency period.
 * MONTHLY uses calendar months and clamps end-of-month overflow (Jan 31 → Feb 28/29).
 * Pass anchorDay to keep the intended day-of-month across a clamped short month, so
 * Jan 31 → Feb 28 → Mar 31 rather than drifting to the 28th permanently.
 * @param {number} epochMillis
 * @param {'DAILY'|'WEEKLY'|'MONTHLY'} frequency
 * @param {number} [anchorDay] intended day-of-month (1-31); defaults to this run's day
 * @returns {number}
 */
export function advanceNextRunEpochMillis(epochMillis, frequency, anchorDay) {
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
    const intendedDay = Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= 31
      ? anchorDay
      : cursor.getDate();
    // Land on the 1st first so setMonth cannot roll past the target month.
    const targetMonth = cursor.getMonth() + 1;
    cursor.setDate(1);
    cursor.setMonth(targetMonth, intendedDay);
    // Overflow (e.g. anchor 31 in February): pin to the last day of the intended month.
    if (cursor.getMonth() !== ((targetMonth % 12) + 12) % 12) {
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
 * @param {{ isActive: boolean, nextRunEpochMillis: number, frequency: 'DAILY'|'WEEKLY'|'MONTHLY', anchorDay?: number|null, id?: number, amountMinor?: number, type?: string, categoryId?: number, accountId?: number, note?: string|null }} rule
 * @param {number} nowEpochMillis
 * @returns {{ posts: Array<{ runEpochMillis: number }>, nextRunEpochMillis: number, anchorDay: number, skippedInactive: boolean }}
 */
export function planRecurringCatchUp(rule, nowEpochMillis) {
  if (!Number.isSafeInteger(nowEpochMillis)) {
    throw new Error("nowEpochMillis must be a safe integer.");
  }
  // Persisted anchor wins; otherwise adopt the current run's day as the intent.
  const anchorDay = Number.isInteger(rule.anchorDay) && rule.anchorDay >= 1 && rule.anchorDay <= 31
    ? rule.anchorDay
    : new Date(rule.nextRunEpochMillis).getDate();
  if (!rule.isActive) {
    return {
      posts: [],
      nextRunEpochMillis: rule.nextRunEpochMillis,
      anchorDay,
      skippedInactive: true,
    };
  }

  /** @type {Array<{ runEpochMillis: number }>} */
  const posts = [];
  let nextRun = rule.nextRunEpochMillis;
  let guard = 0;

  while (nextRun <= nowEpochMillis && guard < MAX_CATCH_UP_POSTS_PER_RULE) {
    posts.push({ runEpochMillis: nextRun });
    nextRun = advanceNextRunEpochMillis(nextRun, rule.frequency, anchorDay);
    guard += 1;
  }

  return {
    posts,
    nextRunEpochMillis: nextRun,
    anchorDay,
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
