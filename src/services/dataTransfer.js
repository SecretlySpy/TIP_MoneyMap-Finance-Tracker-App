import { Share } from "react-native";
import {
    assertImportGridWithinLimits,
    assertImportRowWithinLimits,
    csvTextToGrid,
    importAccountKey,
    normalizeImportAccountLabel,
    parseImportAccountType,
    parseImportType,
} from "../domain/services/importParser";
import { parseDecimalToMinor } from "../domain/services/money";
import { ACCOUNT_TYPES, RECURRING_FREQUENCIES, TRANSACTION_TYPES } from "../domain/types";
import { assertMonthYear, assertValidEpochMillis } from "../db/validation";
export const BACKUP_FORMAT = "moneymap-backup";
export const BACKUP_VERSION = 3;
const LEGACY_BACKUP_VERSION = 2;
export function buildBackup(snapshot) {
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAtIso: new Date().toISOString(),
        accounts: snapshot.accounts,
        categories: snapshot.categories,
        transactions: snapshot.transactions,
        transfers: snapshot.transfers ?? [],
        budgets: snapshot.budgets,
        recurringRules: snapshot.recurringRules,
        // Goals are wiped by restoreBackup, so they must round-trip or they are lost.
        goals: snapshot.goals ?? [],
    };
}
export function serializeBackup(backup) {
    return `${JSON.stringify(backup, null, 2)}\n`;
}
export function validateBackup(backup) {
    // Validate identity and references before restore can replace any local data.
    const requireText = (value, field) => {
        if (typeof value !== "string" || value.trim().length === 0) {
            throw new Error(`Backup contains an invalid ${field}.`);
        }
    };
    const requireNote = (value, field) => {
        if (value !== null && typeof value !== "string") {
            throw new Error(`Backup contains an invalid ${field}.`);
        }
    };
    const collections = ["accounts", "categories", "transactions", "transfers", "budgets", "recurringRules", "goals"];
    const integerFields = {
        accounts: ["startingBalanceMinor"], categories: [],
        transactions: ["amountMinor", "dateEpochMillis"], budgets: ["limitMinor"],
        transfers: ["amountMinor", "dateEpochMillis"],
        recurringRules: ["amountMinor", "nextRunEpochMillis", "reminderLeadDays"],
        goals: ["targetMinor", "currentMinor", "createdEpochMillis"],
    };
    const booleanFields = {
        accounts: ["isArchived"],
        categories: ["isCustom"],
        transactions: [],
        transfers: [],
        budgets: [],
        recurringRules: ["isActive", "reminderEnabled"],
        goals: ["isArchived"],
    };
    const ids = new Map();
    for (const field of collections) {
        const rows = backup[field]
            ?? (field === "goals" || (field === "transfers" && backup.version === LEGACY_BACKUP_VERSION)
                ? []
                : undefined);
        if (!Array.isArray(rows)) {
            throw new Error(`Backup ${field} must be an array.`);
        }
        const seen = new Set();
        for (const row of rows) {
            if (row === null || typeof row !== "object" || !Number.isSafeInteger(row.id) || row.id <= 0 || seen.has(row.id)) {
                throw new Error(`Backup ${field} contains invalid or duplicate identifiers.`);
            }
            seen.add(row.id);
            // SQLite accepts 64-bit values that JS cannot represent exactly; reject before COMMIT.
            for (const integerField of integerFields[field]) {
                if (!Number.isSafeInteger(row[integerField])) {
                    throw new Error(`Backup ${field} contains an unsafe ${integerField}.`);
                }
            }
            for (const booleanField of booleanFields[field]) {
                if (typeof row[booleanField] !== "boolean") {
                    throw new Error(`Backup ${field} contains an invalid ${booleanField} flag.`);
                }
            }
            if (field === "goals" && row.deadlineEpochMillis != null) {
                assertValidEpochMillis(row.deadlineEpochMillis, "goal deadline");
            }
            if (field === "transactions") {
                assertValidEpochMillis(row.dateEpochMillis, "transaction date");
            }
            if (field === "transfers") {
                assertValidEpochMillis(row.dateEpochMillis, "transfer date");
            }
            if (field === "recurringRules") {
                assertValidEpochMillis(row.nextRunEpochMillis, "recurring rule nextRun");
            }
            if (field === "goals") {
                assertValidEpochMillis(row.createdEpochMillis, "goal created date");
            }
            if (field === "accounts") {
                requireText(row.name, "account name");
                if (!ACCOUNT_TYPES.includes(row.type)) throw new Error("Backup contains an invalid account type.");
            }
            if (field === "categories") {
                requireText(row.name, "category name");
                requireText(row.icon, "category icon");
                if (!/^#[0-9A-Fa-f]{6}$/.test(row.colorHex)) throw new Error("Backup contains an invalid category color.");
                if (!TRANSACTION_TYPES.includes(row.type)) throw new Error("Backup contains an invalid category type.");
            }
            if (field === "transactions") {
                if (!TRANSACTION_TYPES.includes(row.type)) throw new Error("Backup contains an invalid transaction type.");
                requireNote(row.note, "transaction note");
            }
            if (field === "transfers") {
                requireNote(row.note, "transfer note");
            }
            if (field === "recurringRules") {
                if (!TRANSACTION_TYPES.includes(row.type)) throw new Error("Backup contains an invalid recurring type.");
                if (!RECURRING_FREQUENCIES.includes(row.frequency)) throw new Error("Backup contains an invalid recurring frequency.");
                if (row.reminderLeadDays < 0) throw new Error("Backup contains an invalid reminder lead time.");
                if (row.anchorDay != null && (!Number.isSafeInteger(row.anchorDay) || row.anchorDay < 1 || row.anchorDay > 31)) {
                    throw new Error("Backup contains an invalid recurring anchor day.");
                }
                if (row.icon != null && typeof row.icon !== "string") throw new Error("Backup contains an invalid recurring icon.");
                requireNote(row.note, "recurring note");
            }
            if (field === "budgets") {
                try {
                    assertMonthYear(row.monthYear);
                } catch {
                    throw new Error("Backup contains an invalid budget month.");
                }
                if (row.limitMinor <= 0) throw new Error("Backup contains an invalid budget limit.");
            }
            if (field === "goals") {
                requireText(row.name, "goal name");
                if (row.targetMinor <= 0 || row.currentMinor < 0) throw new Error("Backup contains an invalid goal amount.");
            }
        }
        ids.set(field, seen);
    }
    const categories = new Map(backup.categories.map((row) => [row.id, row]));
    const transactionSourceKeys = new Set();
    for (const field of ["transactions", "recurringRules"]) {
        for (const row of backup[field]) {
            if (!ids.get("accounts").has(row.accountId) || categories.get(row.categoryId)?.type !== row.type) {
                throw new Error(`Backup ${field} contains an invalid account or category reference.`);
            }
            if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor <= 0) {
                throw new Error(`Backup ${field} contains an invalid amount.`);
            }
            if (field === "transactions" && row.recurringRuleId != null && !ids.get("recurringRules").has(row.recurringRuleId)) {
                throw new Error("Backup transactions contains an invalid recurring rule reference.");
            }
            if (field === "transactions" && row.scheduledDateEpochMillis != null && !Number.isSafeInteger(row.scheduledDateEpochMillis)) {
                throw new Error("Backup transactions contains an unsafe scheduled date.");
            }
            if (field === "transactions" && row.sourceKey != null) {
                if (typeof row.sourceKey !== "string" || row.sourceKey.trim().length === 0 || row.sourceKey.length > 256) {
                    throw new Error("Backup transactions contains an invalid source key.");
                }
                if (transactionSourceKeys.has(row.sourceKey)) {
                    throw new Error("Backup transactions contains duplicate source keys.");
                }
                transactionSourceKeys.add(row.sourceKey);
            }
        }
    }
    for (const row of backup.budgets) {
        if (categories.get(row.categoryId)?.type !== "EXPENSE") {
            throw new Error("Backup budgets contains an invalid expense category reference.");
        }
    }
    const transferSourceKeys = new Set();
    for (const row of backup.transfers ?? []) {
        if (!ids.get("accounts").has(row.fromAccountId) || !ids.get("accounts").has(row.toAccountId)) {
            throw new Error("Backup transfers contains an invalid account reference.");
        }
        if (row.fromAccountId === row.toAccountId) {
            throw new Error("Backup transfers must use two different accounts.");
        }
        if (!Number.isSafeInteger(row.amountMinor) || row.amountMinor <= 0) {
            throw new Error("Backup transfers contains an invalid amount.");
        }
        if (row.sourceKey != null) {
            if (typeof row.sourceKey !== "string" || row.sourceKey.trim().length === 0 || row.sourceKey.length > 256) {
                throw new Error("Backup transfers contains an invalid source key.");
            }
            if (transferSourceKeys.has(row.sourceKey)) {
                throw new Error("Backup transfers contains duplicate source keys.");
            }
            transferSourceKeys.add(row.sourceKey);
        }
    }
}
export function parseBackup(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error("Backup file is not valid JSON.");
    }
    if (parsed === null || typeof parsed !== "object") {
        throw new Error("Backup file is empty or invalid.");
    }
    const record = parsed;
    if (record.format !== BACKUP_FORMAT) {
        throw new Error("This file is not a MoneyMap backup.");
    }
    if (record.goals === undefined) {
        throw new Error("Backup is missing the goals field. Restore failed to protect existing goals.");
    }
    if (![LEGACY_BACKUP_VERSION, BACKUP_VERSION].includes(record.version)) {
        throw new Error(`Unsupported backup version: ${String(record.version)}`);
    }
    if (!Array.isArray(record.accounts) || !Array.isArray(record.categories)) {
        throw new Error("Backup is missing accounts or categories.");
    }
    if (!Array.isArray(record.goals)) {
        throw new Error("Backup goals must be an array.");
    }
    if (record.version === BACKUP_VERSION && !Array.isArray(record.transfers)) {
        throw new Error("Backup transfers must be an array.");
    }
    if (record.transfers !== undefined && !Array.isArray(record.transfers)) {
        throw new Error("Backup transfers must be an array.");
    }
    // Legacy omitted collections remain supported; present malformed collections fail closed.
    for (const field of ["transactions", "budgets", "recurringRules"]) {
        if (record[field] !== undefined && !Array.isArray(record[field])) {
            throw new Error(`Backup ${field} must be an array.`);
        }
    }
    const backup = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAtIso: typeof record.exportedAtIso === "string" ? record.exportedAtIso : new Date().toISOString(),
        accounts: record.accounts,
        categories: record.categories,
        transactions: Array.isArray(record.transactions) ? record.transactions : [],
        transfers: Array.isArray(record.transfers) ? record.transfers : [],
        budgets: Array.isArray(record.budgets) ? record.budgets : [],
        recurringRules: Array.isArray(record.recurringRules) ? record.recurringRules : [],
        goals: record.goals,
    };
    validateBackup(backup);
    return backup;
}
export function sanitizeForSpreadsheet(value) {
    const str = String(value ?? "");
    if (/^\s*[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
    }
    return str;
}

export function escapeCsv(value) {
    const sanitized = sanitizeForSpreadsheet(value);
    if (/[",\n\r]/.test(sanitized)) {
        return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
}
function formatCsvAmount(amountMinor) {
    const whole = Math.trunc(amountMinor / 100);
    const cents = Math.abs(amountMinor % 100)
        .toString()
        .padStart(2, "0");
    return `${whole}.${cents}`;
}
function formatCsvDate(epochMillis) {
    const date = new Date(epochMillis);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}
export function buildTransactionsCsv(transactions, categoriesById, accountsById) {
    const header = "date,type,amount,category,account,note,source_key";
    const lines = [...transactions]
        .sort((left, right) => left.dateEpochMillis - right.dateEpochMillis)
        .map((transaction) => {
        const category = categoriesById.get(transaction.categoryId)?.name ?? "Other";
        const account = accountsById.get(transaction.accountId);
        const accountLabel = account?.name ?? "Cash";
        const note = transaction.note ?? "";
        const sourceKey = transaction.sourceKey ?? `exported:${transaction.id}`;
        return [
            formatCsvDate(transaction.dateEpochMillis),
            transaction.type,
            formatCsvAmount(transaction.amountMinor),
            escapeCsv(category),
            escapeCsv(accountLabel),
            escapeCsv(note),
            escapeCsv(sourceKey),
        ].join(",");
    });
    return `${[header, ...lines].join("\n")}\n`;
}
function parseCsvDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match === null) {
        throw new Error(`invalid date "${value}". Use YYYY-MM-DD.`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new Error(`invalid date "${value}". Use YYYY-MM-DD.`);
    }
    return date.getTime();
}
/**
 * Parse pasted CSV into validated rows plus an explicit skip list.
 *
 * The paste path cannot reuse `parseImportGrid` directly: pasted text carries no
 * trustworthy header row, so column positions are resolved here from the documented
 * `date,type,amount,category,account,note` order. Everything else is deliberately
 * aligned with the file pipeline — the same row/column/cell ceilings, the same
 * strict type vocabulary, and row-level problems reported instead of thrown, so the
 * caller can ask the user before committing a partial import.
 *
 * @param {string} raw
 * @returns {{ rows: import('../domain/services/importParser').ImportTransactionRow[],
 *   skipped: { rowNumber: number, reason: string }[],
 *   dataRowCount: number,
 *   mappings: import('../domain/services/importParser').ImportColumnMappings }}
 */
export function parsePastedTransactionsCsv(raw) {
    const grid = csvTextToGrid(raw);
    if (grid.length === 0) {
        throw new Error("CSV is empty.");
    }
    assertImportGridWithinLimits(grid, "Pasted CSV");
    const headerCells = grid[0].map((cell) => String(cell ?? "").trim().toLowerCase());
    const hasHeader = headerCells.includes("date") && headerCells.includes("amount");
    const dataRows = hasHeader ? grid.slice(1) : grid;
    if (dataRows.length === 0) {
        throw new Error("CSV has no transaction rows.");
    }
    const indexOf = (name, fallback) => {
        const index = headerCells.indexOf(name);
        return index >= 0 ? index : fallback;
    };
    const dateIndex = hasHeader ? indexOf("date", 0) : 0;
    const typeIndex = hasHeader ? indexOf("type", -1) : 1;
    const amountIndex = hasHeader ? indexOf("amount", 2) : 2;
    const categoryIndex = hasHeader ? indexOf("category", 3) : 3;
    const accountIndex = hasHeader ? indexOf("account", 4) : 4;
    const noteIndex = hasHeader ? indexOf("note", 5) : 5;
    const sourceKeyIndex = hasHeader ? (indexOf("source_key", -1) >= 0 ? indexOf("source_key", -1) : indexOf("id", -1)) : -1;
    // Expose the positions actually used so callers can bind an idempotency key to the
    // real column layout instead of an assumed one.
    const mappings = {
        Date: dateIndex,
        Amount: amountIndex,
        Type: typeIndex,
        Category: categoryIndex,
        Account: accountIndex,
        Note: noteIndex,
    };
    /** @type {import('../domain/services/importParser').ImportTransactionRow[]} */
    const rows = [];
    /** @type {{ rowNumber: number, reason: string }[]} */
    const skipped = [];
    let dataRowCount = 0;
    dataRows.forEach((rawCells, rowIndex) => {
        const cells = Array.isArray(rawCells) ? rawCells : [];
        if (cells.every((cell) => String(cell ?? "").trim().length === 0)) {
            return;
        }
        dataRowCount += 1;
        const sourceRowNumber = rowIndex + (hasHeader ? 2 : 1);
        try {
            assertImportRowWithinLimits(cells);
            const typeRaw = typeIndex >= 0 ? String(cells[typeIndex] ?? "").trim() : "";
            const explicitType = parseImportType(typeRaw);
            if (typeRaw.length > 0 && explicitType === null) {
                throw new Error(`invalid type "${typeRaw}". Use INCOME or EXPENSE.`);
            }
            const amountRaw = String(cells[amountIndex] ?? "").trim();
            if (amountRaw.length === 0) {
                throw new Error("is missing an amount.");
            }
            const cleanedAmount = amountRaw.replace(/[₱$,\s]/g, "");
            const amountMinor = Math.abs(parseDecimalToMinor(cleanedAmount.replace(/^[-+]/, "")));
            if (amountMinor <= 0) {
                throw new Error("amount must be positive.");
            }
            const type = explicitType ?? (cleanedAmount.startsWith("+") ? "INCOME" : "EXPENSE");
            const categoryName = String(cells[categoryIndex] ?? "Other").trim() || "Other";
            const accountLabel = normalizeImportAccountLabel(cells[accountIndex]);
            if (accountLabel.length === 0) {
                throw new Error("is missing an account.");
            }
            const noteRaw = String(cells[noteIndex] ?? "").trim();
            const sourceKeyRaw = sourceKeyIndex >= 0 ? String(cells[sourceKeyIndex] ?? "").trim() : "";
            rows.push({
                sourceRowNumber,
                dateEpochMillis: parseCsvDate(String(cells[dateIndex] ?? "")),
                type,
                amountMinor,
                categoryName,
                accountLabel,
                accountKey: importAccountKey(accountLabel),
                accountType: parseImportAccountType(accountLabel),
                note: noteRaw.length > 0 ? noteRaw : null,
                sourceKey: sourceKeyRaw.length > 0 ? sourceKeyRaw : undefined,
            });
        }
        catch (error) {
            // Reasons are written to read as "Row 4: <reason>" so the same text serves
            // this skip list and the single-error message thrown below.
            skipped.push({
                rowNumber: sourceRowNumber,
                reason: error instanceof Error ? error.message : "Invalid row.",
            });
        }
    });
    return { rows, skipped, dataRowCount, mappings };
}
/**
 * Strict array-returning paste parser. Kept for callers that cannot present a
 * per-row skip list: any invalid row rejects the whole paste rather than silently
 * importing fewer transactions than the user pasted. Use `parsePastedTransactionsCsv`
 * when the UI can confirm a partial import.
 * @param {string} raw
 * @returns {import('../domain/services/importParser').ImportTransactionRow[]}
 */
export function parseTransactionsCsv(raw) {
    const { rows, skipped } = parsePastedTransactionsCsv(raw);
    const first = skipped[0];
    if (first !== undefined) {
        throw new Error(`CSV row ${first.rowNumber}: ${first.reason}`);
    }
    return rows;
}
export async function shareText(title, message) {
    await Share.share({ title, message });
}
/**
 * Share a generated export as a file when possible, else fall back to inline text.
 * @param {string} title dialog title
 * @param {string} fileName e.g. "moneymap-export.csv"
 * @param {string} contents file body
 * @returns {Promise<'file'|'text'>} which path was used
 */
export async function shareDocument(title, fileName, contents) {
    let uri = null;
    let FileSystem = null;
    try {
        try {
            FileSystem = require("expo-file-system/legacy");
        } catch {
            FileSystem = null;
        }
        const directory = FileSystem?.cacheDirectory ?? FileSystem?.documentDirectory;
        if (!directory) {
            throw new Error("No writable directory.");
        }
        uri = `${directory}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, contents, {
            encoding: FileSystem.EncodingType?.UTF8 ?? "utf8",
        });

        // Do not pass message: title when sharing a file URL to avoid iOS sharing the title instead of the file
        await Share.share({ title, url: uri });
        return "file";
    }
    catch (error) {
        if (!uri) {
            await Share.share({ title, message: contents });
            return "text";
        }
        throw error;
    }
    finally {
        if (uri && FileSystem?.deleteAsync) {
            await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
    }
}
/**
 * Timestamped export filename, e.g. moneymap-transactions-2026-08-31.csv
 * @param {string} prefix
 * @param {string} extension
 * @param {Date} [now]
 */
export function exportFileName(prefix, extension, now = new Date()) {
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${prefix}-${year}-${month}-${day}.${extension}`;
}
