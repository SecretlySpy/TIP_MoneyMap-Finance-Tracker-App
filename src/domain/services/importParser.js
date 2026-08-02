import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseDecimalToMinor } from "./money";

/**
 * @typedef {'Date'|'Amount'|'Category'|'Account'|'Note'|'Type'} ImportField
 * @typedef {Record<ImportField, number>} ImportColumnMappings
 * @typedef {{ dateEpochMillis: number, type: 'EXPENSE'|'INCOME', amountMinor: number, categoryName: string, accountType: 'CASH'|'CARD'|'EWALLET', note: string|null }} ImportTransactionRow
 * @typedef {{ rowNumber: number, reason: string }} ImportSkip
 * @typedef {{ rows: ImportTransactionRow[], skipped: ImportSkip[], headers: string[], dataRowCount: number }} ImportParseResult
 */

/** @type {ImportField[]} */
export const IMPORT_FIELDS = ["Date", "Amount", "Type", "Category", "Account", "Note"];

/**
 * @returns {ImportColumnMappings}
 */
export function emptyImportMappings() {
  return {
    Date: -1,
    Amount: -1,
    Type: -1,
    Category: -1,
    Account: -1,
    Note: -1,
  };
}

/**
 * Auto-map header labels to import fields (first match wins per field).
 * @param {string[]} headers
 * @returns {ImportColumnMappings}
 */
export function detectImportMappings(headers) {
  const mappings = emptyImportMappings();
  headers.forEach((header, index) => {
    const lower = String(header ?? "").trim().toLowerCase();
    if (mappings.Date < 0 && lower.includes("date")) {
      mappings.Date = index;
      return;
    }
    if (mappings.Amount < 0 && (lower.includes("amount") || lower.includes("price") || lower === "value")) {
      mappings.Amount = index;
      return;
    }
    if (mappings.Type < 0 && (lower === "type" || lower.includes("txn type") || lower === "income/expense")) {
      mappings.Type = index;
      return;
    }
    if (mappings.Category < 0 && lower.includes("category")) {
      mappings.Category = index;
      return;
    }
    if (mappings.Account < 0 && lower.includes("account")) {
      mappings.Account = index;
      return;
    }
    if (mappings.Note < 0 && (lower.includes("note") || lower.includes("desc") || lower.includes("memo"))) {
      mappings.Note = index;
    }
  });
  return mappings;
}

/**
 * @param {string} value
 * @returns {number}
 */
export function parseImportDate(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length === 0) {
    throw new Error("Date is empty.");
  }
  // Excel serial date (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (Number.isFinite(serial) && serial > 20000 && serial < 100000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const millis = excelEpoch + Math.round(serial * 86400000);
      const date = new Date(millis);
      return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0).getTime();
    }
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso !== null) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error(`Invalid date "${trimmed}".`);
    }
    return date.getTime();
  }
  const slash = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(trimmed);
  if (slash !== null) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error(`Invalid date "${trimmed}".`);
    }
    return date.getTime();
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0).getTime();
  }
  throw new Error(`Invalid date "${trimmed}". Use YYYY-MM-DD.`);
}

/**
 * @param {string} value
 * @returns {'CASH'|'CARD'|'EWALLET'}
 */
export function parseImportAccountType(value) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (normalized === "CASH" || normalized.includes("CASH")) {
    return "CASH";
  }
  if (normalized === "CARD" || normalized === "CREDIT" || normalized === "DEBIT" || normalized.includes("CARD")) {
    return "CARD";
  }
  if (
    normalized === "EWALLET"
    || normalized === "E_WALLET"
    || normalized === "WALLET"
    || normalized.includes("WALLET")
  ) {
    return "EWALLET";
  }
  return "CASH";
}

/**
 * @param {string} value
 * @returns {'EXPENSE'|'INCOME'|null}
 */
export function parseImportType(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.startsWith("IN") || normalized === "+" || normalized === "CREDIT") {
    return "INCOME";
  }
  if (normalized.startsWith("EX") || normalized === "-" || normalized === "DEBIT") {
    return "EXPENSE";
  }
  return null;
}

/**
 * Normalize a 2D grid (header row + data) into validated import rows.
 * Malformed rows are skipped and reported — never thrown for row-level issues.
 *
 * @param {unknown[][]} grid
 * @param {ImportColumnMappings} [mappings]
 * @returns {ImportParseResult}
 */
export function parseImportGrid(grid, mappings) {
  if (!Array.isArray(grid) || grid.length === 0) {
    return { rows: [], skipped: [{ rowNumber: 0, reason: "File has no rows." }], headers: [], dataRowCount: 0 };
  }

  const headerCells = (grid[0] ?? []).map((cell) => String(cell ?? "").trim());
  const looksLikeHeader = headerCells.some((cell) => {
    const lower = cell.toLowerCase();
    return lower.includes("date") || lower.includes("amount") || lower.includes("category");
  });
  const headers = looksLikeHeader ? headerCells : headerCells.map((_, index) => `Column ${index + 1}`);
  const dataRows = looksLikeHeader ? grid.slice(1) : grid;
  const resolvedMappings = mappings ?? detectImportMappings(headers);

  /** @type {ImportTransactionRow[]} */
  const rows = [];
  /** @type {ImportSkip[]} */
  const skipped = [];

  dataRows.forEach((rawRow, index) => {
    const rowNumber = index + (looksLikeHeader ? 2 : 1);
    const cells = Array.isArray(rawRow) ? rawRow : [];
    const isEmpty = cells.every((cell) => String(cell ?? "").trim().length === 0);
    if (isEmpty) {
      return;
    }

    try {
      if (resolvedMappings.Amount < 0) {
        throw new Error("Amount column is unmapped.");
      }
      const amountRaw = String(cells[resolvedMappings.Amount] ?? "").trim();
      if (amountRaw.length === 0) {
        throw new Error("Amount is empty.");
      }
      const cleanedAmount = amountRaw.replace(/[₱$,\s]/g, "");
      const unsignedAmount = cleanedAmount.replace(/^[-+]/, "");
      let amountMinor = parseDecimalToMinor(unsignedAmount);
      const explicitType = resolvedMappings.Type >= 0
        ? parseImportType(String(cells[resolvedMappings.Type] ?? ""))
        : null;
      /** @type {'EXPENSE'|'INCOME'} */
      let type;
      if (explicitType !== null) {
        type = explicitType;
      } else if (cleanedAmount.startsWith("-")) {
        type = "EXPENSE";
      } else {
        // MoneyMap export uses a Type column; without it, treat values as expenses (spend log).
        type = "EXPENSE";
      }
      amountMinor = Math.abs(amountMinor);
      if (amountMinor <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      const dateRaw = resolvedMappings.Date >= 0 ? String(cells[resolvedMappings.Date] ?? "") : "";
      const dateEpochMillis = resolvedMappings.Date >= 0
        ? parseImportDate(dateRaw)
        : new Date().setHours(12, 0, 0, 0);

      const categoryName = (
        resolvedMappings.Category >= 0
          ? String(cells[resolvedMappings.Category] ?? "")
          : "Other"
      ).trim() || "Other";

      const accountType = parseImportAccountType(
        resolvedMappings.Account >= 0 ? String(cells[resolvedMappings.Account] ?? "CASH") : "CASH",
      );

      const noteRaw = resolvedMappings.Note >= 0
        ? String(cells[resolvedMappings.Note] ?? "").trim()
        : "";

      rows.push({
        dateEpochMillis,
        type,
        amountMinor,
        categoryName,
        accountType,
        note: noteRaw.length > 0 ? noteRaw : null,
      });
    } catch (error) {
      skipped.push({
        rowNumber,
        reason: error instanceof Error ? error.message : "Invalid row.",
      });
    }
  });

  return {
    rows,
    skipped,
    headers,
    dataRowCount: dataRows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim().length > 0)).length,
  };
}

/**
 * @param {string} text
 * @returns {unknown[][]}
 */
export function csvTextToGrid(text) {
  const parsed = Papa.parse(String(text ?? "").replace(/^\uFEFF/, ""), {
    header: false,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors?.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    throw new Error(parsed.errors[0]?.message || "CSV parse failed.");
  }
  return (parsed.data ?? []).map((row) => (Array.isArray(row) ? row : []));
}

/**
 * @param {string | ArrayBuffer | Uint8Array} input base64 string, ArrayBuffer, or bytes
 * @param {'base64'|'array'|'buffer'} [type]
 * @returns {unknown[][]}
 */
export function xlsxToGrid(input, type = "base64") {
  const workbook = XLSX.read(input, {
    type,
    cellDates: false,
    raw: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (sheetName === undefined) {
    throw new Error("Excel workbook has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (!Array.isArray(grid) || grid.length === 0) {
    throw new Error("Excel sheet is empty.");
  }
  return grid.map((row) => (Array.isArray(row) ? row : []));
}

/**
 * @param {string} fileName
 * @returns {'csv'|'xlsx'|'unknown'}
 */
export function detectImportFormat(fileName) {
  const lower = String(fileName ?? "").toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return "xlsx";
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return "csv";
  }
  return "unknown";
}

/**
 * Parse CSV text or XLSX bytes into the shared import result.
 * @param {{ format: 'csv'|'xlsx', content: string, fileName?: string, mappings?: ImportColumnMappings }} input
 * content is UTF-8 text for csv, base64 for xlsx
 */
export function parseImportFile(input) {
  const grid = input.format === "xlsx"
    ? xlsxToGrid(input.content, "base64")
    : csvTextToGrid(input.content);
  return parseImportGrid(grid, input.mappings);
}
