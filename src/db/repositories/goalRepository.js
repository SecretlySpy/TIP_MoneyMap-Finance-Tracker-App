import {
  assertPositiveInteger,
  assertSafeInteger,
  readInteger,
  readNullableInteger,
  readString,
} from "../validation";
import { deleteRow, findRowById, insertRow, listRows, requireCreatedEntity, updateRow } from "./shared";

function mapGoal(row) {
  return {
    id: readInteger(row, "id"),
    name: readString(row, "name"),
    targetMinor: readInteger(row, "target_minor"),
    currentMinor: readInteger(row, "current_minor"),
    deadlineEpochMillis: readNullableInteger(row, "deadline_epoch_millis"),
    isArchived: readInteger(row, "is_archived") === 1,
    createdEpochMillis: readInteger(row, "created_epoch_millis"),
  };
}

export class GoalRepository {
  constructor(database) {
    this.database = database;
  }

  async create(goal) {
    const name = String(goal.name ?? "").trim();
    if (name.length === 0) {
      throw new TypeError("Goal name is required.");
    }
    assertPositiveInteger(goal.targetMinor, "targetMinor");
    const currentMinor = goal.currentMinor ?? 0;
    if (!Number.isSafeInteger(currentMinor) || currentMinor < 0) {
      throw new TypeError("currentMinor must be a non-negative safe integer.");
    }
    if (goal.deadlineEpochMillis != null) {
      assertSafeInteger(goal.deadlineEpochMillis, "deadlineEpochMillis");
    }
    const createdEpochMillis = goal.createdEpochMillis ?? Date.now();
    assertSafeInteger(createdEpochMillis, "createdEpochMillis");

    const id = await insertRow(
      this.database,
      `INSERT INTO savings_goals (
        name, target_minor, current_minor, deadline_epoch_millis, is_archived, created_epoch_millis
      ) VALUES (?, ?, ?, ?, 0, ?)`,
      [
        name,
        goal.targetMinor,
        currentMinor,
        goal.deadlineEpochMillis ?? null,
        createdEpochMillis,
      ],
    );
    return requireCreatedEntity(await this.getById(id), "SavingsGoal");
  }

  async getById(id) {
    const row = await findRowById(this.database, "savings_goals", id);
    return row === null ? null : mapGoal(row);
  }

  async list() {
    return (await listRows(this.database, "savings_goals")).map(mapGoal);
  }

  async update(id, patch) {
    const assignments = [];
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (name.length === 0) {
        throw new TypeError("Goal name is required.");
      }
      assignments.push({ column: "name", value: name });
    }
    if (patch.targetMinor !== undefined) {
      assertPositiveInteger(patch.targetMinor, "targetMinor");
      assignments.push({ column: "target_minor", value: patch.targetMinor });
    }
    if (patch.currentMinor !== undefined) {
      if (!Number.isSafeInteger(patch.currentMinor) || patch.currentMinor < 0) {
        throw new TypeError("currentMinor must be a non-negative safe integer.");
      }
      assignments.push({ column: "current_minor", value: patch.currentMinor });
    }
    if (patch.deadlineEpochMillis !== undefined) {
      if (patch.deadlineEpochMillis !== null) {
        assertSafeInteger(patch.deadlineEpochMillis, "deadlineEpochMillis");
      }
      assignments.push({ column: "deadline_epoch_millis", value: patch.deadlineEpochMillis });
    }
    if (patch.isArchived !== undefined) {
      assignments.push({ column: "is_archived", value: patch.isArchived ? 1 : 0 });
    }
    const didUpdate = await updateRow(this.database, "savings_goals", id, assignments);
    return didUpdate ? this.getById(id) : null;
  }

  async contribute(id, amountMinor) {
    assertPositiveInteger(amountMinor, "amountMinor");
    const existing = await this.getById(id);
    if (existing === null) {
      throw new TypeError("Goal not found.");
    }
    const next = existing.currentMinor + amountMinor;
    assertSafeInteger(next, "currentMinor");
    return this.update(id, { currentMinor: next });
  }

  delete(id) {
    return deleteRow(this.database, "savings_goals", id);
  }
}
