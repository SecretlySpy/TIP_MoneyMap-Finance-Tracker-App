import type { Category, RecurringRule } from "../domain/types";
import { buildRecurringBills, type RecurringBillView } from "../domain/services/financeView";

export interface DueReminder {
  readonly bill: RecurringBillView;
  readonly daysUntilDue: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeDueReminders(
  rules: readonly RecurringRule[],
  categoriesById: ReadonlyMap<number, Category>,
  now = new Date(),
): DueReminder[] {
  const bills = buildRecurringBills(rules, categoriesById);
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return bills
    .map((bill) => {
      const rule = rules.find((item) => String(item.id) === bill.id);
      if (rule === undefined || !rule.reminderEnabled) {
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
    .filter((item): item is DueReminder => item !== null)
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue);
}

export function formatReminderMessage(reminder: DueReminder): string {
  if (reminder.daysUntilDue === 0) {
    return `${reminder.bill.name} is due today.`;
  }
  if (reminder.daysUntilDue === 1) {
    return `${reminder.bill.name} is due tomorrow.`;
  }
  return `${reminder.bill.name} is due in ${reminder.daysUntilDue} days.`;
}
