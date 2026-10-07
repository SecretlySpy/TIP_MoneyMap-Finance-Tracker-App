import { MAX_CELL_LENGTH, MAX_IMPORT_ROWS } from "../src/domain/services/importParser";
import { BACKUP_FORMAT, BACKUP_VERSION, buildBackup, buildTransactionsCsv, parseBackup, parsePastedTransactionsCsv, parseTransactionsCsv, serializeBackup, } from "../src/services/dataTransfer";
const accounts = [
    { id: 1, name: "Cash", type: "CASH", startingBalanceMinor: 0, isArchived: false },
];
const categories = [
    { id: 10, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false },
];
const transactions = [
    {
        id: 1,
        amountMinor: 15_000,
        type: "EXPENSE",
        categoryId: 10,
        accountId: 1,
        dateEpochMillis: new Date(2026, 7, 1, 12).getTime(),
        note: "Lunch, campus",
        recurringRuleId: null,
        sourceKey: "manual:v1:backup-roundtrip",
    },
];
describe("dataTransfer", () => {
    it("round-trips a MoneyMap backup payload", () => {
        const accountsWithCard = [
            ...accounts,
            { id: 2, name: "Card", type: "CARD", startingBalanceMinor: -50_000, isArchived: false },
        ];
        const backup = buildBackup({
            accounts: accountsWithCard,
            categories,
            transactions,
            transfers: [{
                id: 1,
                amountMinor: 10_000,
                fromAccountId: 1,
                toAccountId: 2,
                dateEpochMillis: new Date(2026, 7, 2, 12).getTime(),
                note: "Card payment",
                sourceKey: "manual-transfer:v1:backup-roundtrip",
            }],
            budgets: [],
            recurringRules: [],
        });
        expect(backup.format).toBe(BACKUP_FORMAT);
        expect(backup.version).toBe(BACKUP_VERSION);
        const restored = parseBackup(serializeBackup(backup));
        expect(restored.transactions).toHaveLength(1);
        expect(restored.transfers).toEqual([expect.objectContaining({ amountMinor: 10_000, toAccountId: 2 })]);
        expect(restored.transactions[0]?.sourceKey).toBe("manual:v1:backup-roundtrip");
        expect(restored.accounts[0]?.name).toBe("Cash");
    });
    it("upgrades a legacy v2 backup by adding an empty transfer collection", () => {
        const legacy = buildBackup({
            accounts,
            categories,
            transactions,
            budgets: [],
            recurringRules: [],
        });
        legacy.version = 2;
        delete legacy.transfers;
        expect(parseBackup(serializeBackup(legacy))).toMatchObject({
            version: BACKUP_VERSION,
            transfers: [],
        });
    });
    it("builds and parses transaction CSV with quoted notes", () => {
        const csv = buildTransactionsCsv(transactions, new Map(categories.map((category) => [category.id, category])), new Map(accounts.map((account) => [account.id, account])));
        expect(csv).toContain("date,type,amount,category,account,note");
        expect(csv).toContain("Lunch, campus");
        const rows = parseTransactionsCsv(csv);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.amountMinor).toBe(15_000);
        expect(rows[0]?.categoryName).toBe("Food");
        expect(rows[0]?.accountLabel).toBe("Cash");
        expect(rows[0]?.accountType).toBe("CASH");
        expect(rows[0]?.note).toBe("Lunch, campus");
    });
    it("rejects unknown backup formats", () => {
        expect(() => parseBackup(JSON.stringify({ format: "other", version: 1 }))).toThrow(/not a MoneyMap backup/);
    });
    it("exports a named account without collapsing it to its generic type", () => {
        const namedAccounts = [
            ...accounts,
            { id: 2, name: "GCash", type: "EWALLET", startingBalanceMinor: 0, isArchived: false },
        ];
        const csv = buildTransactionsCsv(
            [{ ...transactions[0], accountId: 2 }],
            new Map(categories.map((category) => [category.id, category])),
            new Map(namedAccounts.map((account) => [account.id, account])),
        );
        const [row] = parseTransactionsCsv(csv);
        expect(csv).toContain(",GCash,");
        expect(row.accountLabel).toBe("GCash");
        expect(row.accountType).toBeNull();
    });
    it("round-trips quoted multiline notes through pasted CSV parsing", () => {
        const csv = buildTransactionsCsv(
            [{ ...transactions[0], note: "First line\nSecond line" }],
            new Map(categories.map((category) => [category.id, category])),
            new Map(accounts.map((account) => [account.id, account])),
        );
        const [row] = parseTransactionsCsv(csv);
        expect(row.note).toBe("First line\nSecond line");
        expect(row.sourceRowNumber).toBe(2);
    });
    it("rejects duplicate transaction source keys before restore replacement", () => {
        const backup = buildBackup({
            accounts,
            categories,
            transactions: [transactions[0], { ...transactions[0], id: 2 }],
            budgets: [],
            recurringRules: [],
        });
        expect(() => parseBackup(serializeBackup(backup))).toThrow("duplicate source keys");
    });
    it("rejects invalid or duplicate transfer effects before restore replacement", () => {
        const accountsWithCard = [
            ...accounts,
            { id: 2, name: "Card", type: "CARD", startingBalanceMinor: 0, isArchived: false },
        ];
        const transfer = {
            id: 1,
            amountMinor: 10_000,
            fromAccountId: 1,
            toAccountId: 2,
            dateEpochMillis: new Date(2026, 7, 2, 12).getTime(),
            note: null,
            sourceKey: "manual-transfer:v1:duplicate",
        };
        const backup = buildBackup({
            accounts: accountsWithCard,
            categories,
            transactions,
            transfers: [transfer, { ...transfer, id: 2 }],
            budgets: [],
            recurringRules: [],
        });
        expect(() => parseBackup(serializeBackup(backup))).toThrow("duplicate source keys");
        expect(() => parseBackup(serializeBackup({
            ...backup,
            transfers: [{ ...transfer, toAccountId: 1 }],
        }))).toThrow("two different accounts");
    });
    it("rejects invalid enum and format fields before a restore transaction", () => {
        const backup = buildBackup({
            accounts,
            categories,
            transactions,
            budgets: [{ id: 1, categoryId: 10, monthYear: "2026-08", limitMinor: 100 }],
            recurringRules: [],
        });
        const cases = [
            [{ ...backup, accounts: [{ ...accounts[0], type: "BANK" }] }, /invalid account type/i],
            [{ ...backup, categories: [{ ...categories[0], colorHex: "red" }] }, /invalid category color/i],
            [{ ...backup, transactions: [{ ...transactions[0], note: 42 }] }, /invalid transaction note/i],
            [{ ...backup, budgets: [{ ...backup.budgets[0], monthYear: "2026-13" }] }, /invalid budget month/i],
        ];
        for (const [candidate, reason] of cases) {
            expect(() => parseBackup(serializeBackup(candidate))).toThrow(reason);
        }
    });
});
describe("pasted CSV parsing limits and skip reporting", () => {
    const header = "date,type,amount,category,account,note";
    it("keeps valid rows and reports each invalid row with its reason", () => {
        const csv = [
            header,
            "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch",
            "2026-08-02,TRANSFER,20.00,Food,Cash,ambiguous type",
            "2026-08-03,EXPENSE,,Food,Cash,missing amount",
            "2026-08-04,EXPENSE,20.00,Food,,missing account",
            "2026-13-45,EXPENSE,20.00,Food,Cash,bad date",
            "2026-08-05,EXPENSE,0,Food,Cash,zero amount",
            `2026-08-06,EXPENSE,20.00,Food,Cash,${"x".repeat(MAX_CELL_LENGTH + 1)}`,
            "2026-08-07,INTEREST EARNED,75.00,Allowance,Cash,bank interest",
        ].join("\n");

        const result = parsePastedTransactionsCsv(csv);
        expect(result.dataRowCount).toBe(8);
        expect(result.rows.map(({ dateEpochMillis }) => dateEpochMillis)).toEqual([
            new Date(2026, 7, 1, 12).getTime(),
            new Date(2026, 7, 7, 12).getTime(),
        ]);
        expect(result.rows[1]).toMatchObject({ type: "INCOME", amountMinor: 7_500 });
        // Row 3 is the ambiguous type; every invalid row is named, never silently dropped.
        expect(result.skipped.map(({ rowNumber }) => rowNumber)).toEqual([3, 4, 5, 6, 7, 8]);
        expect(result.skipped[0]?.reason).toMatch(/invalid type "TRANSFER"/i);
        expect(result.skipped.map(({ reason }) => reason).join(" ")).toMatch(/missing an amount/);
        expect(result.skipped.map(({ reason }) => reason).join(" ")).toMatch(/missing an account/);
        expect(result.skipped.map(({ reason }) => reason).join(" ")).toMatch(/invalid date "2026-13-45"/);
        expect(result.skipped.map(({ reason }) => reason).join(" ")).toMatch(/must be positive/);
        expect(result.skipped.map(({ reason }) => reason).join(" ")).toMatch(new RegExp(`Cell content exceeds maximum length of ${MAX_CELL_LENGTH} characters`));
    });
    it("reports the resolved column positions so an idempotency key matches the real layout", () => {
        const reordered = "date,amount,type,category,account,note\n2026-08-01,150.00,EXPENSE,Food,Cash,";
        expect(parsePastedTransactionsCsv(reordered).mappings).toEqual({
            Account: 4,
            Amount: 1,
            Category: 3,
            Date: 0,
            Note: 5,
            Type: 2,
        });
        expect(parsePastedTransactionsCsv(reordered).rows[0]?.amountMinor).toBe(15_000);
    });
    it("rejects a paste larger than the row ceiling instead of importing it", () => {
        const oversized = new Array(MAX_IMPORT_ROWS + 1)
            .fill("2026-08-01,EXPENSE,10.00,Food,Cash,")
            .join("\n");
        expect(() => parsePastedTransactionsCsv(oversized)).toThrow("Pasted CSV exceeds maximum allowed rows (10,000).");
    });
    it("keeps the strict array contract by rejecting the whole paste when any row is invalid", () => {
        const csv = [header, "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch", "2026-08-02,TRANSFER,20.00,Food,Cash,x"].join("\n");
        expect(() => parseTransactionsCsv(csv)).toThrow('CSV row 3: invalid type "TRANSFER". Use INCOME or EXPENSE.');
    });
    it("still returns a plain array of rows for a fully valid paste", () => {
        const csv = [header, "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch"].join("\n");
        const rows = parseTransactionsCsv(csv);
        expect(Array.isArray(rows)).toBe(true);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ amountMinor: 15_000, sourceRowNumber: 2 });
    });
});
