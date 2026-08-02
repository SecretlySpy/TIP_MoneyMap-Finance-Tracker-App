import {
  TRANSACTION_TYPES,
  type NewTransaction,
  type Transaction as FinanceTransaction,
  type TransactionUpdate,
} from "../../domain/types";
import type { SqlDatabase, SqlRow } from "../sql";
import {
  assertOneOf,
  assertPositiveInteger,
  assertSafeInteger,
  readEnum,
  readInteger,
  readNullableString,
} from "../validation";
import {
  deleteRow,
  findRowById,
  insertRow,
  listRows,
  requireCreatedEntity,
  updateRow,
  type UpdateAssignment,
} from "./shared";

function mapTransaction(row: SqlRow): FinanceTransaction {
  const recurringRuleIdValue = row.recurring_rule_id;

  return {
    id: readInteger(row, "id"),
    amountMinor: readInteger(row, "amount_minor"),
    type: readEnum(row, "type", TRANSACTION_TYPES),
    categoryId: readInteger(row, "category_id"),
    accountId: readInteger(row, "account_id"),
    dateEpochMillis: readInteger(row, "date_epoch_millis"),
    note: readNullableString(row, "note"),
    recurringRuleId:
      recurringRuleIdValue === null ? null : readInteger(row, "recurring_rule_id"),
  };
}

function validateTransaction(transaction: NewTransaction): void {
  assertPositiveInteger(transaction.amountMinor, "amountMinor");
  assertOneOf(transaction.type, TRANSACTION_TYPES, "type");
  assertPositiveInteger(transaction.categoryId, "categoryId");
  assertPositiveInteger(transaction.accountId, "accountId");
  assertSafeInteger(transaction.dateEpochMillis, "dateEpochMillis");

  if (transaction.recurringRuleId !== null) {
    assertPositiveInteger(transaction.recurringRuleId, "recurringRuleId");
  }
}

export class TransactionRepository {
  public constructor(private readonly database: SqlDatabase) {}

  public async create(transaction: NewTransaction): Promise<FinanceTransaction> {
    validateTransaction(transaction);
    const id = await insertRow(
      this.database,
      `INSERT INTO transactions (
         amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.amountMinor,
        transaction.type,
        transaction.categoryId,
        transaction.accountId,
        transaction.dateEpochMillis,
        transaction.note,
        transaction.recurringRuleId,
      ],
    );

    return requireCreatedEntity(await this.getById(id), "Transaction");
  }

  public async getById(id: number): Promise<FinanceTransaction | null> {
    const row = await findRowById(this.database, "transactions", id);
    return row === null ? null : mapTransaction(row);
  }

  public async list(): Promise<FinanceTransaction[]> {
    return (await listRows(this.database, "transactions")).map(mapTransaction);
  }

  public async update(
    id: number,
    patch: TransactionUpdate,
  ): Promise<FinanceTransaction | null> {
    const assignments: UpdateAssignment[] = [];

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

  public delete(id: number): Promise<boolean> {
    return deleteRow(this.database, "transactions", id);
  }
}
