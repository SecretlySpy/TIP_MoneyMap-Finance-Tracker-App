import { buildRecurringBills } from "../domain/services/financeView";
import { formatMinor } from "../domain/services/money";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const REMINDER_NOTIFICATION_PREFIX = "moneymap-reminder-rule-";

function startOfLocalDay(epochMillis) {
  const date = new Date(epochMillis);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Local calendar day for the notification fire time: due day minus lead days, 09:00 local.
 * @param {number} nextRunEpochMillis
 * @param {number} reminderLeadDays
 * @returns {number}
 */
export function computeReminderFireEpochMillis(nextRunEpochMillis, reminderLeadDays) {
  const lead = Math.max(0, Math.floor(reminderLeadDays));
  const dueDay = startOfLocalDay(nextRunEpochMillis);
  const fireDay = dueDay - lead * MS_PER_DAY;
  const fire = new Date(fireDay);
  fire.setHours(9, 0, 0, 0);
  return fire.getTime();
}

/**
 * Stable OS notification id for one rule occurrence (changes when nextRun advances).
 * @param {number} ruleId
 * @param {number} nextRunEpochMillis
 */
export function reminderNotificationIdentifier(ruleId, nextRunEpochMillis) {
  return `${REMINDER_NOTIFICATION_PREFIX}${ruleId}-${nextRunEpochMillis}`;
}

/**
 * @param {{ note?: string|null, amountMinor: number, nextRunEpochMillis: number }} rule
 * @param {string} billName
 * @param {string} [currencySymbol]
 */
export function formatScheduledReminderCopy(rule, billName, currencySymbol = "₱") {
  const due = new Date(rule.nextRunEpochMillis);
  const dueLabel = `${MONTH_LABELS[due.getMonth()]} ${due.getDate()}`;
  const amount = formatMinor(rule.amountMinor, { currencySymbol, showCents: false });
  const title = `${billName} bill due in ${Math.max(rule.reminderLeadDays ?? 0, 0)} days`;
  const body = `Set aside ${amount} by ${dueLabel}.`;
  return { title, body };
}

/**
 * Build the set of local notifications that should exist for the current rules.
 * Past fire times that are still before the due day are scheduled ASAP (seconds trigger)
 * so first-enable mid-window does not miss; identifiers include nextRun so re-sync is idempotent.
 *
 * @param {Array<object>} rules
 * @param {Map<number, object>} categoriesById
 * @param {{ nowEpochMillis?: number, currencySymbol?: string, remindersEnabled?: boolean }} [options]
 * @returns {Array<{ identifier: string, ruleId: number, fireAtEpochMillis: number, triggerMode: 'date'|'asap', title: string, body: string, data: object }>}
 */
export function buildReminderNotificationPlan(rules, categoriesById, options = {}) {
  const nowEpochMillis = options.nowEpochMillis ?? Date.now();
  const currencySymbol = options.currencySymbol ?? "₱";
  if (options.remindersEnabled === false) {
    return [];
  }

  const bills = buildRecurringBills(rules, categoriesById);
  const billNameById = new Map(bills.map((bill) => [bill.id, bill.name]));
  /** @type {Array<object>} */
  const plan = [];

  for (const rule of rules) {
    if (!rule.isActive || !rule.reminderEnabled) {
      continue;
    }
    const dueDay = startOfLocalDay(rule.nextRunEpochMillis);
    const today = startOfLocalDay(nowEpochMillis);
    if (dueDay < today) {
      // Past-due occurrence — catch-up should have advanced nextRun; skip stale fire.
      continue;
    }

    const fireAtEpochMillis = computeReminderFireEpochMillis(
      rule.nextRunEpochMillis,
      rule.reminderLeadDays,
    );
    const billName = billNameById.get(String(rule.id))
      ?? rule.note?.trim()
      ?? categoriesById.get(rule.categoryId)?.name
      ?? "Bill";
    const copy = formatScheduledReminderCopy(
      { ...rule, reminderLeadDays: rule.reminderLeadDays },
      billName,
      currencySymbol,
    );
    // Prefer lead-based title when still before the lead window; when already inside, use days-until.
    const daysUntilDue = Math.ceil((dueDay - today) / MS_PER_DAY);
    const title = daysUntilDue <= rule.reminderLeadDays
      ? (daysUntilDue === 0
        ? `${billName} bill is due today`
        : daysUntilDue === 1
          ? `${billName} bill due tomorrow`
          : `${billName} bill due in ${daysUntilDue} days`)
      : copy.title;

    const triggerMode = fireAtEpochMillis > nowEpochMillis ? "date" : "asap";
    // If the lead window has not started yet, only DATE fires; if fire is past but due is future, ASAP once.
    if (triggerMode === "asap" && daysUntilDue > rule.reminderLeadDays) {
      continue;
    }

    plan.push({
      identifier: reminderNotificationIdentifier(rule.id, rule.nextRunEpochMillis),
      ruleId: rule.id,
      fireAtEpochMillis: triggerMode === "date" ? fireAtEpochMillis : nowEpochMillis,
      triggerMode,
      title,
      body: copy.body,
      data: {
        moneymap: true,
        screen: "Recurring",
        ruleId: rule.id,
      },
    });
  }

  return plan.sort((left, right) => left.fireAtEpochMillis - right.fireAtEpochMillis);
}

export function computeDueReminders(rules, categoriesById, now = new Date()) {
  const bills = buildRecurringBills(rules, categoriesById);
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return bills
    .map((bill) => {
      const rule = rules.find((item) => String(item.id) === bill.id);
      if (rule === undefined || !rule.reminderEnabled || !rule.isActive) {
        return null;
      }
      const dueStart = new Date(rule.nextRunEpochMillis);
      const dueDay = new Date(dueStart.getFullYear(), dueStart.getMonth(), dueStart.getDate()).getTime();
      const daysUntilDue = Math.ceil((dueDay - nowStart) / MS_PER_DAY);
      if (daysUntilDue < 0 || daysUntilDue > rule.reminderLeadDays) {
        return null;
      }
      return { bill, daysUntilDue };
    })
    .filter((item) => item !== null)
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue);
}

export function formatReminderMessage(reminder) {
  if (reminder.daysUntilDue === 0) {
    return `${reminder.bill.name} is due today.`;
  }
  if (reminder.daysUntilDue === 1) {
    return `${reminder.bill.name} is due tomorrow.`;
  }
  return `${reminder.bill.name} is due in ${reminder.daysUntilDue} days.`;
}
