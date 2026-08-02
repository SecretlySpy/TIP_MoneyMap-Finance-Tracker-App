import { TRANSACTION_TYPES, } from "../../domain/types";
import { assertOneOf, assertPositiveInteger, assertSafeInteger, readEnum, readInteger, readNullableString, } from "../validation";
import { deleteRow, findRowById, insertRow, listRows, requireCreatedEntity, updateRow, } from "./shared";
function mapTransaction(row) {
    const recurringRuleIdValue = row.recurring_rule_id;
    return {
        id: readInteger(row, "id"),
        amountMinor: readInteger(row, "amount_minor"),
        type: readEnum(row, "type", TRANSACTION_TYPES),
        categoryId: readInteger(row, "category_id"),
        accountId: readInteger(row, "account_id"),
        dateEpochMillis: readInteger(row, "date_epoch_millis"),
        note: readNullableString(row, "note"),
        recurringRuleId: recurringRuleIdValue === null ? null : readInteger(row, "recurring_rule_id"),
    };
}
function validateTransaction(transaction) {
    assertPositiveInteger(transaction.amountMinor, "amountMinor");
    assertOneOf(transaction.type, TRANSACTION_TYPES, "type");
    assertPositiveInteger(transaction.categoryId, "categoryId");
    assertPositiveInteger(transaction.accountId, "accountId");
    assertSafeInteger(transaction.dateEpochMillis, "dateEpochMillis");
    if (transaction.recurringRuleId !== null) {
        assertPositiveInteger(transaction.recurringRuleId, "recurringRuleId");
    }
}
async function assertCategoryMatchesType(database, categoryId, type) {
    const result = await database.execute("SELECT type FROM categories WHERE id = ?", [categoryId]);
    const categoryType = result.rows[0]?.type;
    if (categoryType === undefined) {
        throw new TypeError("Transaction category does not exist.");
    }
    if (categoryType !== type) {
        throw new TypeError("Transaction type must match the category type.");
    }
}
export class TransactionRepository {
    constructor(database) {
        this.database = database;
    }
    async create(transaction) {
        validateTransaction(transaction);
        await assertCategoryMatchesType(this.database, transaction.categoryId, transaction.type);
        const id = await insertRow(this.database, `INSERT INTO transactions (
          amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            transaction.amountMinor,
            transaction.type,
            transaction.categoryId,
            transaction.accountId,
            transaction.dateEpochMillis,
            transaction.note,
            transaction.recurringRuleId,
        ]);
        return requireCreatedEntity(await this.getById(id), "Transaction");
    }
    async getById(id) {
        const row = await findRowById(this.database, "transactions", id);
        return row === null ? null : mapTransaction(row);
    }
    async list() {
        return (await listRows(this.database, "transactions")).map(mapTransaction);
    }
    async update(id, patch) {
        const assignments = [];
        if (patch.amountMinor !== undefined) {
            assertPositiveInteger(patch.amountMinor, "amountMinor");
            assignments.push({ column: "amount_minor", value: patch.amountMinor });
        }
        if (patch.type !== undefined) {
            assertOneOf(patch.type, TRANSACTION_TYPES, "type");
            assignments.push({ column: "type", value: patch.type });
        }
        if (patch.categoryId !== undefined) {
            assertPositiveInteger(patch.categoryId, "categoryId");
            assignments.push({ column: "category_id", value: patch.categoryId });
        }
        if (patch.accountId !== undefined) {
            assertPositiveInteger(patch.accountId, "accountId");
            assignments.push({ column: "account_id", value: patch.accountId });
        }
        if (patch.dateEpochMillis !== undefined) {
            assertSafeInteger(patch.dateEpochMillis, "dateEpochMillis");
            assignments.push({ column: "date_epoch_millis", value: patch.dateEpochMillis });
        }
        if (patch.note !== undefined) {
            assignments.push({ column: "note", value: patch.note });
        }
        if (patch.recurringRuleId !== undefined) {
            if (patch.recurringRuleId !== null) {
                assertPositiveInteger(patch.recurringRuleId, "recurringRuleId");
            }
            assignments.push({ column: "recurring_rule_id", value: patch.recurringRuleId });
        }
        const didUpdate = await updateRow(this.database, "transactions", id, assignments);
        return didUpdate ? this.getById(id) : null;
    }
    delete(id) {
        return deleteRow(this.database, "transactions", id);
    }
}
