import BetterSqlite3, { type Database } from "better-sqlite3";

import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
  SqlRow,
  SqlValue,
} from "../../src/db/sql";

function normalizeParameter(value: SqlValue): string | number | bigint | null | Uint8Array {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  return value;
}

export class TestSqliteDatabase implements SqlDatabase {
  private readonly database: Database;

  public constructor() {
    this.database = new BetterSqlite3(":memory:");
  }

  public async execute(
    query: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<SqlQueryResult> {
    const statement = this.database.prepare(query);
    const normalizedParameters = parameters.map(normalizeParameter);

    if (statement.reader) {
      const rows = statement.all(...normalizedParameters) as SqlRow[];
      return { rowsAffected: 0, rows };
    }

    const result = statement.run(...normalizedParameters);
    const numericInsertId = Number(result.lastInsertRowid);

    return {
      ...(numericInsertId === 0 ? {} : { insertId: numericInsertId }),
      rowsAffected: result.changes,
      rows: [],
    };
  }

  public async transaction(work: (transaction: SqlExecutor) => Promise<void>): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");

    try {
      await work(this);
      this.database.exec("COMMIT");
    } catch (error: unknown) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  public close(): void {
    this.database.close();
  }
}
