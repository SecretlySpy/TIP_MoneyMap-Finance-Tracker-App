import {
  applyGoalContribution,
  goalProgressPercent,
  goalRemainingMinor,
  isGoalComplete,
  sortGoalsForDisplay,
} from "../src/domain/services/goals";
import { GoalRepository } from "../src/db/repositories/goalRepository";
import { migrateDatabase, LATEST_SCHEMA_VERSION } from "../src/db/schema";
import { TestSqliteDatabase } from "./support/testDatabase";

describe("goals domain", () => {
  it("computes progress and remaining in minor units", () => {
    expect(goalProgressPercent(25_000, 100_000)).toBe(25);
    expect(goalRemainingMinor({ targetMinor: 100_000, currentMinor: 40_000 })).toBe(60_000);
    expect(isGoalComplete({ targetMinor: 100_000, currentMinor: 100_000 })).toBe(true);
    const applied = applyGoalContribution({ targetMinor: 100_000, currentMinor: 90_000 }, 20_000);
    expect(applied.currentMinor).toBe(110_000);
    expect(applied.complete).toBe(true);
    expect(applied.overflowMinor).toBe(10_000);
  });

  it("sorts incomplete goals before complete", () => {
    const sorted = sortGoalsForDisplay([
      {
        id: 1,
        name: "Done",
        targetMinor: 10,
        currentMinor: 10,
        deadlineEpochMillis: null,
        isArchived: false,
        createdEpochMillis: 1,
      },
      {
        id: 2,
        name: "Open",
        targetMinor: 100,
        currentMinor: 10,
        deadlineEpochMillis: null,
        isArchived: false,
        createdEpochMillis: 2,
      },
    ]);
    expect(sorted[0].name).toBe("Open");
    expect(sorted[0].progressPercent).toBe(10);
  });
});

describe("GoalRepository", () => {
  /** @type {TestSqliteDatabase} */
  let database;
  /** @type {GoalRepository} */
  let goals;

  beforeEach(async () => {
    database = new TestSqliteDatabase();
    const result = await migrateDatabase(database);
    expect(result.currentVersion).toBe(LATEST_SCHEMA_VERSION);
    goals = new GoalRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it("creates, contributes, and archives goals", async () => {
    const created = await goals.create({
      name: "New laptop",
      targetMinor: 500_000,
      currentMinor: 0,
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.targetMinor).toBe(500_000);

    const after = await goals.contribute(created.id, 100_000);
    expect(after.currentMinor).toBe(100_000);

    await goals.update(created.id, { isArchived: true });
    const listed = await goals.list();
    expect(listed.find((g) => g.id === created.id)?.isArchived).toBe(true);
  });
});
