import { BACKUP_FORMAT, buildBackup, buildTransactionsCsv, parseBackup, parseTransactionsCsv, serializeBackup, } from "../src/services/dataTransfer";
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
    },
];
describe("dataTransfer", () => {
    it("round-trips a MoneyMap backup payload", () => {
        const backup = buildBackup({
            accounts,
            categories,
            transactions,
            budgets: [],
            recurringRules: [],
        });
        expect(backup.format).toBe(BACKUP_FORMAT);
        const restored = parseBackup(serializeBackup(backup));
        expect(restored.transactions).toHaveLength(1);
        expect(restored.accounts[0]?.name).toBe("Cash");
    });
    it("builds and parses transaction CSV with quoted notes", () => {
        const csv = buildTransactionsCsv(transactions, new Map(categories.map((category) => [category.id, category])), new Map(accounts.map((account) => [account.id, account])));
        expect(csv).toContain("date,type,amount,category,account,note");
        expect(csv).toContain("Lunch, campus");
        const rows = parseTransactionsCsv(csv);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.amountMinor).toBe(15_000);
        expect(rows[0]?.categoryName).toBe("Food");
        expect(rows[0]?.accountType).toBe("CASH");
        expect(rows[0]?.note).toBe("Lunch, campus");
    });
    it("rejects unknown backup formats", () => {
        expect(() => parseBackup(JSON.stringify({ format: "other", version: 1 }))).toThrow(/not a MoneyMap backup/);
    });
});
