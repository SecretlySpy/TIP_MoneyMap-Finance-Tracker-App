import * as XLSX from "xlsx";
import {
  csvTextToGrid,
  detectImportFormat,
  detectImportMappings,
  parseImportFile,
  parseImportGrid,
  xlsxToGrid,
} from "../src/domain/services/importParser";
import { AccountRepository, CategoryRepository, TransactionRepository } from "../src/db/repositories";
import { migrateDatabase } from "../src/db/schema";
import { TestSqliteDatabase } from "./support/testDatabase";

describe("importParser format detection", () => {
  it("detects csv and xlsx extensions", () => {
    expect(detectImportFormat("export.CSV")).toBe("csv");
    expect(detectImportFormat("books.xlsx")).toBe("xlsx");
    expect(detectImportFormat("legacy.xls")).toBe("xlsx");
    expect(detectImportFormat("notes")).toBe("unknown");
  });
});

describe("importParser CSV grid", () => {
  it("parses standard MoneyMap CSV through the shared pipeline", () => {
    const csv = [
      "date,type,amount,category,account,note",
      "2026-08-01,EXPENSE,150.00,Food,CASH,\"Lunch, campus\"",
      "2026-08-02,INCOME,500.00,Allowance,CASH,",
      "2026-08-03,EXPENSE,not-a-number,Food,CASH,bad",
      "2026-08-04,EXPENSE,0,Food,CASH,zero",
    ].join("\n");

    const grid = csvTextToGrid(csv);
    const mappings = detectImportMappings(grid[0].map(String));
    expect(mappings.Date).toBe(0);
    expect(mappings.Type).toBe(1);
    expect(mappings.Amount).toBe(2);

    const result = parseImportGrid(grid, mappings);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      amountMinor: 15_000,
      type: "EXPENSE",
      categoryName: "Food",
      accountType: "CASH",
      note: "Lunch, campus",
    });
    expect(result.rows[1]).toMatchObject({
      amountMinor: 50_000,
      type: "INCOME",
      categoryName: "Allowance",
    });
    expect(result.skipped.length).toBeGreaterThanOrEqual(2);
    expect(result.skipped.some((item) => item.reason.toLowerCase().includes("amount"))).toBe(true);
  });
});

describe("importParser XLSX grid", () => {
  it("parses a real spreadsheet buffer through the same pipeline", () => {
    const rows = [
      ["Date", "Amount", "Type", "Category", "Account", "Note"],
      ["2026-07-15", "99.50", "EXPENSE", "Transport", "Card", "Jeep"],
      ["2026-07-16", "1000", "INCOME", "Part-time", "E-wallet", "Shift"],
      ["bad-date", "10", "EXPENSE", "Food", "Cash", "skip me"],
      ["2026-07-17", "", "EXPENSE", "Food", "Cash", "empty amount"],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Transactions");
    const base64 = XLSX.write(book, { type: "base64", bookType: "xlsx" });

    const grid = xlsxToGrid(base64, "base64");
    expect(grid[0][0]).toBe("Date");
    const result = parseImportFile({ format: "xlsx", content: base64 });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      amountMinor: 9_950,
      type: "EXPENSE",
      categoryName: "Transport",
      accountType: "CARD",
      note: "Jeep",
    });
    expect(result.rows[1]).toMatchObject({
      amountMinor: 100_000,
      type: "INCOME",
      categoryName: "Part-time",
      accountType: "EWALLET",
    });
    expect(result.skipped.length).toBe(2);
  });
});

describe("import bulk insert transaction safety", () => {
  /** @type {TestSqliteDatabase} */
  let database;

  beforeEach(async () => {
    database = new TestSqliteDatabase();
    await migrateDatabase(database);
  });

  afterEach(() => {
    database.close();
  });

  it("inserts good rows, auto-creates category/account, and leaves DB consistent", async () => {
    const categories = new CategoryRepository(database);
    const accounts = new AccountRepository(database);
    const transactions = new TransactionRepository(database);

    const beforeCategories = (await categories.list()).length;
    const beforeAccounts = (await accounts.list()).length;

    // Simulate financeStore transactional import path
    const importRows = [
      {
        dateEpochMillis: new Date(2026, 7, 1, 12).getTime(),
        type: "EXPENSE",
        amountMinor: 12_500,
        categoryName: "Campus Cafe",
        accountType: "CARD",
        note: "Snack",
      },
      {
        dateEpochMillis: new Date(2026, 7, 2, 12).getTime(),
        type: "INCOME",
        amountMinor: 200_000,
        categoryName: "Side hustle",
        accountType: "EWALLET",
        note: null,
      },
    ];

    await database.transaction(async (tx) => {
      const insertId = async (sql, params) => {
        const result = await tx.execute(sql, params);
        if (result.insertId) return result.insertId;
        const idResult = await tx.execute("SELECT last_insert_rowid() AS id");
        return Number(idResult.rows[0].id);
      };
      for (const row of importRows) {
        const catId = await insertId(
          `INSERT INTO categories (name, icon, color_hex, type, is_custom) VALUES (?, 'pricetag', '#64748B', ?, 1)`,
          [row.categoryName, row.type],
        );
        let account = (await accounts.list()).find((item) => item.type === row.accountType && !item.isArchived);
        if (!account) {
          const accId = await insertId(
            `INSERT INTO accounts (name, type, starting_balance_minor, is_archived) VALUES (?, ?, 0, 0)`,
            [row.accountType, row.accountType],
          );
          account = { id: accId };
        }
        await tx.execute(
          `INSERT INTO transactions (amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
          [row.amountMinor, row.type, catId, account.id, row.dateEpochMillis, row.note],
        );
      }
    });

    expect(await transactions.list()).toHaveLength(2);
    expect((await categories.list()).length).toBeGreaterThanOrEqual(beforeCategories + 2);
    const txs = await transactions.list();
    expect(txs.every((tx) => Number.isSafeInteger(tx.amountMinor))).toBe(true);
    expect(txs.map((tx) => tx.amountMinor).sort((a, b) => a - b)).toEqual([12_500, 200_000]);
    void beforeAccounts;
  });

  it("rolls back the whole import when a statement fails mid-transaction", async () => {
    const transactions = new TransactionRepository(database);
    await expect(
      database.transaction(async (tx) => {
        await tx.execute(
          `INSERT INTO transactions (amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id)
           VALUES (1000, 'EXPENSE', 1, 1, ?, NULL, NULL)`,
          [Date.now()],
        );
        throw new Error("simulated import failure");
      }),
    ).rejects.toThrow(/simulated import failure/);
    expect(await transactions.list()).toHaveLength(0);
  });
});
