import BetterSqlite3 from "better-sqlite3";

function normalizeParameter(value) {
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

export class TestSqliteDatabase {
  constructor() {
    // Each in-memory DB is isolated; enable FK before any schema/migration work.
    this.database = new BetterSqlite3(":memory:");
    this.database.pragma("foreign_keys = ON");
    this.database.pragma("busy_timeout = 5000");
  }

  /**
   * Apply PRAGMA via better-sqlite3's helper so assignment pragmas always stick.
   * prepare().all("PRAGMA foreign_keys = ON") is unreliable across versions.
   */
  applyPragma(sql) {
    const body = String(sql).replace(/^\s*PRAGMA\s+/i, "").replace(/;+\s*$/, "").trim();
    const result = this.database.pragma(body);
    if (Array.isArray(result)) {
      return { rowsAffected: 0, rows: result };
    }
    if (result !== undefined) {
      const key = body.split(/\s*=\s*/)[0].trim();
      return { rowsAffected: 0, rows: [{ [key]: result }] };
    }
    return { rowsAffected: 0, rows: [] };
  }

  async execute(query, parameters = []) {
    if (/^\s*PRAGMA\b/i.test(query)) {
      return this.applyPragma(query);
    }
    const statement = this.database.prepare(query);
    const normalizedParameters = parameters.map(normalizeParameter);
    if (statement.reader) {
      const rows = statement.all(...normalizedParameters);
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

  async transaction(work) {
    // Must be enabled before BEGIN — SQLite ignores FK toggles mid-transaction.
    this.database.pragma("foreign_keys = ON");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      await work(this);
      this.database.exec("COMMIT");
    } catch (error) {
      try {
        this.database.exec("ROLLBACK");
      } catch {
        // already closed/rolled back
      }
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}
