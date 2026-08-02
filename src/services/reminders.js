import { buildRecurringBills } from "../domain/services/financeView";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
export function computeDueReminders(rules, categoriesById, now = new Date()) {
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
