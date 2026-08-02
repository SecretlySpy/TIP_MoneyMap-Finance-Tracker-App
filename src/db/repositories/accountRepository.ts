import {
  ACCOUNT_TYPES,
  type Account,
  type AccountUpdate,
  type NewAccount,
} from "../../domain/types";
import type { SqlDatabase, SqlRow } from "../sql";
import {
  assertNonBlank,
  assertOneOf,
  assertSafeInteger,
  readBoolean,
  readEnum,
  readInteger,
  readString,
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

function mapAccount(row: SqlRow): Account {
  return {
    id: readInteger(row, "id"),
    name: readString(row, "name"),
    type: readEnum(row, "type", ACCOUNT_TYPES),
    startingBalanceMinor: readInteger(row, "starting_balance_minor"),
    isArchived: readBoolean(row, "is_archived"),
  };
}

function validateAccount(account: NewAccount): void {
  assertNonBlank(account.name, "name");
  assertOneOf(account.type, ACCOUNT_TYPES, "type");
  assertSafeInteger(account.startingBalanceMinor, "startingBalanceMinor");
}

export class AccountRepository {
  public constructor(private readonly database: SqlDatabase) {}

  public async create(account: NewAccount): Promise<Account> {
    validateAccount(account);
    const id = await insertRow(
      this.database,
      `INSERT INTO accounts (name, type, starting_balance_minor, is_archived)
       VALUES (?, ?, ?, ?)`,
      [account.name, account.type, account.startingBalanceMinor, account.isArchived ? 1 : 0],
    );

    return requireCreatedEntity(await this.getById(id), "Account");
  }

  public async getById(id: number): Promise<Account | null> {
    const row = await findRowById(this.database, "accounts", id);
    return row === null ? null : mapAccount(row);
  }

  public async list(): Promise<Account[]> {
    return (await listRows(this.database, "accounts")).map(mapAccount);
  }

  public async update(id: number, patch: AccountUpdate): Promise<Account | null> {
    const assignments: UpdateAssignment[] = [];

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

  public delete(id: number): Promise<boolean> {
    return deleteRow(this.database, "accounts", id);
  }
}
