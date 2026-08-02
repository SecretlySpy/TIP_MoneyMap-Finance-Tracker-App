import { AccountRepository, BudgetRepository, CategoryRepository, RecurringRepository, TransactionRepository, } from "../src/db/repositories";
import { migrateDatabase } from "../src/db/schema";
import { TestSqliteDatabase } from "./support/testDatabase";
describe("five-table repository CRUD contracts", () => {
    let database;
    let accounts;
    let budgets;
    let categories;
    let recurringRules;
    let transactions;
    beforeEach(async () => {
        database = new TestSqliteDatabase();
        await migrateDatabase(database);
        accounts = new AccountRepository(database);
        budgets = new BudgetRepository(database);
        categories = new CategoryRepository(database);
        recurringRules = new RecurringRepository(database);
        transactions = new TransactionRepository(database);
    });
    afterEach(() => {
        database.close();
    });
    test("creates, reads, updates, lists, and deletes an account", async () => {
        const created = await accounts.create({
            name: "Campus card",
            type: "CARD",
            startingBalanceMinor: 125_050,
            isArchived: false,
        });
        expect(await accounts.getById(created.id)).toEqual(created);
        const updated = await accounts.update(created.id, {
            name: "Student card",
            isArchived: true,
        });
        expect(updated).toMatchObject({ name: "Student card", isArchived: true });
        expect((await accounts.list()).some(({ id }) => id === created.id)).toBe(true);
        expect(await accounts.delete(created.id)).toBe(true);
        expect(await accounts.getById(created.id)).toBeNull();
    });
    test("creates, reads, updates, lists, and deletes a category", async () => {
        const created = await categories.create({
            name: "Dorm",
            icon: "home",
            colorHex: "#334155",
            type: "EXPENSE",
            isCustom: true,
        });
        expect(await categories.getById(created.id)).toEqual(created);
        const updated = await categories.update(created.id, {
            colorHex: "#475569",
            icon: "bed",
        });
        expect(updated).toMatchObject({ colorHex: "#475569", icon: "bed" });
        expect((await categories.list()).some(({ id }) => id === created.id)).toBe(true);
        expect(await categories.delete(created.id)).toBe(true);
    });
    test("creates, reads, updates, lists, and deletes a transaction", async () => {
        const cash = (await accounts.list())[0];
        const food = (await categories.list()).find(({ name, type }) => name === "Food" && type === "EXPENSE");
        expect(cash).toBeDefined();
        expect(food).toBeDefined();
        const created = await transactions.create({
            amountMinor: 8_550,
            type: "EXPENSE",
            categoryId: food.id,
            accountId: cash.id,
            dateEpochMillis: 1_785_542_400_000,
            note: "Lunch and study snack",
            recurringRuleId: null,
        });
        expect(await transactions.getById(created.id)).toEqual(created);
        const updated = await transactions.update(created.id, {
            amountMinor: 8_000,
            note: null,
        });
        expect(updated).toMatchObject({ amountMinor: 8_000, note: null });
        expect(await transactions.list()).toHaveLength(1);
        expect(await transactions.delete(created.id)).toBe(true);
    });
    test("rejects a transaction whose category type does not match", async () => {
        const cash = (await accounts.list())[0];
        const allowance = (await categories.list()).find(({ name, type }) => name === "Allowance" && type === "INCOME");
        await expect(transactions.create({
            amountMinor: 1_000,
            type: "EXPENSE",
            categoryId: allowance.id,
            accountId: cash.id,
            dateEpochMillis: 1_785_542_400_000,
            note: null,
            recurringRuleId: null,
        })).rejects.toThrow();
    });
    test("creates, reads, updates, lists, and deletes a unique expense budget", async () => {
        const food = (await categories.list()).find(({ name, type }) => name === "Food" && type === "EXPENSE");
        const created = await budgets.create({
            categoryId: food.id,
            monthYear: "2026-08",
            limitMinor: 300_000,
        });
        expect(await budgets.getById(created.id)).toEqual(created);
        const updated = await budgets.update(created.id, { limitMinor: 275_000 });
        expect(updated).toMatchObject({ limitMinor: 275_000 });
        expect(await budgets.list()).toHaveLength(1);
        await expect(budgets.create({
            categoryId: food.id,
            monthYear: "2026-08",
            limitMinor: 1,
        })).rejects.toThrow();
        expect(await budgets.delete(created.id)).toBe(true);
    });
    test("rejects a budget for an income category", async () => {
        const allowance = (await categories.list()).find(({ name, type }) => name === "Allowance" && type === "INCOME");
        await expect(budgets.create({
            categoryId: allowance.id,
            monthYear: "2026-08",
            limitMinor: 100_000,
        })).rejects.toThrow("expense category");
    });
    test("creates, reads, updates, lists, and deletes a recurring rule", async () => {
        const cash = (await accounts.list())[0];
        const food = (await categories.list()).find(({ name, type }) => name === "Food" && type === "EXPENSE");
        const created = await recurringRules.create({
            amountMinor: 12_500,
            type: "EXPENSE",
            categoryId: food.id,
            accountId: cash.id,
            note: "Meal plan",
            frequency: "WEEKLY",
            nextRunEpochMillis: 1_786_147_200_000,
            isActive: true,
            reminderEnabled: true,
            reminderLeadDays: 3,
        });
        expect(await recurringRules.getById(created.id)).toEqual(created);
        const updated = await recurringRules.update(created.id, {
            frequency: "MONTHLY",
            reminderLeadDays: 10,
        });
        expect(updated).toMatchObject({ frequency: "MONTHLY", reminderLeadDays: 10 });
        expect(await recurringRules.list()).toHaveLength(1);
        expect(await recurringRules.delete(created.id)).toBe(true);
    });
    test("sets a linked transaction recurring ID to null when its rule is deleted", async () => {
        const cash = (await accounts.list())[0];
        const allowance = (await categories.list()).find(({ name, type }) => name === "Allowance" && type === "INCOME");
        const rule = await recurringRules.create({
            amountMinor: 50_000,
            type: "INCOME",
            categoryId: allowance.id,
            accountId: cash.id,
            note: "Weekly allowance",
            frequency: "WEEKLY",
            nextRunEpochMillis: 1_786_147_200_000,
            isActive: true,
            reminderEnabled: false,
            reminderLeadDays: 3,
        });
        const transaction = await transactions.create({
            amountMinor: 50_000,
            type: "INCOME",
            categoryId: allowance.id,
            accountId: cash.id,
            dateEpochMillis: 1_785_542_400_000,
            note: null,
            recurringRuleId: rule.id,
        });
        expect(await recurringRules.delete(rule.id)).toBe(true);
        expect(await transactions.getById(transaction.id)).toMatchObject({ recurringRuleId: null });
    });
    test("rejects unsafe money integers and undefined-only update patches", async () => {
        await expect(accounts.create({
            name: "Unsafe",
            type: "CASH",
            startingBalanceMinor: Number.MAX_SAFE_INTEGER + 1,
            isArchived: false,
        })).rejects.toThrow("safe integer");
        await expect(accounts.update(1, { name: undefined })).rejects.toThrow("defined field");
    });
});
