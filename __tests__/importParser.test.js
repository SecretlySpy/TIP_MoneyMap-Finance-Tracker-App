import * as XLSX from "xlsx";
import {
  assertImportGridWithinLimits,
  csvTextToGrid,
  detectImportFormat,
  detectImportMappings,
  MAX_CELL_LENGTH,
  MAX_IMPORT_ROWS,
  parseImportFile,
  parseImportGrid,
  parseImportAccountType,
  parseImportType,
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
      accountLabel: "CASH",
      accountKey: "cash",
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

describe("importParser type vocabulary", () => {
  it("accepts labels that already state which side of the ledger they belong to", () => {
    for (const label of ["INCOME", "in", "INC", "+", "CREDIT", "INTEREST EARNED", "Interest  Earned", "income adjustment"]) {
      expect(parseImportType(label)).toBe("INCOME");
    }
    for (const label of ["EXPENSE", "exp", "-", "DEBIT", "fee"]) {
      expect(parseImportType(label)).toBe("EXPENSE");
    }
  });

  it("refuses direction-ambiguous labels rather than guessing a direction", () => {
    // Booking these either way would silently overstate spending or income.
    for (const label of ["TRANSFER", "Transfer In", "Transfer Sent", "REFUND", "REVERSAL", "ADJUSTMENT", "CASHBACK", "PAYMENT", "WITHDRAWAL", "INTEREST", "PENDING", ""]) {
      expect(parseImportType(label)).toBeNull();
    }
  });

  it("reports an unknown type as a skipped row instead of a silent default", () => {
    const result = parseImportGrid([
      ["Date", "Amount", "Type", "Category", "Account"],
      ["2026-08-01", "100", "TRANSFER", "Other", "Cash"],
      ["2026-08-02", "250", "EXPENSE", "Food", "Cash"],
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ amountMinor: 25_000, type: "EXPENSE" });
    expect(result.skipped).toEqual([{ rowNumber: 2, reason: 'Type "TRANSFER" is invalid. Use INCOME or EXPENSE.' }]);
  });

  it("books the accepted vocabulary to the matching transaction type", () => {
    const result = parseImportGrid([
      ["Date", "Amount", "Type", "Category", "Account"],
      ["2026-08-01", "100", "Interest Earned", "Allowance", "Cash"],
      ["2026-08-02", "40", "Fee", "Other", "Cash"],
    ]);

    expect(result.skipped).toEqual([]);
    expect(result.rows.map(({ type }) => type)).toEqual(["INCOME", "EXPENSE"]);
  });
});

describe("importParser malformed CSV handling", () => {
  it("fails closed on an unterminated quote and names the row to fix", () => {
    const csv = [
      "date,type,amount,category,account,note",
      "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch",
      '2026-08-02,EXPENSE,20.00,Food,Cash,"never closed',
      "2026-08-03,EXPENSE,30.00,Food,Cash,Coffee",
    ].join("\n");

    expect(() => csvTextToGrid(csv)).toThrow(/Could not read the CSV at row 3/);
    expect(() => csvTextToGrid(csv)).toThrow(/double quotes/);
  });

  it("fails closed on a malformed trailing quote instead of importing misaligned cells", () => {
    // PapaParse still returns rows here, so trusting them would shift values between columns.
    const csv = ["date,type,amount,category,account,note", '2026-08-01,EXPENSE,150.00,Food,Cash,"x"y"'].join("\n");

    expect(() => csvTextToGrid(csv)).toThrow(/Could not read the CSV/);
  });

  it("rejects a whole grid that exceeds the row or column ceilings", () => {
    expect(() => assertImportGridWithinLimits(
      new Array(MAX_IMPORT_ROWS + 1).fill(["2026-08-01", "EXPENSE", "10", "Food", "Cash"]),
      "Pasted CSV",
    )).toThrow("Pasted CSV exceeds maximum allowed rows (10,000).");
    expect(() => assertImportGridWithinLimits([new Array(101).fill("x")], "Pasted CSV"))
      .toThrow("Pasted CSV exceeds maximum allowed columns (100).");
  });

  it("skips an oversized cell as one row instead of failing the file", () => {
    const result = parseImportGrid([
      ["Date", "Amount", "Type", "Category", "Account", "Note"],
      ["2026-08-01", "150.00", "EXPENSE", "Food", "Cash", "x".repeat(MAX_CELL_LENGTH + 1)],
      ["2026-08-02", "20.00", "EXPENSE", "Food", "Cash", "ok"],
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.amountMinor).toBe(2_000);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toMatch(new RegExp(`Cell content exceeds maximum length of ${MAX_CELL_LENGTH} characters`));
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
      accountLabel: "Card",
      accountType: "CARD",
      note: "Jeep",
    });
    expect(result.rows[1]).toMatchObject({
      amountMinor: 100_000,
      type: "INCOME",
      categoryName: "Part-time",
      accountLabel: "E-wallet",
      accountType: "EWALLET",
    });
    expect(result.skipped.length).toBe(2);
  });

  it("preserves named accounts instead of silently coercing them to Cash", () => {
    const result = parseImportGrid([
      ["Date", "Amount", "Type", "Category", "Account"],
      ["2026-08-01", "100", "EXPENSE", "Food", "GCash"],
      ["2026-08-02", "200", "EXPENSE", "School", "BPI Savings"],
    ]);

    expect(result.rows.map((row) => row.accountLabel)).toEqual(["GCash", "BPI Savings"]);
    expect(result.rows.map((row) => row.accountType)).toEqual([null, null]);
    expect(parseImportAccountType("mystery account")).toBeNull();
  });

  it("rejects rows until the account column is mapped", () => {
    const result = parseImportGrid(
      [["Date", "Amount"], ["2026-08-01", "100"]],
      { Date: 0, Amount: 1, Type: -1, Category: -1, Account: -1, Note: -1 },
    );

    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0]?.reason).toMatch(/Account column is unmapped/);
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
      const transactionAccounts = new AccountRepository(tx);
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
        // All work inside the transaction must use its scoped executor. Reaching
        // through the outer database would correctly wait for this transaction
        // and deadlock the test instead of joining the open write implicitly.
        let account = (await transactionAccounts.list()).find((item) => item.type === row.accountType && !item.isArchived);
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
