import {
  buildReminderNotificationPlan,
  computeReminderFireEpochMillis,
  formatScheduledReminderCopy,
  reminderNotificationIdentifier,
} from "../src/services/reminders";
import { computeDueReminders, formatReminderMessage } from "../src/services/reminders";

function atLocal(year, monthIndex, day, hour = 12) {
  return new Date(year, monthIndex, day, hour, 0, 0, 0).getTime();
}

const categoriesById = new Map([
  [1, { id: 1, name: "Bills", icon: "receipt", colorHex: "#CA8A04", type: "EXPENSE", isCustom: false }],
]);

function rule(overrides = {}) {
  return {
    id: 9,
    amountMinor: 100_000,
    type: "EXPENSE",
    categoryId: 1,
    accountId: 1,
    note: "Internet",
    frequency: "MONTHLY",
    nextRunEpochMillis: atLocal(2026, 6, 26, 12), // Jul 26
    isActive: true,
    reminderEnabled: true,
    reminderLeadDays: 10,
    ...overrides,
  };
}

describe("reminder fire planning", () => {
  it("fires lead days before due at 09:00 local", () => {
    const fire = computeReminderFireEpochMillis(atLocal(2026, 6, 26, 15), 10);
    const date = new Date(fire);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // July
    expect(date.getDate()).toBe(16);
    expect(date.getHours()).toBe(9);
  });

  it("builds notification copy with formatted minor units", () => {
    const copy = formatScheduledReminderCopy(rule(), "Internet", "₱");
    expect(copy.title).toContain("Internet");
    expect(copy.body).toBe("Set aside ₱1,000 by Jul 26.");
  });

  it("uses stable identifiers that change when nextRun advances (month boundary)", () => {
    const july = rule({ nextRunEpochMillis: atLocal(2026, 6, 26) });
    const august = rule({ nextRunEpochMillis: atLocal(2026, 7, 26) });
    const julyId = reminderNotificationIdentifier(july.id, july.nextRunEpochMillis);
    const augustId = reminderNotificationIdentifier(august.id, august.nextRunEpochMillis);
    expect(julyId).not.toBe(augustId);
    expect(julyId.startsWith("moneymap-reminder-rule-9-")).toBe(true);
  });

  it("schedules one DATE notification before the lead window", () => {
    const now = atLocal(2026, 6, 1, 10); // Jul 1 — before Jul 16 fire
    const plan = buildReminderNotificationPlan([rule()], categoriesById, {
      nowEpochMillis: now,
      currencySymbol: "₱",
      remindersEnabled: true,
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].triggerMode).toBe("date");
    expect(plan[0].title).toMatch(/Internet bill due in 10 days/);
    expect(plan[0].body).toContain("₱1,000");
    expect(plan[0].data).toEqual({
      moneymap: true,
      screen: "Recurring",
      ruleId: 9,
    });
  });

  it("schedules ASAP once inside the lead window without duplicating across re-plans", () => {
    const now = atLocal(2026, 6, 20, 10); // Jul 20 — inside 10-day lead before Jul 26
    const planA = buildReminderNotificationPlan([rule()], categoriesById, {
      nowEpochMillis: now,
      remindersEnabled: true,
    });
    const planB = buildReminderNotificationPlan([rule()], categoriesById, {
      nowEpochMillis: now,
      remindersEnabled: true,
    });
    expect(planA).toHaveLength(1);
    expect(planA[0].triggerMode).toBe("asap");
    expect(planA[0].identifier).toBe(planB[0].identifier);
    expect(planA[0].title).toMatch(/due in 6 days/);
  });

  it("plans distinct notifications across a month boundary when nextRun advances", () => {
    const now = atLocal(2026, 7, 1, 9); // Aug 1
    const julyRule = rule({
      id: 1,
      nextRunEpochMillis: atLocal(2026, 6, 26),
      reminderLeadDays: 10,
    });
    // After catch-up, next run is August
    const augustRule = rule({
      id: 1,
      nextRunEpochMillis: atLocal(2026, 7, 26),
      reminderLeadDays: 10,
    });
    const before = buildReminderNotificationPlan([julyRule], categoriesById, {
      nowEpochMillis: atLocal(2026, 6, 10),
      remindersEnabled: true,
    });
    const after = buildReminderNotificationPlan([augustRule], categoriesById, {
      nowEpochMillis: now,
      remindersEnabled: true,
    });
    expect(before[0].identifier).not.toBe(after[0].identifier);
    expect(after[0].body).toContain("Aug 26");
  });

  it("returns empty plan when reminders are disabled or rule reminders off", () => {
    expect(
      buildReminderNotificationPlan([rule()], categoriesById, {
        remindersEnabled: false,
        nowEpochMillis: atLocal(2026, 6, 1),
      }),
    ).toEqual([]);
    expect(
      buildReminderNotificationPlan([rule({ reminderEnabled: false })], categoriesById, {
        remindersEnabled: true,
        nowEpochMillis: atLocal(2026, 6, 1),
      }),
    ).toEqual([]);
    expect(
      buildReminderNotificationPlan([rule({ isActive: false })], categoriesById, {
        remindersEnabled: true,
        nowEpochMillis: atLocal(2026, 6, 1),
      }),
    ).toEqual([]);
  });

  it("skips past-due nextRun (stale before catch-up)", () => {
    const plan = buildReminderNotificationPlan(
      [rule({ nextRunEpochMillis: atLocal(2026, 5, 1) })],
      categoriesById,
      { nowEpochMillis: atLocal(2026, 6, 1), remindersEnabled: true },
    );
    expect(plan).toEqual([]);
  });
});

describe("in-app due reminders (existing)", () => {
  it("surfaces bills inside their lead window", () => {
    const now = new Date(2026, 7, 1, 9);
    const rules = [
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
    const due = computeDueReminders(rules, categoriesById, now);
    expect(due).toHaveLength(1);
    expect(due[0]?.daysUntilDue).toBe(4);
    expect(formatReminderMessage(due[0])).toContain("Internet");
  });
});
