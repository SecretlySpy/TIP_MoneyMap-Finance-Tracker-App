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
        this.database = new BetterSqlite3(":memory:");
    }
    async execute(query, parameters = []) {
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
        this.database.exec("BEGIN IMMEDIATE");
        try {
            await work(this);
            this.database.exec("COMMIT");
        }
        catch (error) {
            this.database.exec("ROLLBACK");
            throw error;
        }
    }
    close() {
        this.database.close();
    }
}
