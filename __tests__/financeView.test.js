import { budgetStateFor, buildBudgetCards, buildRecurringBills, buildUiTransaction, computeDashboardTotals, formatMonthChip, groupHistory, nextReminderPreview, shiftMonthYear, spendingByCategory, toMonthYear, } from "../src/domain/services/financeView";
const accounts = [
    { id: 1, name: "Cash", type: "CASH", startingBalanceMinor: 100_000, isArchived: false },
    { id: 2, name: "Card", type: "CARD", startingBalanceMinor: 0, isArchived: false },
];
const categories = [
    { id: 10, name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE", isCustom: false },
    { id: 11, name: "Transport", icon: "bus", colorHex: "#2563EB", type: "EXPENSE", isCustom: false },
    { id: 20, name: "Salary", icon: "cash", colorHex: "#15803D", type: "INCOME", isCustom: false },
];
const categoriesById = new Map(categories.map((category) => [category.id, category]));
const accountsById = new Map(accounts.map((account) => [account.id, account]));
function tx(partial) {
    return {
        accountId: 1,
        note: null,
        recurringRuleId: null,
        ...partial,
    };
}
describe("financeView", () => {
    it("formats and shifts month-year keys", () => {
        expect(toMonthYear(new Date(2026, 6, 16))).toBe("2026-07");
        expect(formatMonthChip("2026-07")).toBe("Jul 2026");
        expect(shiftMonthYear("2026-07", -1)).toBe("2026-06");
        expect(shiftMonthYear("2026-01", -1)).toBe("2025-12");
        expect(shiftMonthYear("2026-12", 1)).toBe("2027-01");
    });
    it("computes lifetime balance with month income/expense", () => {
        const transactions = [
            tx({ id: 1, amountMinor: 500_000, type: "INCOME", categoryId: 20, dateEpochMillis: new Date(2026, 6, 1).getTime() }),
            tx({ id: 2, amountMinor: 50_000, type: "EXPENSE", categoryId: 10, dateEpochMillis: new Date(2026, 6, 2).getTime() }),
            tx({ id: 3, amountMinor: 20_000, type: "EXPENSE", categoryId: 11, dateEpochMillis: new Date(2026, 5, 2).getTime() }),
        ];
        const totals = computeDashboardTotals(accounts, transactions, "2026-07");
        expect(totals.balanceMinor).toBe(100_000 + 500_000 - 50_000 - 20_000);
        expect(totals.incomeMinor).toBe(500_000);
        expect(totals.expenseMinor).toBe(50_000);
    });
    it("builds UI transactions and history groups", () => {
        const lunch = tx({
            id: 9,
            amountMinor: 18_500,
            type: "EXPENSE",
            categoryId: 10,
            dateEpochMillis: new Date(2026, 6, 16, 12).getTime(),
            note: "Lunch — Jollibee",
        });
        const ui = buildUiTransaction(lunch, categoriesById, accountsById);
        expect(ui.title).toBe("Lunch — Jollibee");
        expect(ui.meta).toBe("Food · Cash");
        expect(ui.emoji).toBe("🍜");
        const groups = groupHistory([lunch], categoriesById, accountsById, "2026-07", new Date(2026, 6, 16));
        expect(groups).toHaveLength(1);
        expect(groups[0]?.label.startsWith("Today")).toBe(true);
        expect(groups[0]?.transactions).toHaveLength(1);
    });
    it("aggregates spending segments and budget cards", () => {
        const transactions = [
            tx({ id: 1, amountMinor: 80_000, type: "EXPENSE", categoryId: 10, dateEpochMillis: new Date(2026, 6, 3).getTime() }),
            tx({ id: 2, amountMinor: 20_000, type: "EXPENSE", categoryId: 11, dateEpochMillis: new Date(2026, 6, 4).getTime() }),
        ];
        const spending = spendingByCategory(transactions, categoriesById, "2026-07");
        expect(spending.totalMinor).toBe(100_000);
        expect(spending.segments[0]?.label).toBe("Food");
        expect(spending.segments.reduce((sum, segment) => sum + segment.percent, 0)).toBe(100);
        const budgets = [
            { id: 1, categoryId: 10, monthYear: "2026-07", limitMinor: 100_000 },
            { id: 2, categoryId: 11, monthYear: "2026-07", limitMinor: 10_000 },
        ];
        const cards = buildBudgetCards(budgets, transactions, categoriesById, "2026-07");
        expect(cards).toHaveLength(2);
        expect(budgetStateFor(80)).toBe("warning");
        expect(budgetStateFor(100)).toBe("over");
        expect(cards.find((card) => card.name === "Transport")?.state).toBe("over");
    });
    it("builds recurring bill previews", () => {
        const rules = [
            {
                id: 1,
                amountMinor: 100_000,
                type: "EXPENSE",
                categoryId: 10,
                accountId: 1,
                note: "Internet",
                frequency: "MONTHLY",
                nextRunEpochMillis: new Date(2026, 6, 26).getTime(),
                isActive: true,
                reminderEnabled: true,
                reminderLeadDays: 10,
            },
        ];
        const bills = buildRecurringBills(rules, categoriesById);
        expect(bills[0]?.name).toBe("Internet");
        expect(bills[0]?.due).toBe("Jul 26");
        const preview = nextReminderPreview(bills);
        expect(preview?.title).toContain("Internet");
        expect(preview?.dailyMinor).toBe(10_000);
    });
});
