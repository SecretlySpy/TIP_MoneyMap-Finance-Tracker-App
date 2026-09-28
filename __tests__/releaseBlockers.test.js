import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as FileSystem from "expo-file-system/legacy";
import { Share } from "react-native";
import {
  csvTextToGrid,
  detectImportMappings,
  importAccountKey,
  MAX_CELL_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  parseImportDate,
  parseImportGrid,
  xlsxToGrid,
} from "../src/domain/services/importParser";
import { buildTransactionsCsv, sanitizeForSpreadsheet, shareDocument } from "../src/services/dataTransfer";
import { deriveSmartTips } from "../src/domain/services/tips";
import { getGeminiApiKey } from "../src/remote/smartTipsClient";

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///mock/cache/",
  documentDirectory: "file:///mock/documents/",
  EncodingType: { UTF8: "utf8" },
  writeAsStringAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

describe("Release Blockers: Credential exclusion, bounded parsing, spreadsheet safety, and backup cleanup", () => {
  const root = join(__dirname, "..");

  describe("1. Client-bundled online AI credentials", () => {
    it("never bundles geminiApiKey in app.config.js extra", () => {
      const appConfigContent = readFileSync(join(root, "app.config.js"), "utf8");
      expect(appConfigContent).not.toMatch(/geminiApiKey\s*:\s*process\.env/);
      expect(appConfigContent).not.toContain("geminiApiKey");
    });

    it("getGeminiApiKey returns empty string when no key is explicitly configured", () => {
      expect(getGeminiApiKey()).toBe("");
    });

    it("retains offline Smart Tips without needing any remote API key", () => {
      const snapshot = deriveSmartTips({
        accounts: [{ id: 1, name: "Cash", startingBalanceMinor: 50_000, type: "CASH", isArchived: false }],
        transactions: [
          { id: 1, amountMinor: 10_000, type: "EXPENSE", categoryId: 1, accountId: 1, dateEpochMillis: Date.now() },
        ],
        budgets: [{ id: 1, categoryId: 1, limitMinor: 20_000, monthYear: "2026-09" }],
        categories: [{ id: 1, name: "Food", type: "EXPENSE", icon: "restaurant" }],
        monthYear: "2026-09",
      });
      expect(Array.isArray(snapshot.tips)).toBe(true);
      expect(snapshot.tips.length).toBeGreaterThan(0);
      expect(snapshot.tips[0]).toHaveProperty("title");
      expect(snapshot.tips[0]).toHaveProperty("meta");
    });
  });

  describe("2. Bounded and validated CSV/XLSX parsing", () => {
    it("rejects CSV content exceeding maximum size limit (5 MB)", () => {
      const oversizedCsv = "a".repeat(MAX_IMPORT_FILE_BYTES + 1);
      expect(() => csvTextToGrid(oversizedCsv)).toThrow(/exceeds maximum supported size of 5 MB/);
    });

    it("rejects Excel content exceeding maximum size limit (5 MB)", () => {
      const oversizedBuffer = new ArrayBuffer(MAX_IMPORT_FILE_BYTES + 10);
      expect(() => xlsxToGrid(oversizedBuffer, "buffer")).toThrow(/exceeds maximum supported size of 5 MB/);
    });

    it("rejects grids with rows exceeding MAX_IMPORT_ROWS (10,000)", () => {
      const hugeGrid = new Array(MAX_IMPORT_ROWS + 1).fill(["2026-09-01", "100", "EXPENSE", "Food", "Cash"]);
      expect(() => parseImportGrid(hugeGrid)).toThrow(/exceeds maximum allowed rows/);
    });

    it("rejects grids with columns exceeding MAX_IMPORT_COLUMNS (100)", () => {
      const wideRow = new Array(MAX_IMPORT_COLUMNS + 1).fill("col");
      const grid = [wideRow, wideRow];
      expect(() => parseImportGrid(grid)).toThrow(/exceeds maximum allowed columns/);
    });

    it("skips and reports rows containing oversized cell (>1,000 characters)", () => {
      const longCell = "A".repeat(MAX_CELL_LENGTH + 50);
      const grid = [
        ["Date", "Amount", "Type", "Category", "Account", "Note"],
        ["2026-09-01", "100", "EXPENSE", "Food", "Cash", longCell],
        ["2026-09-02", "200", "EXPENSE", "Food", "Cash", "Normal note"],
      ];
      const result = parseImportGrid(grid);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].note).toBe("Normal note");
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toMatch(/Cell content exceeds maximum length of 1,?000 characters/);
    });

    it("rejects dates outside the supported year range (1970–2100)", () => {
      expect(() => parseImportDate("1850-01-01")).toThrow(/outside supported range/);
      expect(() => parseImportDate("2150-12-31")).toThrow(/outside supported range/);
      expect(parseImportDate("2026-09-15")).toBeGreaterThan(0);
    });

    it("neutralizes prototype pollution strings in import account keys", () => {
      expect(importAccountKey("__proto__")).toBe("___proto__");
      expect(importAccountKey("constructor")).toBe("_constructor");
      expect(importAccountKey("prototype")).toBe("_prototype");
      expect(importAccountKey("GCash Savings")).toBe("gcash savings");
    });
  });

  describe("3. Spreadsheet-safe CSV export (Formula injection protection)", () => {
    it("neutralizes formula injection triggers (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeForSpreadsheet("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
      expect(sanitizeForSpreadsheet("+12345")).toBe("'+12345");
      expect(sanitizeForSpreadsheet("-SUM(A1:A10)")).toBe("'-SUM(A1:A10)");
      expect(sanitizeForSpreadsheet("@SUM(B1:B5)")).toBe("'@SUM(B1:B5)");
      expect(sanitizeForSpreadsheet("\tTAB")).toBe("'\tTAB");
      expect(sanitizeForSpreadsheet("\rRETURN")).toBe("'\rRETURN");
      expect(sanitizeForSpreadsheet("Lunch with friends")).toBe("Lunch with friends");
    });

    it("neutralizes formula injection inside buildTransactionsCsv", () => {
      const categoriesById = new Map([[1, { name: "=MALICIOUS_CATEGORY" }]]);
      const accountsById = new Map([[1, { name: "=MALICIOUS_ACCOUNT" }]]);
      const csv = buildTransactionsCsv(
        [
          {
            dateEpochMillis: new Date(2026, 8, 1, 12).getTime(),
            type: "EXPENSE",
            amountMinor: 5_000,
            categoryId: 1,
            accountId: 1,
            note: "=cmd|'/C calc'!A0",
          },
        ],
        categoriesById,
        accountsById,
      );
      expect(csv).toContain("'=cmd|'/C calc'!A0");
      expect(csv).toContain("'=MALICIOUS_ACCOUNT");
      expect(csv).toContain("'=MALICIOUS_CATEGORY");
      expect(csv).not.toMatch(/,"=cmd/);
    });
  });

  describe("4. Plaintext backup sharing and temporary file cleanup", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    });

    it("deletes temporary exported document files after sharing", async () => {
      const content = JSON.stringify({ version: 1, accounts: [] });
      await shareDocument("Backup Title", "MoneyMap-Backup-Test.json", content);

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      expect(Share.share).toHaveBeenCalled();
      // Verifies cleanup in finally block
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining("MoneyMap-Backup-Test.json"),
        { idempotent: true },
      );
    });

    it("cleans up temporary file even if sharing throws an error", async () => {
      jest.spyOn(Share, "share").mockRejectedValueOnce(new Error("Share dismissed"));
      await expect(
        shareDocument("Backup Title", "MoneyMap-Failed-Share.csv", "date,amount"),
      ).rejects.toThrow("Share dismissed");

      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining("MoneyMap-Failed-Share.csv"),
        { idempotent: true },
      );
    });
  });
});
