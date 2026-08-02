import type { SqlDatabase, SqlRow, SqlValue } from "../sql";
import { DataIntegrityError, assertPositiveInteger } from "../validation";

export type RepositoryTable =
  | "accounts"
  | "categories"
  | "transactions"
  | "budgets"
  | "recurring_rules";

export interface UpdateAssignment {
  readonly column: string;
  readonly value: SqlValue;
}

export async function insertRow(
  database: SqlDatabase,
  statement: string,
  parameters: readonly SqlValue[],
): Promise<number> {
  let insertedId: number | undefined;

  await database.transaction(async (transaction) => {
    const result = await transaction.execute(statement, parameters);
    insertedId = result.insertId;
  });

  if (insertedId === undefined || !Number.isSafeInteger(insertedId) || insertedId <= 0) {
    throw new DataIntegrityError("SQLite did not return a valid inserted row identifier.");
  }

  return insertedId;
}

export async function updateRow(
  database: SqlDatabase,
  table: RepositoryTable,
  id: number,
  assignments: readonly UpdateAssignment[],
): Promise<boolean> {
  assertPositiveInteger(id, "id");

  if (assignments.length === 0) {
    throw new TypeError("An update must include at least one defined field.");
  }

  const setClause = assignments.map(({ column }) => `${column} = ?`).join(", ");
  let rowsAffected = 0;

  await database.transaction(async (transaction) => {
    const result = await transaction.execute(
      `UPDATE ${table} SET ${setClause} WHERE id = ?`,
      [...assignments.map(({ value }) => value), id],
    );
    rowsAffected = result.rowsAffected;
  });

  return rowsAffected === 1;
}

export async function deleteRow(
  database: SqlDatabase,
  table: RepositoryTable,
  id: number,
): Promise<boolean> {
  assertPositiveInteger(id, "id");
  let rowsAffected = 0;

  await database.transaction(async (transaction) => {
    const result = await transaction.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    rowsAffected = result.rowsAffected;
  });

  return rowsAffected === 1;
}

export async function findRowById(
  database: SqlDatabase,
  table: RepositoryTable,
  id: number,
): Promise<SqlRow | null> {
  assertPositiveInteger(id, "id");
  const result = await database.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return result.rows[0] ?? null;
}

export async function listRows(
  database: SqlDatabase,
  table: RepositoryTable,
): Promise<SqlRow[]> {
  const result = await database.execute(`SELECT * FROM ${table} ORDER BY id ASC`);
  return result.rows;
}

export function requireCreatedEntity<Entity>(entity: Entity | null, entityName: string): Entity {
  if (entity === null) {
    throw new DataIntegrityError(`${entityName} disappeared immediately after insertion.`);
  }

  return entity;
}
