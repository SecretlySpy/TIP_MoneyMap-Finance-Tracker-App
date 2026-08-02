import { Share } from "react-native";

import type {
  Account,
  AccountType,
  Budget,
  Category,
  RecurringRule,
  Transaction,
  TransactionType,
} from "../domain/types";
import { parseDecimalToMinor } from "../domain/services/money";

export const BACKUP_FORMAT = "moneymap-backup" as const;
export const BACKUP_VERSION = 1 as const;

export interface FinanceBackup {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: typeof BACKUP_VERSION;
  readonly exportedAtIso: string;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly budgets: readonly Budget[];
  readonly recurringRules: readonly RecurringRule[];
}

export interface CsvImportRow {
  readonly accountType: AccountType;
  readonly amountMinor: number;
  readonly categoryName: string;
  readonly dateEpochMillis: number;
  readonly note: string | null;
  readonly type: TransactionType;
}

export function buildBackup(snapshot: {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly budgets: readonly Budget[];
  readonly recurringRules: readonly RecurringRule[];
}): FinanceBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAtIso: new Date().toISOString(),
    accounts: snapshot.accounts,
    categories: snapshot.categories,
    transactions: snapshot.transactions,
    budgets: snapshot.budgets,
    recurringRules: snapshot.recurringRules,
  };
}

export function serializeBackup(backup: FinanceBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function parseBackup(raw: string): FinanceBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Backup file is empty or invalid.");
  }
  const record = parsed as Record<string, unknown>;
  if (record.format !== BACKUP_FORMAT) {
    throw new Error("This file is not a MoneyMap backup.");
  }
  if (record.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(record.version)}`);
  }
  if (!Array.isArray(record.accounts) || !Array.isArray(record.categories)) {
    throw new Error("Backup is missing accounts or categories.");
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAtIso: typeof record.exportedAtIso === "string" ? record.exportedAtIso : new Date().toISOString(),
    accounts: record.accounts as Account[],
    categories: record.categories as Category[],
    transactions: Array.isArray(record.transactions) ? (record.transactions as Transaction[]) : [],
    budgets: Array.isArray(record.budgets) ? (record.budgets as Budget[]) : [],
    recurringRules: Array.isArray(record.recurringRules) ? (record.recurringRules as RecurringRule[]) : [],
  };
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvAmount(amountMinor: number): string {
  const whole = Math.trunc(amountMinor / 100);
  const cents = Math.abs(amountMinor % 100)
    .toString()
    .padStart(2, "0");
  return `${whole}.${cents}`;
}

function formatCsvDate(epochMillis: number): string {
  const date = new Date(epochMillis);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildTransactionsCsv(
  transactions: readonly Transaction[],
  categoriesById: ReadonlyMap<number, Category>,
  accountsById: ReadonlyMap<number, Account>,
): string {
  const header = "date,type,amount,category,account,note";
  const lines = [...transactions]
    .sort((left, right) => left.dateEpochMillis - right.dateEpochMillis)
    .map((transaction) => {
      const category = categoriesById.get(transaction.categoryId)?.name ?? "Other";
      const account = accountsById.get(transaction.accountId);
      const accountLabel = account?.type ?? "CASH";
      const note = transaction.note ?? "";
      return [
        formatCsvDate(transaction.dateEpochMillis),
        transaction.type,
        formatCsvAmount(transaction.amountMinor),
        escapeCsv(category),
        accountLabel,
        escapeCsv(note),
      ].join(",");
    });
  return `${[header, ...lines].join("\n")}\n`;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseAccountType(value: string): AccountType {
  const normalized = value.trim().toUpperCase().replace(/[\s-]/g, "");
  if (normalized === "CASH" || normalized === "💵CASH") {
    return "CASH";
  }
  if (normalized === "CARD" || normalized === "CREDIT" || normalized === "DEBIT") {
    return "CARD";
  }
  if (normalized === "EWALLET" || normalized === "E_WALLET" || normalized === "WALLET") {
    return "EWALLET";
  }
  if (value.toLowerCase().includes("wallet")) {
    return "EWALLET";
  }
  if (value.toLowerCase().includes("card")) {
    return "CARD";
  }
  return "CASH";
}

function parseCsvDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) {
    throw new Error(`Invalid CSV date "${value}". Use YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid CSV date "${value}".`);
  }
  return date.getTime();
}

export function parseTransactionsCsv(raw: string): CsvImportRow[] {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error("CSV is empty.");
  }

  const headerCells = splitCsvLine(lines[0]!).map((cell) => cell.trim().toLowerCase());
  const hasHeader = headerCells.includes("date") && headerCells.includes("amount");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length === 0) {
    throw new Error("CSV has no transaction rows.");
  }

  const indexOf = (name: string, fallback: number) => {
    const index = headerCells.indexOf(name);
    return index >= 0 ? index : fallback;
  };

  const dateIndex = hasHeader ? indexOf("date", 0) : 0;
  const typeIndex = hasHeader ? indexOf("type", 1) : 1;
  const amountIndex = hasHeader ? indexOf("amount", 2) : 2;
  const categoryIndex = hasHeader ? indexOf("category", 3) : 3;
  const accountIndex = hasHeader ? indexOf("account", 4) : 4;
  const noteIndex = hasHeader ? indexOf("note", 5) : 5;

  return dataLines.map((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const typeRaw = (cells[typeIndex] ?? "EXPENSE").trim().toUpperCase();
    const type: TransactionType = typeRaw === "INCOME" ? "INCOME" : "EXPENSE";
    const amountRaw = (cells[amountIndex] ?? "").trim();
    if (amountRaw.length === 0) {
      throw new Error(`Row ${rowIndex + 1} is missing an amount.`);
    }
    const amountMinor = parseDecimalToMinor(amountRaw.replace(/[₱$,]/g, ""));
    if (amountMinor <= 0) {
      throw new Error(`Row ${rowIndex + 1} amount must be positive.`);
    }
    const categoryName = (cells[categoryIndex] ?? "Other").trim() || "Other";
    const noteRaw = (cells[noteIndex] ?? "").trim();
    return {
      dateEpochMillis: parseCsvDate(cells[dateIndex] ?? ""),
      type,
      amountMinor,
      categoryName,
      accountType: parseAccountType(cells[accountIndex] ?? "CASH"),
      note: noteRaw.length > 0 ? noteRaw : null,
    };
  });
}

export async function shareText(title: string, message: string): Promise<void> {
  await Share.share({ title, message });
}
