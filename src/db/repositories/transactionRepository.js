import { TRANSACTION_TYPES, } from "../../domain/types";
import { assertNonBlank, assertOneOf, assertPositiveInteger, assertSafeInteger, readEnum, readInteger, readNullableString, } from "../validation";
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
        scheduledDateEpochMillis: row.scheduled_date_epoch_millis === null
            ? null
            : readInteger(row, "scheduled_date_epoch_millis"),
        sourceKey: readNullableString(row, "source_key"),
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
    if (transaction.scheduledDateEpochMillis !== null && transaction.scheduledDateEpochMillis !== undefined) {
        assertSafeInteger(transaction.scheduledDateEpochMillis, "scheduledDateEpochMillis");
    }
    if (transaction.sourceKey !== null && transaction.sourceKey !== undefined) {
        if (typeof transaction.sourceKey !== "string") {
            throw new TypeError("sourceKey must be text or null.");
        }
        assertNonBlank(transaction.sourceKey, "sourceKey");
        if (transaction.sourceKey.length > 256) {
            throw new TypeError("sourceKey must be at most 256 characters.");
        }
    }
}

function isSameFinancialEffect(existing, transaction) {
    return existing.amountMinor === transaction.amountMinor
        && existing.type === transaction.type
        && existing.categoryId === transaction.categoryId
        && existing.accountId === transaction.accountId
        && existing.dateEpochMillis === transaction.dateEpochMillis
        && existing.note === transaction.note
        && existing.recurringRuleId === transaction.recurringRuleId
        && existing.scheduledDateEpochMillis === transaction.scheduledDateEpochMillis;
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
        const recurringRuleId = transaction.recurringRuleId ?? null;
        const normalized = {
            ...transaction,
            note: transaction.note ?? null,
            scheduledDateEpochMillis: transaction.scheduledDateEpochMillis
                ?? (recurringRuleId === null ? null : transaction.dateEpochMillis),
            recurringRuleId,
            sourceKey: transaction.sourceKey ?? null,
        };
        validateTransaction(normalized);
        await assertCategoryMatchesType(this.database, normalized.categoryId, normalized.type);
        const sourceKey = normalized.sourceKey;
        const statement = `INSERT INTO transactions (
          amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id,
          scheduled_date_epoch_millis, source_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const parameters = [
            normalized.amountMinor,
            normalized.type,
            normalized.categoryId,
            normalized.accountId,
            normalized.dateEpochMillis,
            normalized.note,
            normalized.recurringRuleId,
            normalized.scheduledDateEpochMillis,
            sourceKey,
        ];
        if (sourceKey !== null) {
            const result = await this.database.execute(`${statement} ON CONFLICT(source_key) DO NOTHING`, parameters);
            if (result.rowsAffected === 0) {
                const existing = await this.getBySourceKey(sourceKey);
                if (existing === null || !isSameFinancialEffect(existing, normalized)) {
                    throw new Error("The transaction source key is already assigned to a different financial effect.");
                }
                return existing;
            }
            return requireCreatedEntity(await this.getBySourceKey(sourceKey), "Transaction");
        }
        const id = await insertRow(this.database, statement, parameters);
        return requireCreatedEntity(await this.getById(id), "Transaction");
    }
    async getById(id) {
        const row = await findRowById(this.database, "transactions", id);
        return row === null ? null : mapTransaction(row);
    }
    async getBySourceKey(sourceKey) {
        if (typeof sourceKey !== "string") {
            throw new TypeError("sourceKey must be text.");
        }
        assertNonBlank(sourceKey, "sourceKey");
        const result = await this.database.execute("SELECT * FROM transactions WHERE source_key = ?", [sourceKey]);
        const row = result.rows[0];
        return row === undefined ? null : mapTransaction(row);
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
