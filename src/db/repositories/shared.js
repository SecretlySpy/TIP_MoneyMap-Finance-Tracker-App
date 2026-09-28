import { DataIntegrityError, assertPositiveInteger } from "../validation";
export async function insertRow(database, statement, parameters) {
    // One SQLite statement is atomic and also works on an outer transaction's executor.
    const result = await database.execute(statement, parameters);
    const insertedId = result.insertId;
    if (insertedId === undefined || !Number.isSafeInteger(insertedId) || insertedId <= 0) {
        throw new DataIntegrityError("SQLite did not return a valid inserted row identifier.");
    }
    return insertedId;
}
export async function updateRow(database, table, id, assignments) {
    assertPositiveInteger(id, "id");
    if (assignments.length === 0) {
        throw new TypeError("An update must include at least one defined field.");
    }
    const setClause = assignments.map(({ column }) => `${column} = ?`).join(", ");
    // Let the caller own any multi-statement transaction instead of nesting BEGIN.
    const result = await database.execute(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...assignments.map(({ value }) => value), id]);
    return result.rowsAffected === 1;
}
export async function deleteRow(database, table, id) {
    assertPositiveInteger(id, "id");
    const result = await database.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return result.rowsAffected === 1;
}
export async function findRowById(database, table, id) {
    assertPositiveInteger(id, "id");
    const result = await database.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return result.rows[0] ?? null;
}
export async function listRows(database, table) {
    const result = await database.execute(`SELECT * FROM ${table} ORDER BY id ASC`);
    return result.rows;
}
export function requireCreatedEntity(entity, entityName) {
    if (entity === null) {
        throw new DataIntegrityError(`${entityName} disappeared immediately after insertion.`);
    }
    return entity;
}
