import {
  advanceNextRunEpochMillis,
  planRecurringCatchUp,
} from "../src/domain/services/recurringCatchUp";
import { AccountRepository, CategoryRepository, RecurringRepository, TransactionRepository } from "../src/db/repositories";
import { migrateDatabase } from "../src/db/schema";
import { runRecurringCatchUp } from "../src/services/recurringCatchUp";
import { TestSqliteDatabase } from "./support/testDatabase";

function atLocal(year, monthIndex, day, hour = 12, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

describe("advanceNextRunEpochMillis", () => {
  it("advances daily and weekly by fixed calendar steps", () => {
    const start = atLocal(2026, 7, 1, 9);
    expect(advanceNextRunEpochMillis(start, "DAILY")).toBe(atLocal(2026, 7, 2, 9));
    expect(advanceNextRunEpochMillis(start, "WEEKLY")).toBe(atLocal(2026, 7, 8, 9));
  });

  it("advances monthly across a month boundary and clamps end-of-month", () => {
    const jan31 = atLocal(2026, 0, 31, 10);
    const feb = new Date(advanceNextRunEpochMillis(jan31, "MONTHLY"));
    expect(feb.getFullYear()).toBe(2026);
    expect(feb.getMonth()).toBe(1);
    expect(feb.getDate()).toBe(28);

    const mar = new Date(advanceNextRunEpochMillis(feb.getTime(), "MONTHLY"));
    expect(mar.getMonth()).toBe(2);
    expect(mar.getDate()).toBe(28);
  });
});

describe("planRecurringCatchUp (pure)", () => {
  it("posts nothing when next run is in the future", () => {
    const now = atLocal(2026, 7, 1);
    const plan = planRecurringCatchUp(
      {
        isActive: true,
        frequency: "MONTHLY",
        nextRunEpochMillis: atLocal(2026, 7, 10),
      },
      now,
    );
    expect(plan.posts).toEqual([]);
    expect(plan.nextRunEpochMillis).toBe(atLocal(2026, 7, 10));
  });

  it("skips inactive rules", () => {
    const plan = planRecurringCatchUp(
      {
        isActive: false,
        frequency: "DAILY",
        nextRunEpochMillis: atLocal(2026, 6, 1),
      },
      atLocal(2026, 7, 1),
    );
    expect(plan.skippedInactive).toBe(true);
    expect(plan.posts).toHaveLength(0);
  });

  it("plans exactly one post for a single overdue period", () => {
    const due = atLocal(2026, 7, 1, 8);
    const now = atLocal(2026, 7, 1, 12);
    const plan = planRecurringCatchUp(
      { isActive: true, frequency: "DAILY", nextRunEpochMillis: due },
      now,
    );
    expect(plan.posts).toEqual([{ runEpochMillis: due }]);
    expect(plan.nextRunEpochMillis).toBe(atLocal(2026, 7, 2, 8));
  });

  it("plans multi-period catch-up after multi-day downtime", () => {
    const firstDue = atLocal(2026, 7, 1, 9);
    const now = atLocal(2026, 7, 4, 10);
    const plan = planRecurringCatchUp(
      { isActive: true, frequency: "DAILY", nextRunEpochMillis: firstDue },
      now,
    );
    expect(plan.posts.map((p) => p.runEpochMillis)).toEqual([
      atLocal(2026, 7, 1, 9),
      atLocal(2026, 7, 2, 9),
      atLocal(2026, 7, 3, 9),
      atLocal(2026, 7, 4, 9),
    ]);
    expect(plan.nextRunEpochMillis).toBe(atLocal(2026, 7, 5, 9));
  });

  it("plans monthly catch-up across a month boundary", () => {
    const firstDue = atLocal(2026, 5, 30, 12); // June 30
    const now = atLocal(2026, 7, 5, 12); // Aug 5 → June + July due
    const plan = planRecurringCatchUp(
      { isActive: true, frequency: "MONTHLY", nextRunEpochMillis: firstDue },
      now,
    );
    expect(plan.posts).toHaveLength(2);
    expect(plan.posts[0].runEpochMillis).toBe(firstDue);
    const second = new Date(plan.posts[1].runEpochMillis);
    expect(second.getMonth()).toBe(6); // July
    expect(second.getDate()).toBe(30);
    const next = new Date(plan.nextRunEpochMillis);
    expect(next.getMonth()).toBe(7); // August
    expect(next.getDate()).toBe(30);
  });
});

describe("runRecurringCatchUp (repository integration)", () => {
  /** @type {TestSqliteDatabase} */
  let database;
  /** @type {RecurringRepository} */
  let recurring;
  /** @type {TransactionRepository} */
  let transactions;
  let cashId;
  let billsId;

  beforeEach(async () => {
    database = new TestSqliteDatabase();
    await migrateDatabase(database);
    const accounts = new AccountRepository(database);
    const categories = new CategoryRepository(database);
    recurring = new RecurringRepository(database);
    transactions = new TransactionRepository(database);
    cashId = (await accounts.list())[0].id;
    billsId = (await categories.list()).find((c) => c.name === "Bills" && c.type === "EXPENSE")?.id
      ?? (await categories.create({
        name: "Bills",
        icon: "receipt",
        colorHex: "#CA8A04",
        type: "EXPENSE",
        isCustom: false,
      })).id;
  });

  afterEach(() => {
    database.close();
  });

  async function seedRule(overrides = {}) {
    return recurring.create({
      amountMinor: 100_000,
      type: "EXPENSE",
      categoryId: billsId,
      accountId: cashId,
      note: "Internet",
      frequency: "MONTHLY",
      nextRunEpochMillis: atLocal(2026, 6, 1, 12),
      isActive: true,
      reminderEnabled: true,
      reminderLeadDays: 3,
      ...overrides,
    });
  }

  it("posts exactly once per period and is idempotent on re-run", async () => {
    const rule = await seedRule({
      frequency: "DAILY",
      nextRunEpochMillis: atLocal(2026, 7, 1, 8),
    });
    const now = atLocal(2026, 7, 3, 9);

    const first = await runRecurringCatchUp(database, { nowEpochMillis: now });
    expect(first.transactionsCreated).toBe(3);
    expect(await transactions.list()).toHaveLength(3);

    const second = await runRecurringCatchUp(database, { nowEpochMillis: now });
    expect(second.transactionsCreated).toBe(0);
    expect(await transactions.list()).toHaveLength(3);

    const updated = await recurring.getById(rule.id);
    expect(updated?.nextRunEpochMillis).toBe(atLocal(2026, 7, 4, 8));

    const dates = (await transactions.list())
      .filter((tx) => tx.recurringRuleId === rule.id)
      .map((tx) => tx.dateEpochMillis)
      .sort((a, b) => a - b);
    expect(dates).toEqual([
      atLocal(2026, 7, 1, 8),
      atLocal(2026, 7, 2, 8),
      atLocal(2026, 7, 3, 8),
    ]);
    for (const tx of await transactions.list()) {
      expect(tx.amountMinor).toBe(100_000);
    }
  });

  it("catches up multi-period monthly gaps across a month boundary once", async () => {
    const rule = await seedRule({
      frequency: "MONTHLY",
      nextRunEpochMillis: atLocal(2026, 5, 15, 12), // Jun 15
      amountMinor: 250_000,
    });
    const now = atLocal(2026, 7, 20, 12); // Aug 20 → Jun + Jul + Aug

    const summary = await runRecurringCatchUp(database, { nowEpochMillis: now });
    expect(summary.transactionsCreated).toBe(3);

    const again = await runRecurringCatchUp(database, { nowEpochMillis: now });
    expect(again.transactionsCreated).toBe(0);
    expect(again.transactionsSkippedDuplicate).toBe(0);

    const txs = (await transactions.list()).filter((tx) => tx.recurringRuleId === rule.id);
    expect(txs).toHaveLength(3);
    expect(txs.every((tx) => tx.amountMinor === 250_000)).toBe(true);

    const next = await recurring.getById(rule.id);
    expect(new Date(next.nextRunEpochMillis).getMonth()).toBe(8); // September
    expect(new Date(next.nextRunEpochMillis).getDate()).toBe(15);
  });

  it("does not post inactive rules", async () => {
    await seedRule({
      isActive: false,
      nextRunEpochMillis: atLocal(2026, 0, 1),
    });
    const summary = await runRecurringCatchUp(database, {
      nowEpochMillis: atLocal(2026, 7, 1),
    });
    expect(summary.transactionsCreated).toBe(0);
    expect(await transactions.list()).toHaveLength(0);
  });

  it("skips duplicate rows if a run was already posted", async () => {
    const rule = await seedRule({
      frequency: "WEEKLY",
      nextRunEpochMillis: atLocal(2026, 7, 1, 10),
    });
    await transactions.create({
      amountMinor: 100_000,
      type: "EXPENSE",
      categoryId: billsId,
      accountId: cashId,
      dateEpochMillis: atLocal(2026, 7, 1, 10),
      note: "Internet",
      recurringRuleId: rule.id,
    });

    const summary = await runRecurringCatchUp(database, {
      nowEpochMillis: atLocal(2026, 7, 1, 18),
    });
    expect(summary.transactionsCreated).toBe(0);
    expect(summary.transactionsSkippedDuplicate).toBe(1);
    expect(await transactions.list()).toHaveLength(1);
    const updated = await recurring.getById(rule.id);
    expect(updated.nextRunEpochMillis).toBe(atLocal(2026, 7, 8, 10));
  });
});
