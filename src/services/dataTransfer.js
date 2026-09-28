import { Share } from "react-native";
import { importAccountKey, normalizeImportAccountLabel, parseImportAccountType } from "../domain/services/importParser";
import { parseDecimalToMinor } from "../domain/services/money";
export const BACKUP_FORMAT = "moneymap-backup";
export const BACKUP_VERSION = 1;
export function buildBackup(snapshot) {
    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAtIso: new Date().toISOString(),
        accounts: snapshot.accounts,
        categories: snapshot.categories,
        transactions: snapshot.transactions,
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
    const collections = ["accounts", "categories", "transactions", "budgets", "recurringRules", "goals"];
    const integerFields = {
        accounts: ["startingBalanceMinor"], categories: [],
        transactions: ["amountMinor", "dateEpochMillis"], budgets: ["limitMinor"],
        recurringRules: ["amountMinor", "nextRunEpochMillis", "reminderLeadDays"],
        goals: ["targetMinor", "currentMinor", "createdEpochMillis"],
    };
    const ids = new Map();
    for (const field of collections) {
        const rows = backup[field] ?? (field === "goals" ? [] : undefined);
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
            if (field === "goals" && row.deadlineEpochMillis != null && !Number.isSafeInteger(row.deadlineEpochMillis)) {
                throw new Error("Backup goals contains an unsafe deadline.");
            }
        }
        ids.set(field, seen);
    }
    const categories = new Map(backup.categories.map((row) => [row.id, row]));
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
        }
    }
    for (const row of backup.budgets) {
        if (categories.get(row.categoryId)?.type !== "EXPENSE") {
            throw new Error("Backup budgets contains an invalid expense category reference.");
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
    if (record.version !== BACKUP_VERSION) {
        throw new Error(`Unsupported backup version: ${String(record.version)}`);
    }
    if (!Array.isArray(record.accounts) || !Array.isArray(record.categories)) {
        throw new Error("Backup is missing accounts or categories.");
    }
    // Legacy omitted collections remain supported; present malformed collections fail closed.
    for (const field of ["transactions", "budgets", "recurringRules", "goals"]) {
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
        budgets: Array.isArray(record.budgets) ? record.budgets : [],
        recurringRules: Array.isArray(record.recurringRules) ? record.recurringRules : [],
        // Optional for backward compatibility: v1 backups written before goals
        // were included simply restore none rather than failing to parse.
        goals: Array.isArray(record.goals) ? record.goals : [],
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
    const header = "date,type,amount,category,account,note";
    const lines = [...transactions]
        .sort((left, right) => left.dateEpochMillis - right.dateEpochMillis)
        .map((transaction) => {
        const category = categoriesById.get(transaction.categoryId)?.name ?? "Other";
        const account = accountsById.get(transaction.accountId);
        const accountLabel = account?.name ?? "Cash";
        const note = transaction.note ?? "";
        return [
            formatCsvDate(transaction.dateEpochMillis),
            transaction.type,
            formatCsvAmount(transaction.amountMinor),
            escapeCsv(category),
            escapeCsv(accountLabel),
            escapeCsv(note),
        ].join(",");
    });
    return `${[header, ...lines].join("\n")}\n`;
}
function splitCsvLine(line) {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (inQuotes) {
            if (char === '"') {
                if (line[index + 1] === '"') {
                    current += '"';
                    index += 1;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
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
function parseCsvDate(value) {
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
export function parseTransactionsCsv(raw) {
    const lines = raw
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (lines.length === 0) {
        throw new Error("CSV is empty.");
    }
    const headerCells = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
    const hasHeader = headerCells.includes("date") && headerCells.includes("amount");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    if (dataLines.length === 0) {
        throw new Error("CSV has no transaction rows.");
    }
    const indexOf = (name, fallback) => {
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
        const type = typeRaw === "INCOME" ? "INCOME" : "EXPENSE";
        const amountRaw = (cells[amountIndex] ?? "").trim();
        if (amountRaw.length === 0) {
            throw new Error(`Row ${rowIndex + 1} is missing an amount.`);
        }
        const amountMinor = parseDecimalToMinor(amountRaw.replace(/[₱$,]/g, ""));
        if (amountMinor <= 0) {
            throw new Error(`Row ${rowIndex + 1} amount must be positive.`);
        }
        const categoryName = (cells[categoryIndex] ?? "Other").trim() || "Other";
        const accountLabel = normalizeImportAccountLabel(cells[accountIndex]);
        if (accountLabel.length === 0) {
            throw new Error(`Row ${rowIndex + 1} is missing an account.`);
        }
        const noteRaw = (cells[noteIndex] ?? "").trim();
        return {
            dateEpochMillis: parseCsvDate(cells[dateIndex] ?? ""),
            type,
            amountMinor,
            categoryName,
            accountLabel,
            accountKey: importAccountKey(accountLabel),
            accountType: parseImportAccountType(accountLabel),
            note: noteRaw.length > 0 ? noteRaw : null,
        };
    });
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
        await Share.share({ title, url: uri, message: title });
        return "file";
    }
    catch (error) {
        if (!uri) {
            // Intent-extra path: fine for small exports, the only option without expo-file-system.
            await Share.share({ title, message: contents });
            return "text";
        }
        throw error;
    }
    finally {
        if (uri && FileSystem?.deleteAsync) {
            try {
                await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch {
                // Ignore cleanup error if already removed
            }
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
