import { RECURRING_FREQUENCIES, TRANSACTION_TYPES, } from "../../domain/types";
import { assertNonNegativeInteger, assertOneOf, assertPositiveInteger, assertSafeInteger, readBoolean, readEnum, readInteger, readNullableString, } from "../validation";
import { deleteRow, findRowById, insertRow, listRows, requireCreatedEntity, updateRow, } from "./shared";
function mapRecurringRule(row) {
    return {
        id: readInteger(row, "id"),
        amountMinor: readInteger(row, "amount_minor"),
        type: readEnum(row, "type", TRANSACTION_TYPES),
        categoryId: readInteger(row, "category_id"),
        accountId: readInteger(row, "account_id"),
        note: readNullableString(row, "note"),
        frequency: readEnum(row, "frequency", RECURRING_FREQUENCIES),
        nextRunEpochMillis: readInteger(row, "next_run_epoch_millis"),
        isActive: readBoolean(row, "is_active"),
        reminderEnabled: readBoolean(row, "reminder_enabled"),
        reminderLeadDays: readInteger(row, "reminder_lead_days"),
        icon: typeof row.icon === "string" ? row.icon : null,
    };
}
function validateRecurringRule(rule) {
    assertPositiveInteger(rule.amountMinor, "amountMinor");
    assertOneOf(rule.type, TRANSACTION_TYPES, "type");
    assertPositiveInteger(rule.categoryId, "categoryId");
    assertPositiveInteger(rule.accountId, "accountId");
    assertOneOf(rule.frequency, RECURRING_FREQUENCIES, "frequency");
    assertSafeInteger(rule.nextRunEpochMillis, "nextRunEpochMillis");
    assertNonNegativeInteger(rule.reminderLeadDays, "reminderLeadDays");
}
export class RecurringRepository {
    constructor(database) {
        this.database = database;
    }
    async create(rule) {
        validateRecurringRule(rule);
        const id = await insertRow(this.database, `INSERT INTO recurring_rules (
          amount_minor, type, category_id, account_id, note, frequency,
          next_run_epoch_millis, is_active, reminder_enabled, reminder_lead_days, icon
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            rule.amountMinor,
            rule.type,
            rule.categoryId,
            rule.accountId,
            rule.note,
            rule.frequency,
            rule.nextRunEpochMillis,
            rule.isActive ? 1 : 0,
            rule.reminderEnabled ? 1 : 0,
            rule.reminderLeadDays,
            rule.icon ?? null,
        ]);
        return requireCreatedEntity(await this.getById(id), "Recurring rule");
    }
    async getById(id) {
        const row = await findRowById(this.database, "recurring_rules", id);
        return row === null ? null : mapRecurringRule(row);
    }
    async list() {
        return (await listRows(this.database, "recurring_rules")).map(mapRecurringRule);
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
        if (patch.note !== undefined) {
            assignments.push({ column: "note", value: patch.note });
        }
        if (patch.frequency !== undefined) {
            assertOneOf(patch.frequency, RECURRING_FREQUENCIES, "frequency");
            assignments.push({ column: "frequency", value: patch.frequency });
        }
        if (patch.nextRunEpochMillis !== undefined) {
            assertSafeInteger(patch.nextRunEpochMillis, "nextRunEpochMillis");
            assignments.push({ column: "next_run_epoch_millis", value: patch.nextRunEpochMillis });
        }
        if (patch.isActive !== undefined) {
            assignments.push({ column: "is_active", value: patch.isActive ? 1 : 0 });
        }
        if (patch.reminderEnabled !== undefined) {
            assignments.push({ column: "reminder_enabled", value: patch.reminderEnabled ? 1 : 0 });
        }
        if (patch.reminderLeadDays !== undefined) {
            assertNonNegativeInteger(patch.reminderLeadDays, "reminderLeadDays");
            assignments.push({ column: "reminder_lead_days", value: patch.reminderLeadDays });
        }
        if (patch.icon !== undefined) {
            assignments.push({ column: "icon", value: patch.icon });
        }
        const didUpdate = await updateRow(this.database, "recurring_rules", id, assignments);
        return didUpdate ? this.getById(id) : null;
    }
    delete(id) {
        return deleteRow(this.database, "recurring_rules", id);
    }
}
