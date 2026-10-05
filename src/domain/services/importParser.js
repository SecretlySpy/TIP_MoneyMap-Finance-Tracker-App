import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseDecimalToMinor } from "./money";

/**
 * @typedef {'Date'|'Amount'|'Category'|'Account'|'Note'|'Type'} ImportField
 * @typedef {Record<ImportField, number>} ImportColumnMappings
 * @typedef {{ sourceRowNumber: number, dateEpochMillis: number, type: 'EXPENSE'|'INCOME', amountMinor: number, categoryName: string, accountLabel: string, accountKey: string, accountType: 'CASH'|'CARD'|'EWALLET'|null, note: string|null }} ImportTransactionRow
 * @typedef {{ rowNumber: number, reason: string }} ImportSkip
 * @typedef {{ rows: ImportTransactionRow[], skipped: ImportSkip[], headers: string[], dataRowCount: number }} ImportParseResult
 */

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_COLUMNS = 100;
export const MAX_CELL_LENGTH = 1_000;
export const MIN_IMPORT_YEAR = 1970;
export const MAX_IMPORT_YEAR = 2100;

/** @type {ImportField[]} */
export const IMPORT_FIELDS = ["Date", "Amount", "Type", "Category", "Account", "Note"];

/**
 * Whole-file ceilings. Exceeding either means the input is not the file the user
 * believes it is, so it is rejected outright instead of being partially imported.
 * Cell length is enforced per row so one oversized note cannot mask the rest.
 * @param {unknown[][]} grid
 * @param {string} [label] source name used in the error message
 */
export function assertImportGridWithinLimits(grid, label = "Import") {
  if (grid.length > MAX_IMPORT_ROWS) {
    throw new Error(`${label} exceeds maximum allowed rows (${MAX_IMPORT_ROWS.toLocaleString()}).`);
  }
  if ((grid[0] ?? []).length > MAX_IMPORT_COLUMNS) {
    throw new Error(`${label} exceeds maximum allowed columns (${MAX_IMPORT_COLUMNS}).`);
  }
}

/**
 * Row-level ceilings. Callers catch these and report the row as skipped so a single
 * malformed line never blocks the rest of a file.
 * @param {unknown[]} cells
 */
export function assertImportRowWithinLimits(cells) {
  if (cells.length > MAX_IMPORT_COLUMNS) {
    throw new Error(`Row exceeds maximum allowed columns (${MAX_IMPORT_COLUMNS}).`);
  }
  for (const cell of cells) {
    if (String(cell ?? "").length > MAX_CELL_LENGTH) {
      throw new Error(`Cell content exceeds maximum length of ${MAX_CELL_LENGTH} characters.`);
    }
  }
}

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
      const year = date.getUTCFullYear();
      if (year < MIN_IMPORT_YEAR || year > MAX_IMPORT_YEAR) {
        throw new Error(`Date year ${year} is outside supported range (1970-2100).`);
      }
      return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0).getTime();
    }
  }
  if (/T|\d{1,2}:\d{2}/.test(trimmed)) {
    throw new Error(`Date "${trimmed}" contains a time. Provide date only in YYYY-MM-DD format.`);
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso !== null) {
    const year = Number(iso[1]);
    if (year < MIN_IMPORT_YEAR || year > MAX_IMPORT_YEAR) {
      throw new Error(`Date year ${year} is outside supported range (1970-2100).`);
    }
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
    if (month <= 12 && day <= 12 && month !== day) {
      throw new Error(`Ambiguous date "${trimmed}". Specify dates in unambiguous YYYY-MM-DD format.`);
    }
    if (year < MIN_IMPORT_YEAR || year > MAX_IMPORT_YEAR) {
      throw new Error(`Date year ${year} is outside supported range (1970-2100).`);
    }
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new Error(`Invalid date "${trimmed}".`);
    }
    return date.getTime();
  }
  throw new Error(`Invalid date "${trimmed}". Use YYYY-MM-DD.`);
}

/**
 * @param {string} value
 * @returns {'CASH'|'CARD'|'EWALLET'|null}
 */
export function parseImportAccountType(value) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (normalized === "CASH" || normalized === "CASHACCOUNT") {
    return "CASH";
  }
  if (["CARD", "CREDIT", "DEBIT", "CREDITCARD", "DEBITCARD", "CARDACCOUNT"].includes(normalized)) {
    return "CARD";
  }
  if (
    normalized === "EWALLET"
    || normalized === "WALLET"
    || normalized === "DIGITALWALLET"
  ) {
    return "EWALLET";
  }
  return null;
}

export function normalizeImportAccountLabel(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function importAccountKey(value) {
  const normalized = normalizeImportAccountLabel(value).toLocaleLowerCase();
  if (normalized === "__proto__" || normalized === "constructor" || normalized === "prototype") {
    return `_${normalized}`;
  }
  return normalized;
}

/**
 * Explicit type vocabulary. A label only qualifies when it already states which side
 * of the ledger it belongs to, so no direction has to be guessed. Direction-ambiguous
 * bank words (TRANSFER, REFUND, REVERSAL, a bare ADJUSTMENT) are deliberately absent:
 * they must surface as rejected rows rather than be booked to the wrong side, which
 * would silently overstate spending or income.
 */
const INCOME_TYPE_TOKENS = [
  "INCOME",
  "IN",
  "INC",
  "+",
  "CREDIT",
  "INTEREST EARNED",
  "INCOME ADJUSTMENT",
];
const EXPENSE_TYPE_TOKENS = [
  "EXPENSE",
  "EXP",
  "-",
  "DEBIT",
  "FEE",
];

/**
 * @param {string} value
 * @returns {'EXPENSE'|'INCOME'|null}
 */
export function parseImportType(value) {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return null;
  }
  if (INCOME_TYPE_TOKENS.includes(normalized)) {
    return "INCOME";
  }
  if (EXPENSE_TYPE_TOKENS.includes(normalized)) {
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
  assertImportGridWithinLimits(grid);

  const firstRow = grid[0] ?? [];
  const headerCells = firstRow.map((cell) => String(cell ?? "").trim());
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
      assertImportRowWithinLimits(cells);

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
      const typeRaw = resolvedMappings.Type >= 0
        ? String(cells[resolvedMappings.Type] ?? "").trim()
        : "";
      const explicitType = parseImportType(typeRaw);
      if (typeRaw.length > 0 && explicitType === null) {
        throw new Error(`Type "${typeRaw}" is invalid. Use INCOME or EXPENSE.`);
      }
      /** @type {'EXPENSE'|'INCOME'} */
      let type;
      if (explicitType !== null) {
        type = explicitType;
      } else if (cleanedAmount.startsWith("+")) {
        type = "INCOME";
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

      if (resolvedMappings.Account < 0) {
        throw new Error("Account column is unmapped.");
      }
      const accountLabel = normalizeImportAccountLabel(cells[resolvedMappings.Account]);
      if (accountLabel.length === 0) {
        throw new Error("Account is empty.");
      }
      const accountType = parseImportAccountType(accountLabel);

      const noteRaw = resolvedMappings.Note >= 0
        ? String(cells[resolvedMappings.Note] ?? "").trim()
        : "";

      rows.push({
        sourceRowNumber: rowNumber,
        dateEpochMillis,
        type,
        amountMinor,
        categoryName,
        accountLabel,
        accountKey: importAccountKey(accountLabel),
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
 * PapaParse recovers from quoting problems and still returns rows, but the cell
 * boundaries in those rows are unreliable: an unterminated quote swallows the
 * following lines, so an amount can land in the note column and book as a different
 * financial effect. Any reported error therefore fails the whole read and names the
 * offending row plus the fix, instead of importing misaligned data.
 * @param {{ code?: string, row?: number, message?: string }[]} errors
 */
function csvParseFailure(errors) {
  const first = errors[0];
  const row = Number.isSafeInteger(first?.row) && first.row >= 0 ? ` at row ${first.row + 1}` : "";
  const reason = String(first?.message ?? "CSV parse failed").trim();
  return new Error(
    `Could not read the CSV${row}: ${reason}. Wrap every field containing a comma or a double quote in double quotes, then try again.`,
  );
}

/**
 * @param {string} text
 * @returns {unknown[][]}
 */
export function csvTextToGrid(text) {
  if (typeof text === "string" && text.length > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`CSV file exceeds maximum supported size of 5 MB.`);
  }
  const parsed = Papa.parse(String(text ?? "").replace(/^\uFEFF/, ""), {
    header: false,
    skipEmptyLines: "greedy",
  });
  const errors = parsed.errors ?? [];
  if (errors.length > 0) {
    throw csvParseFailure(errors);
  }
  return (parsed.data ?? []).map((row) => (Array.isArray(row) ? row : []));
}

/**
 * @param {string | ArrayBuffer | Uint8Array} input base64 string, ArrayBuffer, or bytes
 * @param {'base64'|'array'|'buffer'} [type]
 * @returns {unknown[][]}
 */
export function xlsxToGrid(input, type = "base64") {
  if (typeof input === "string") {
    const estimatedBytes = Math.ceil((input.length * 3) / 4);
    if (estimatedBytes > MAX_IMPORT_FILE_BYTES) {
      throw new Error(`Excel file exceeds maximum supported size of 5 MB.`);
    }
  } else if (input && typeof input.byteLength === "number") {
    if (input.byteLength > MAX_IMPORT_FILE_BYTES) {
      throw new Error(`Excel file exceeds maximum supported size of 5 MB.`);
    }
  }
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
