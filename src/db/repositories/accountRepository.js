import { ACCOUNT_TYPES, } from "../../domain/types";
import { assertNonBlank, assertOneOf, assertSafeInteger, readBoolean, readEnum, readInteger, readString, } from "../validation";
import { deleteRow, findRowById, insertRow, listRows, requireCreatedEntity, updateRow, } from "./shared";
function mapAccount(row) {
    return {
        id: readInteger(row, "id"),
        name: readString(row, "name"),
        type: readEnum(row, "type", ACCOUNT_TYPES),
        startingBalanceMinor: readInteger(row, "starting_balance_minor"),
        isArchived: readBoolean(row, "is_archived"),
    };
}
function validateAccount(account) {
    assertNonBlank(account.name, "name");
    assertOneOf(account.type, ACCOUNT_TYPES, "type");
    assertSafeInteger(account.startingBalanceMinor, "startingBalanceMinor");
}
export class AccountRepository {
    constructor(database) {
        this.database = database;
    }
    async create(account) {
        validateAccount(account);
        const id = await insertRow(this.database, `INSERT INTO accounts (name, type, starting_balance_minor, is_archived)
       VALUES (?, ?, ?, ?)`, [account.name, account.type, account.startingBalanceMinor, account.isArchived ? 1 : 0]);
        return requireCreatedEntity(await this.getById(id), "Account");
    }
    async getById(id) {
        const row = await findRowById(this.database, "accounts", id);
        return row === null ? null : mapAccount(row);
    }
    async list() {
        return (await listRows(this.database, "accounts")).map(mapAccount);
    }
    async update(id, patch) {
        const assignments = [];
        if (patch.name !== undefined) {
            assertNonBlank(patch.name, "name");
            assignments.push({ column: "name", value: patch.name });
        }
        if (patch.type !== undefined) {
            assertOneOf(patch.type, ACCOUNT_TYPES, "type");
            assignments.push({ column: "type", value: patch.type });
        }
        if (patch.startingBalanceMinor !== undefined) {
            assertSafeInteger(patch.startingBalanceMinor, "startingBalanceMinor");
            assignments.push({ column: "starting_balance_minor", value: patch.startingBalanceMinor });
        }
        if (patch.isArchived !== undefined) {
            assignments.push({ column: "is_archived", value: patch.isArchived ? 1 : 0 });
        }
        const didUpdate = await updateRow(this.database, "accounts", id, assignments);
        return didUpdate ? this.getById(id) : null;
    }
    delete(id) {
        return deleteRow(this.database, "accounts", id);
    }
}
