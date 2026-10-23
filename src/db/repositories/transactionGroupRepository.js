import {
  assertNonBlank,
  assertPositiveInteger,
  assertValidEpochMillis,
  readInteger,
  readNullableString,
} from "../validation";
import { requireCreatedEntity } from "./shared";

function mapTransactionGroup(row) {
  return {
    id: String(row.id),
    title: readNullableString(row, "title"),
    accountId: readInteger(row, "account_id"),
    dateEpochMillis: readInteger(row, "date_epoch_millis"),
    createdEpochMillis: readInteger(row, "created_epoch_millis"),
  };
}

function validateTransactionGroup(group) {
  if (typeof group.id !== "string") {
    throw new TypeError("Group id must be text.");
  }
  assertNonBlank(group.id, "groupId");
  assertPositiveInteger(group.accountId, "accountId");
  assertValidEpochMillis(group.dateEpochMillis, "dateEpochMillis");
  if (group.createdEpochMillis !== undefined && group.createdEpochMillis !== null) {
    assertValidEpochMillis(group.createdEpochMillis, "createdEpochMillis");
  }
}

export class TransactionGroupRepository {
  constructor(database) {
    this.database = database;
  }

  async create(group) {
    const normalized = {
      id: group.id,
      title: group.title?.trim() || null,
      accountId: group.accountId,
      dateEpochMillis: group.dateEpochMillis,
      createdEpochMillis: group.createdEpochMillis ?? Date.now(),
    };
    validateTransactionGroup(normalized);

    const statement = `INSERT INTO transaction_groups (
      id, title, account_id, date_epoch_millis, created_epoch_millis
    ) VALUES (?, ?, ?, ?, ?)`;
    const parameters = [
      normalized.id,
      normalized.title,
      normalized.accountId,
      normalized.dateEpochMillis,
      normalized.createdEpochMillis,
    ];

    await this.database.execute(statement, parameters);
    return requireCreatedEntity(await this.getById(normalized.id), "TransactionGroup");
  }

  async getById(id) {
    if (typeof id !== "string") {
      throw new TypeError("Transaction group id must be a string.");
    }
    assertNonBlank(id, "id");
    const result = await this.database.execute(
      "SELECT * FROM transaction_groups WHERE id = ?",
      [id]
    );
    const row = result.rows[0] ?? null;
    return row === null ? null : mapTransactionGroup(row);
  }

  async list() {
    const result = await this.database.execute(
      "SELECT * FROM transaction_groups ORDER BY created_epoch_millis DESC"
    );
    return result.rows.map(mapTransactionGroup);
  }

  async update(id, patch) {
    if (typeof id !== "string") {
      throw new TypeError("Transaction group id must be a string.");
    }
    assertNonBlank(id, "id");

    const assignments = [];
    if (patch.title !== undefined) {
      assignments.push({ column: "title", value: patch.title?.trim() || null });
    }
    if (patch.accountId !== undefined) {
      assertPositiveInteger(patch.accountId, "accountId");
      assignments.push({ column: "account_id", value: patch.accountId });
    }
    if (patch.dateEpochMillis !== undefined) {
      assertValidEpochMillis(patch.dateEpochMillis, "dateEpochMillis");
      assignments.push({ column: "date_epoch_millis", value: patch.dateEpochMillis });
    }

    if (assignments.length === 0) {
      throw new TypeError("An update must include at least one defined field.");
    }

    const setClause = assignments.map(({ column }) => `${column} = ?`).join(", ");
    const result = await this.database.execute(
      `UPDATE transaction_groups SET ${setClause} WHERE id = ?`,
      [...assignments.map(({ value }) => value), id]
    );
    return result.rowsAffected === 1 ? this.getById(id) : null;
  }

  async delete(id) {
    if (typeof id !== "string") {
      throw new TypeError("Transaction group id must be a string.");
    }
    assertNonBlank(id, "id");
    const result = await this.database.execute(
      "DELETE FROM transaction_groups WHERE id = ?",
      [id]
    );
    return result.rowsAffected === 1;
  }
}
