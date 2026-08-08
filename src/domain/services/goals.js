import { assertPositiveInteger, assertSafeInteger } from "../../db/validation";

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   targetMinor: number,
 *   currentMinor: number,
 *   deadlineEpochMillis: number|null,
 *   isArchived: boolean,
 *   createdEpochMillis: number,
 * }} SavingsGoal
 */

/**
 * @param {number} currentMinor
 * @param {number} targetMinor
 * @returns {number} 0–100+
 */
export function goalProgressPercent(currentMinor, targetMinor) {
  if (!Number.isSafeInteger(targetMinor) || targetMinor <= 0) {
    return 0;
  }
  const current = Math.max(0, currentMinor);
  return Math.round((current / targetMinor) * 100);
}

/**
 * @param {Pick<SavingsGoal, 'targetMinor'|'currentMinor'>} goal
 */
export function goalRemainingMinor(goal) {
  return Math.max(0, goal.targetMinor - goal.currentMinor);
}

/**
 * @param {Pick<SavingsGoal, 'targetMinor'|'currentMinor'>} goal
 */
export function isGoalComplete(goal) {
  return goal.currentMinor >= goal.targetMinor && goal.targetMinor > 0;
}

/**
 * Validate contribution amount before applying.
 * @param {number} amountMinor
 * @param {Pick<SavingsGoal, 'targetMinor'|'currentMinor'>} goal
 */
export function applyGoalContribution(goal, amountMinor) {
  assertPositiveInteger(amountMinor, "amountMinor");
  const next = goal.currentMinor + amountMinor;
  assertSafeInteger(next, "currentMinor");
  return {
    currentMinor: next,
    complete: next >= goal.targetMinor,
    overflowMinor: Math.max(0, next - goal.targetMinor),
  };
}

/**
 * Sort active goals: incomplete first, then nearest deadline.
 * @param {SavingsGoal[]} goals
 * @param {number} [now]
 */
export function sortGoalsForDisplay(goals, now = Date.now()) {
  return [...goals]
    .filter((goal) => !goal.isArchived)
    .sort((a, b) => {
      const aDone = isGoalComplete(a) ? 1 : 0;
      const bDone = isGoalComplete(b) ? 1 : 0;
      if (aDone !== bDone) {
        return aDone - bDone;
      }
      const aDue = a.deadlineEpochMillis ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.deadlineEpochMillis ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) {
        return aDue - bDue;
      }
      return a.createdEpochMillis - b.createdEpochMillis;
    })
    .map((goal) => ({
      ...goal,
      progressPercent: goalProgressPercent(goal.currentMinor, goal.targetMinor),
      remainingMinor: goalRemainingMinor(goal),
      isComplete: isGoalComplete(goal),
      isOverdue:
        goal.deadlineEpochMillis !== null
        && goal.deadlineEpochMillis < now
        && !isGoalComplete(goal),
    }));
}
