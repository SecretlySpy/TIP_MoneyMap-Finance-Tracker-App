import { create } from "zustand";
import { initializeDatabase } from "../db/client";
import { AccountRepository, BudgetRepository, CategoryRepository, RecurringRepository, TransactionRepository, } from "../db/repositories";
import { accountChipLabel, toMonthYear, } from "../domain/services/financeView";
const DEFAULT_ACCOUNTS = [
    { name: "Cash", type: "CASH" },
    { name: "Card", type: "CARD" },
    { name: "E-wallet", type: "EWALLET" },
];
const ENTRY_CATEGORY_SEED = [
    { name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE" },
    { name: "Transport", icon: "bus", colorHex: "#2563EB", type: "EXPENSE" },
    { name: "Bills", icon: "receipt", colorHex: "#CA8A04", type: "EXPENSE" },
    { name: "Shopping", icon: "shopping-bag", colorHex: "#DB2777", type: "EXPENSE" },
    { name: "Health", icon: "medkit", colorHex: "#DC2626", type: "EXPENSE" },
    { name: "Fun", icon: "game-controller", colorHex: "#9333EA", type: "EXPENSE" },
    { name: "Other", icon: "ellipsis-horizontal", colorHex: "#64748B", type: "EXPENSE" },
    { name: "Allowance", icon: "wallet", colorHex: "#16A34A", type: "INCOME" },
    { name: "Part-time", icon: "briefcase", colorHex: "#0F766E", type: "INCOME" },
    { name: "Salary", icon: "cash", colorHex: "#15803D", type: "INCOME" },
];
let databaseRef = null;
let hydratePromise = null;
function repositories(database) {
    return {
        accounts: new AccountRepository(database),
        budgets: new BudgetRepository(database),
        categories: new CategoryRepository(database),
        recurring: new RecurringRepository(database),
        transactions: new TransactionRepository(database),
    };
}
async function ensureDefaultAccounts(accountRepo) {
    const existing = await accountRepo.list();
    for (const defaults of DEFAULT_ACCOUNTS) {
        const found = existing.find((account) => account.type === defaults.type && !account.isArchived);
        if (!found) {
            await accountRepo.create({
                name: defaults.name,
                type: defaults.type,
                startingBalanceMinor: 0,
                isArchived: false,
            });
        }
    }
}
async function ensureEntryCategories(categoryRepo) {
    const existing = await categoryRepo.list();
    for (const seed of ENTRY_CATEGORY_SEED) {
        const found = existing.find((category) => category.name.toLowerCase() === seed.name.toLowerCase() && category.type === seed.type);
        if (!found) {
            await categoryRepo.create({
                name: seed.name,
                icon: seed.icon,
                colorHex: seed.colorHex,
                type: seed.type,
                isCustom: false,
            });
        }
    }
}
async function loadSnapshot(database) {
    const repos = repositories(database);
    await ensureDefaultAccounts(repos.accounts);
    await ensureEntryCategories(repos.categories);
    const [accounts, categories, transactions, budgets, recurringRules] = await Promise.all([
        repos.accounts.list(),
        repos.categories.list(),
        repos.transactions.list(),
        repos.budgets.list(),
        repos.recurring.list(),
    ]);
    return { accounts, categories, transactions, budgets, recurringRules };
}
function findCategory(categories, name, type) {
    const match = categories.find((category) => category.name.toLowerCase() === name.toLowerCase() && category.type === type);
    if (!match) {
        throw new Error(`Category "${name}" (${type}) was not found.`);
    }
    return match;
}
function findAccount(accounts, type) {
    const match = accounts.find((account) => account.type === type && !account.isArchived);
    if (!match) {
        throw new Error(`Account type ${type} is unavailable.`);
    }
    return match;
}
export const useFinanceStore = create((set, get) => ({
    accounts: [],
    budgets: [],
    categories: [],
    errorMessage: null,
    recurringRules: [],
    revision: 0,
    selectedMonthYear: toMonthYear(),
    status: "idle",
    transactions: [],
    setSelectedMonthYear: (monthYear) => set({ selectedMonthYear: monthYear }),
    ensureHydrated: async () => {
        if (get().status === "ready" && databaseRef !== null) {
            return;
        }
        if (hydratePromise !== null) {
            await hydratePromise;
            return;
        }
        hydratePromise = (async () => {
            set({ status: "loading", errorMessage: null });
            try {
                const database = await initializeDatabase();
                databaseRef = database;
                const snapshot = await loadSnapshot(database);
                set({
                    ...snapshot,
                    status: "ready",
                    errorMessage: null,
                    revision: get().revision + 1,
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Failed to load finance data.";
                set({ status: "error", errorMessage: message });
                throw error;
            }
            finally {
                hydratePromise = null;
            }
        })();
        await hydratePromise;
    },
    refresh: async () => {
        const database = databaseRef ?? (await initializeDatabase());
        databaseRef = database;
        const snapshot = await loadSnapshot(database);
        set({
            ...snapshot,
            status: "ready",
            errorMessage: null,
            revision: get().revision + 1,
        });
    },
    addTransaction: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const { accounts, categories } = get();
        const category = findCategory(categories, input.categoryName, input.type);
        const account = findAccount(accounts, input.accountType);
        const payload = {
            amountMinor: input.amountMinor,
            type: input.type,
            categoryId: category.id,
            accountId: account.id,
            dateEpochMillis: Date.now(),
            note: input.note?.trim() ? input.note.trim() : null,
            recurringRuleId: null,
        };
        const created = await new TransactionRepository(database).create(payload);
        await get().refresh();
        return created;
    },
    addBudget: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const monthYear = input.monthYear ?? get().selectedMonthYear;
        const category = findCategory(get().categories, input.categoryName, "EXPENSE");
        const existing = get().budgets.find((budget) => budget.categoryId === category.id && budget.monthYear === monthYear);
        if (existing) {
            const updated = await new BudgetRepository(database).update(existing.id, {
                limitMinor: input.limitMinor,
            });
            await get().refresh();
            if (updated === null) {
                throw new Error("Budget could not be updated.");
            }
            return updated;
        }
        const payload = {
            categoryId: category.id,
            monthYear,
            limitMinor: input.limitMinor,
        };
        const created = await new BudgetRepository(database).create(payload);
        await get().refresh();
        return created;
    },
    addRecurringBill: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const category = findCategory(get().categories, input.categoryName, "EXPENSE");
        const account = findAccount(get().accounts, "CASH");
        const nextRun = new Date();
        nextRun.setDate(nextRun.getDate() + Math.max(input.leadDays, 1));
        const payload = {
            amountMinor: input.amountMinor,
            type: "EXPENSE",
            categoryId: category.id,
            accountId: account.id,
            note: input.name,
            frequency: "MONTHLY",
            nextRunEpochMillis: nextRun.getTime(),
            isActive: true,
            reminderEnabled: true,
            reminderLeadDays: input.leadDays,
        };
        const created = await new RecurringRepository(database).create(payload);
        await get().refresh();
        return created;
    },
    addCategory: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const name = input.name.trim();
        if (name.length === 0) {
            throw new Error("Category name is required.");
        }
        const existing = get().categories.find((category) => category.name.toLowerCase() === name.toLowerCase() && category.type === input.type);
        if (existing) {
            return existing;
        }
        const created = await new CategoryRepository(database).create({
            name,
            icon: input.icon?.trim() || "pricetag",
            colorHex: input.colorHex ?? (input.type === "INCOME" ? "#15803D" : "#64748B"),
            type: input.type,
            isCustom: true,
        });
        await get().refresh();
        return created;
    },
    updateAccount: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const updated = await new AccountRepository(database).update(input.id, {
            name: input.name,
            startingBalanceMinor: input.startingBalanceMinor,
            isArchived: input.isArchived,
        });
        if (updated === null) {
            throw new Error("Account could not be updated.");
        }
        await get().refresh();
        return updated;
    },
    updateBudgetLimit: async (input) => get().addBudget(input),
    importCsvRows: async (rows) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        if (rows.length === 0) {
            return 0;
        }
        const categoryRepo = new CategoryRepository(database);
        const transactionRepo = new TransactionRepository(database);
        let createdCount = 0;
        for (const row of rows) {
            let category = get().categories.find((item) => item.name.toLowerCase() === row.categoryName.toLowerCase() && item.type === row.type);
            if (category === undefined) {
                category = await categoryRepo.create({
                    name: row.categoryName,
                    icon: "pricetag",
                    colorHex: row.type === "INCOME" ? "#15803D" : "#64748B",
                    type: row.type,
                    isCustom: true,
                });
                set({
                    categories: [...get().categories, category],
                });
            }
            const account = findAccount(get().accounts, row.accountType);
            await transactionRepo.create({
                amountMinor: row.amountMinor,
                type: row.type,
                categoryId: category.id,
                accountId: account.id,
                dateEpochMillis: row.dateEpochMillis,
                note: row.note,
                recurringRuleId: null,
            });
            createdCount += 1;
        }
        await get().refresh();
        return createdCount;
    },
    restoreBackup: async (backup) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const insertReturningId = async (tx, statement, parameters) => {
            const result = await tx.execute(statement, parameters);
            if (result.insertId !== undefined &&
                Number.isSafeInteger(result.insertId) &&
                result.insertId > 0) {
                return result.insertId;
            }
            const idResult = await tx.execute("SELECT last_insert_rowid() AS id");
            const id = Number(idResult.rows[0]?.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                throw new Error("Backup restore could not read inserted row ids.");
            }
            return id;
        };
        await database.transaction(async (tx) => {
            await tx.execute("DELETE FROM transactions");
            await tx.execute("DELETE FROM budgets");
            await tx.execute("DELETE FROM recurring_rules");
            await tx.execute("DELETE FROM categories");
            await tx.execute("DELETE FROM accounts");
            const accountIdMap = new Map();
            for (const account of backup.accounts) {
                const nextId = await insertReturningId(tx, `INSERT INTO accounts (name, type, starting_balance_minor, is_archived)
           VALUES (?, ?, ?, ?)`, [account.name, account.type, account.startingBalanceMinor, account.isArchived ? 1 : 0]);
                accountIdMap.set(account.id, nextId);
            }
            const categoryIdMap = new Map();
            for (const category of backup.categories) {
                const nextId = await insertReturningId(tx, `INSERT INTO categories (name, icon, color_hex, type, is_custom)
           VALUES (?, ?, ?, ?, ?)`, [
                    category.name,
                    category.icon,
                    category.colorHex,
                    category.type,
                    category.isCustom ? 1 : 0,
                ]);
                categoryIdMap.set(category.id, nextId);
            }
            const recurringIdMap = new Map();
            for (const rule of backup.recurringRules) {
                const categoryId = categoryIdMap.get(rule.categoryId);
                const accountId = accountIdMap.get(rule.accountId);
                if (categoryId === undefined || accountId === undefined) {
                    continue;
                }
                const nextId = await insertReturningId(tx, `INSERT INTO recurring_rules (
             amount_minor, type, category_id, account_id, note, frequency,
             next_run_epoch_millis, is_active, reminder_enabled, reminder_lead_days
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    rule.amountMinor,
                    rule.type,
                    categoryId,
                    accountId,
                    rule.note,
                    rule.frequency,
                    rule.nextRunEpochMillis,
                    rule.isActive ? 1 : 0,
                    rule.reminderEnabled ? 1 : 0,
                    rule.reminderLeadDays,
                ]);
                recurringIdMap.set(rule.id, nextId);
            }
            for (const transaction of backup.transactions) {
                const categoryId = categoryIdMap.get(transaction.categoryId);
                const accountId = accountIdMap.get(transaction.accountId);
                if (categoryId === undefined || accountId === undefined) {
                    continue;
                }
                const recurringRuleId = transaction.recurringRuleId === null
                    ? null
                    : (recurringIdMap.get(transaction.recurringRuleId) ?? null);
                await tx.execute(`INSERT INTO transactions (
             amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    transaction.amountMinor,
                    transaction.type,
                    categoryId,
                    accountId,
                    transaction.dateEpochMillis,
                    transaction.note,
                    recurringRuleId,
                ]);
            }
            for (const budget of backup.budgets) {
                const categoryId = categoryIdMap.get(budget.categoryId);
                if (categoryId === undefined) {
                    continue;
                }
                await tx.execute(`INSERT INTO budgets (category_id, month_year, limit_minor)
           VALUES (?, ?, ?)`, [categoryId, budget.monthYear, budget.limitMinor]);
            }
        });
        await get().refresh();
    },
    deleteBudgetByCategoryName: async (categoryName, monthYear) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const scope = monthYear ?? get().selectedMonthYear;
        const category = findCategory(get().categories, categoryName, "EXPENSE");
        const budget = get().budgets.find((item) => item.categoryId === category.id && item.monthYear === scope);
        if (budget === undefined) {
            return;
        }
        await new BudgetRepository(database).delete(budget.id);
        await get().refresh();
    },
    deleteRecurringById: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        await new RecurringRepository(database).delete(id);
        await get().refresh();
    },
}));
export function listAccountChips(accounts) {
    return DEFAULT_ACCOUNTS.map((defaults) => {
        const match = accounts.find((account) => account.type === defaults.type && !account.isArchived);
        return {
            type: defaults.type,
            label: match ? accountChipLabel(match.type) : accountChipLabel(defaults.type),
        };
    });
}
export function mapsFromState(state) {
    return {
        accountsById: new Map(state.accounts.map((account) => [account.id, account])),
        categoriesById: new Map(state.categories.map((category) => [category.id, category])),
    };
}
