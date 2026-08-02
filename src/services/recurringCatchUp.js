import { RecurringRepository, TransactionRepository } from "../db/repositories";
import { planRecurringCatchUp } from "../domain/services/recurringCatchUp";

/**
 * @typedef {import('../domain/types').RecurringRule} RecurringRule
 * @typedef {Object} CatchUpSummary
 * @property {number} rulesProcessed
 * @property {number} transactionsCreated
 * @property {number} transactionsSkippedDuplicate
 */

/**
 * True when a transaction for this rule and scheduled run already exists.
 * @param {{ execute: Function }} database
 * @param {number} recurringRuleId
 * @param {number} runEpochMillis
 */
async function hasPostedRun(database, recurringRuleId, runEpochMillis) {
  const result = await database.execute(
    `SELECT id FROM transactions
      WHERE recurring_rule_id = ? AND date_epoch_millis = ?
      LIMIT 1`,
    [recurringRuleId, runEpochMillis],
  );
  return (result.rows?.length ?? 0) > 0;
}

/**
 * Post every due occurrence for active rules, advancing nextRun after each period.
 * Idempotent: re-running after success creates zero new rows; mid-failure recovery
 * skips runs that already have a matching (ruleId, dateEpochMillis) transaction.
 *
 * @param {object} database op-sqlite / test DB handle
 * @param {{ nowEpochMillis?: number }} [options]
 * @returns {Promise<CatchUpSummary>}
 */
export async function runRecurringCatchUp(database, options = {}) {
  const nowEpochMillis = options.nowEpochMillis ?? Date.now();
  const recurringRepo = new RecurringRepository(database);
  const transactionRepo = new TransactionRepository(database);
  const rules = await recurringRepo.list();

  let transactionsCreated = 0;
  let transactionsSkippedDuplicate = 0;
  let rulesProcessed = 0;

  for (const rule of rules) {
    if (!rule.isActive) {
      continue;
    }
    rulesProcessed += 1;
    const plan = planRecurringCatchUp(rule, nowEpochMillis);
    if (plan.posts.length === 0) {
      continue;
    }

    for (const post of plan.posts) {
      const alreadyPosted = await hasPostedRun(database, rule.id, post.runEpochMillis);
      if (alreadyPosted) {
        transactionsSkippedDuplicate += 1;
      } else {
        await transactionRepo.create({
          amountMinor: rule.amountMinor,
          type: rule.type,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          dateEpochMillis: post.runEpochMillis,
          note: rule.note,
          recurringRuleId: rule.id,
        });
        transactionsCreated += 1;
      }
    }

    // plan.nextRunEpochMillis is already advanced past the last posted run.
    await recurringRepo.update(rule.id, {
      nextRunEpochMillis: plan.nextRunEpochMillis,
    });
  }

  return {
    rulesProcessed,
    transactionsCreated,
    transactionsSkippedDuplicate,
  };
}
