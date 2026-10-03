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
      WHERE (recurring_rule_id = ? AND (scheduled_date_epoch_millis = ? OR date_epoch_millis = ?))
         OR source_key = ?
      LIMIT 1`,
    [recurringRuleId, runEpochMillis, runEpochMillis, `recurring:${recurringRuleId}:${runEpochMillis}`],
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
  let transactionsCreated = 0;
  let transactionsSkippedDuplicate = 0;
  let rulesProcessed = 0;

  // Serialize the duplicate check, posts, and schedule advance as one atomic unit.
  // Read rules inside the transaction so queued foreground/background callers see commits.
  await database.transaction(async (tx) => {
    const recurringRepo = new RecurringRepository(tx);
    const transactionRepo = new TransactionRepository(tx);
    const rules = await recurringRepo.list();
    for (const rule of rules) {
      if (!rule.isActive) {
        // E-01: Inactive rules advance to future slot without posting
        const plan = planRecurringCatchUp(rule, nowEpochMillis);
        if (plan.nextRunEpochMillis !== rule.nextRunEpochMillis) {
          await recurringRepo.update(rule.id, {
            nextRunEpochMillis: plan.nextRunEpochMillis,
            anchorDay: plan.anchorDay,
          });
        }
        continue;
      }

      // E-03: If target account is archived, skip catch-up
      const accountRes = await tx.execute("SELECT is_archived FROM accounts WHERE id = ? LIMIT 1", [rule.accountId]);
      const accountRow = accountRes.rows?.[0];
      if (accountRow && (accountRow.is_archived === 1 || accountRow.is_archived === true)) {
        continue;
      }

      rulesProcessed += 1;
      const plan = planRecurringCatchUp(rule, nowEpochMillis);
      if (plan.posts.length === 0) {
        continue;
      }
      for (const post of plan.posts) {
        const alreadyPosted = await hasPostedRun(tx, rule.id, post.runEpochMillis);
        if (alreadyPosted) {
          transactionsSkippedDuplicate += 1;
        } else {
          await transactionRepo.create({
            amountMinor: rule.amountMinor,
            type: rule.type,
            categoryId: rule.categoryId,
            accountId: rule.accountId,
            dateEpochMillis: post.runEpochMillis,
            scheduledDateEpochMillis: post.runEpochMillis,
            sourceKey: `recurring:${rule.id}:${post.runEpochMillis}`,
            note: rule.note,
            recurringRuleId: rule.id,
          });
          transactionsCreated += 1;
        }
      }
      // Persist the schedule and anchor together with the posts, including short months.
      await recurringRepo.update(rule.id, {
        nextRunEpochMillis: plan.nextRunEpochMillis,
        anchorDay: plan.anchorDay,
      });
    }
  });

  return {
    rulesProcessed,
    transactionsCreated,
    transactionsSkippedDuplicate,
  };
}
