import { DEFAULT_PREFERENCES, normalizePreferences } from "../src/services/preferences";
import { computeDueReminders, formatReminderMessage } from "../src/services/reminders";
import type { Category, RecurringRule } from "../src/domain/types";

describe("preferences", () => {
  it("normalizes partial preference payloads", () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(
      normalizePreferences({
        appLockEnabled: true,
        currencySymbol: "$",
        remindersEnabled: false,
        themePreference: "dark",
      }),
    ).toEqual({
      appLockEnabled: true,
      currencySymbol: "$",
      remindersEnabled: false,
      smartTipsEnabled: true,
      themePreference: "dark",
    });
  });
});

describe("reminders", () => {
  it("surfaces bills inside their lead window", () => {
    const now = new Date(2026, 7, 1, 9);
    const categories: Category[] = [
      { id: 1, name: "Bills", icon: "receipt", colorHex: "#CA8A04", type: "EXPENSE", isCustom: false },
    ];
    const rules: RecurringRule[] = [
      {
        id: 9,
        amountMinor: 100_000,
        type: "EXPENSE",
        categoryId: 1,
        accountId: 1,
        note: "Internet",
        frequency: "MONTHLY",
        nextRunEpochMillis: new Date(2026, 7, 5, 12).getTime(),
        isActive: true,
        reminderEnabled: true,
        reminderLeadDays: 7,
      },
    ];
    const due = computeDueReminders(rules, new Map([[1, categories[0]!]]), now);
    expect(due).toHaveLength(1);
    expect(due[0]?.daysUntilDue).toBe(4);
    expect(formatReminderMessage(due[0]!)).toContain("Internet");
  });
});
