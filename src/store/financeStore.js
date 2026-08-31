import { create } from "zustand";
import { initializeDatabase } from "../db/client";
import { AccountRepository, BudgetRepository, CategoryRepository, GoalRepository, RecurringRepository, TransactionRepository, } from "../db/repositories";
import { RECURRING_REMINDER_LEAD_DAYS } from "../domain/services/emoji";
import { canDeleteAccount, canDeleteCategory, canRenameCategory, } from "../domain/services/entityGuards";
import { accountChipLabel, toMonthYear, } from "../domain/services/financeView";
import { runRecurringCatchUp } from "../services/recurringCatchUp";
import { registerFinanceSnapshotProvider, syncRemindersFromStores } from "./uiStore";
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
        goals: new GoalRepository(database),
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
    const [accounts, categories, transactions, budgets, recurringRules, goals] = await Promise.all([
        repos.accounts.list(),
        repos.categories.list(),
        repos.transactions.list(),
        repos.budgets.list(),
        repos.recurring.list(),
        repos.goals.list(),
    ]);
    return { accounts, categories, transactions, budgets, recurringRules, goals };
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
    goals: [],
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
                // Post any due recurring rules before the first UI snapshot (idempotent).
                await runRecurringCatchUp(database);
                const snapshot = await loadSnapshot(database);
                set({
                    ...snapshot,
                    status: "ready",
                    errorMessage: null,
                    revision: get().revision + 1,
                });
                void syncRemindersFromStores({ requestPermissionIfNeeded: false });
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
        void syncRemindersFromStores({ requestPermissionIfNeeded: false });
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
        const type = input.type === "INCOME" ? "INCOME" : "EXPENSE";
        const categoryName = input.categoryName
            ?? (get().categories.find((c) => c.type === type && c.name === (type === "INCOME" ? "Allowance" : "Bills"))?.name)
            ?? get().categories.find((c) => c.type === type)?.name;
        if (!categoryName) {
            throw new Error(`Add a${type === "INCOME" ? "n income" : "n expense"} category before creating a recurring rule.`);
        }
        const category = findCategory(get().categories, categoryName, type);
        const account = findAccount(get().accounts, input.accountType ?? "CASH");
        const leadDays = Number.isInteger(input.leadDays) && input.leadDays >= 0
            ? input.leadDays
            : RECURRING_REMINDER_LEAD_DAYS;
        const frequency = ["DAILY", "WEEKLY", "MONTHLY"].includes(input.frequency)
            ? input.frequency
            : "MONTHLY";
        let nextRunEpochMillis = input.dueEpochMillis;
        if (!Number.isSafeInteger(nextRunEpochMillis)) {
            const nextRun = new Date();
            nextRun.setHours(12, 0, 0, 0);
            nextRun.setDate(nextRun.getDate() + leadDays);
            nextRunEpochMillis = nextRun.getTime();
        }
        const payload = {
            amountMinor: input.amountMinor,
            type,
            categoryId: category.id,
            accountId: account.id,
            note: input.name,
            frequency,
            nextRunEpochMillis,
            isActive: true,
            reminderEnabled: input.reminderEnabled !== false,
            reminderLeadDays: leadDays,
            icon: input.icon ?? null,
            anchorDay: new Date(nextRunEpochMillis).getDate(),
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
            // Optionally refresh custom emoji on existing category when provided.
            if (input.icon && input.icon !== existing.icon) {
                const updated = await new CategoryRepository(database).update(existing.id, {
                    icon: input.icon.trim(),
                });
                await get().refresh();
                return updated ?? existing;
            }
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
    renameCategory: async (id, name) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const existing = get().categories.find((category) => category.id === id);
        if (existing === undefined) {
            throw new Error("Category not found.");
        }
        const check = canRenameCategory(name, existing.type, get().categories, id);
        if (!check.ok) {
            throw new Error(check.reason);
        }
        const updated = await new CategoryRepository(database).update(id, {
            name: check.name,
            isCustom: true,
        });
        if (updated === null) {
            throw new Error("Category could not be renamed.");
        }
        await get().refresh();
        return updated;
    },
    deleteCategory: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const guard = canDeleteCategory(id, {
            transactions: get().transactions,
            budgets: get().budgets,
            recurringRules: get().recurringRules,
        });
        if (!guard.ok) {
            throw new Error(guard.reason);
        }
        await new CategoryRepository(database).delete(id);
        await get().refresh();
    },
    createAccount: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const name = String(input.name ?? "").trim();
        if (name.length === 0) {
            throw new Error("Account name is required.");
        }
        const created = await new AccountRepository(database).create({
            name,
            type: input.type,
            startingBalanceMinor: input.startingBalanceMinor ?? 0,
            isArchived: false,
        });
        await get().refresh();
        return created;
    },
    deleteAccount: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const guard = canDeleteAccount(id, {
            accounts: get().accounts,
            transactions: get().transactions,
            recurringRules: get().recurringRules,
        });
        if (!guard.ok) {
            throw new Error(guard.reason);
        }
        await new AccountRepository(database).delete(id);
        await get().refresh();
    },
    /**
     * Hide an account without touching its history. Unlike delete, this is allowed for
     * accounts that already have transactions -- that is the whole point of archiving.
     */
    archiveAccount: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const remaining = get().accounts.filter((account) => !account.isArchived && account.id !== id);
        if (remaining.length === 0) {
            throw new Error("Keep at least one active account.");
        }
        const updated = await new AccountRepository(database).update(id, { isArchived: true });
        if (updated === null) {
            throw new Error("Account could not be archived.");
        }
        await get().refresh();
        return updated;
    },
    unarchiveAccount: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const updated = await new AccountRepository(database).update(id, { isArchived: false });
        if (updated === null) {
            throw new Error("Account could not be restored.");
        }
        await get().refresh();
        return updated;
    },
    updateRecurringRule: async (id, patch) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const updated = await new RecurringRepository(database).update(id, patch);
        if (updated === null) {
            throw new Error("Recurring bill could not be updated.");
        }
        await get().refresh();
        return updated;
    },
    renameGoal: async (id, name) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const trimmed = String(name ?? "").trim();
        if (trimmed.length === 0) {
            throw new Error("Goal name is required.");
        }
        const updated = await new GoalRepository(database).update(id, { name: trimmed });
        if (updated === null) {
            throw new Error("Goal could not be renamed.");
        }
        await get().refresh();
        return updated;
    },
    updateGoal: async (id, patch) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const updated = await new GoalRepository(database).update(id, patch);
        if (updated === null) {
            throw new Error("Goal could not be updated.");
        }
        await get().refresh();
        return updated;
    },
    deleteGoal: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        await new GoalRepository(database).delete(id);
        await get().refresh();
    },
    /**
     * Bulk-insert already-validated import rows inside one transaction.
     * Auto-creates missing categories and account types. Returns a summary object
     * (or a number for older callers that only read the created count).
     * @param {Array<{ dateEpochMillis: number, type: string, amountMinor: number, categoryName: string, accountType: string, note: string|null }>} rows
     * @param {{ skipped?: Array<{ rowNumber: number, reason: string }> }} [meta]
     */
    importCsvRows: async (rows, meta = {}) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const skipped = Array.isArray(meta.skipped) ? meta.skipped : [];
        if (rows.length === 0) {
            return { created: 0, skipped: skipped.length, skippedRows: skipped };
        }

        const accountDefaults = {
            CASH: "Cash",
            CARD: "Card",
            EWALLET: "E-wallet",
        };

        await database.transaction(async (tx) => {
            const categoryCache = new Map(
                get().categories.map((category) => [`${category.type}:${category.name.toLowerCase()}`, category]),
            );
            const accountCache = new Map(
                get().accounts.filter((account) => !account.isArchived).map((account) => [account.type, account]),
            );

            const insertReturningId = async (statement, parameters) => {
                const result = await tx.execute(statement, parameters);
                if (result.insertId !== undefined && Number.isSafeInteger(result.insertId) && result.insertId > 0) {
                    return result.insertId;
                }
                const idResult = await tx.execute("SELECT last_insert_rowid() AS id");
                const id = Number(idResult.rows[0]?.id);
                if (!Number.isSafeInteger(id) || id <= 0) {
                    throw new Error("Import could not read inserted row ids.");
                }
                return id;
            };

            for (const row of rows) {
                const categoryKey = `${row.type}:${row.categoryName.toLowerCase()}`;
                let category = categoryCache.get(categoryKey);
                if (category === undefined) {
                    const categoryId = await insertReturningId(
                        `INSERT INTO categories (name, icon, color_hex, type, is_custom)
             VALUES (?, ?, ?, ?, ?)`,
                        [
                            row.categoryName,
                            "pricetag",
                            row.type === "INCOME" ? "#15803D" : "#64748B",
                            row.type,
                            1,
                        ],
                    );
                    category = {
                        id: categoryId,
                        name: row.categoryName,
                        icon: "pricetag",
                        colorHex: row.type === "INCOME" ? "#15803D" : "#64748B",
                        type: row.type,
                        isCustom: true,
                    };
                    categoryCache.set(categoryKey, category);
                }

                let account = accountCache.get(row.accountType);
                if (account === undefined) {
                    const accountId = await insertReturningId(
                        `INSERT INTO accounts (name, type, starting_balance_minor, is_archived)
             VALUES (?, ?, ?, 0)`,
                        [accountDefaults[row.accountType] ?? row.accountType, row.accountType, 0],
                    );
                    account = {
                        id: accountId,
                        name: accountDefaults[row.accountType] ?? row.accountType,
                        type: row.accountType,
                        startingBalanceMinor: 0,
                        isArchived: false,
                    };
                    accountCache.set(row.accountType, account);
                }

                await tx.execute(
                    `INSERT INTO transactions (
              amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id
            ) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
                    [
                        row.amountMinor,
                        row.type,
                        category.id,
                        account.id,
                        row.dateEpochMillis,
                        row.note,
                    ],
                );
            }
        });

        await get().refresh();
        const summary = { created: rows.length, skipped: skipped.length, skippedRows: skipped };
        // Number-like for callers that only display the created count.
        summary.valueOf = () => rows.length;
        return summary;
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
            await tx.execute("DELETE FROM savings_goals");
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
              next_run_epoch_millis, is_active, reminder_enabled, reminder_lead_days, icon, anchor_day
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
                    rule.icon ?? null,
                    rule.anchorDay ?? null,
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
            // savings_goals is deleted above; without this loop every goal is lost on restore.
            for (const goal of backup.goals ?? []) {
                await tx.execute(`INSERT INTO savings_goals (
              name, target_minor, current_minor, deadline_epoch_millis, is_archived, created_epoch_millis
            ) VALUES (?, ?, ?, ?, ?, ?)`, [
                    goal.name,
                    goal.targetMinor,
                    goal.currentMinor,
                    goal.deadlineEpochMillis ?? null,
                    goal.isArchived ? 1 : 0,
                    goal.createdEpochMillis,
                ]);
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
    deleteTransactionById: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        await new TransactionRepository(database).delete(id);
        await get().refresh();
    },
    addGoal: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const created = await new GoalRepository(database).create({
            name: input.name,
            targetMinor: input.targetMinor,
            currentMinor: input.currentMinor ?? 0,
            deadlineEpochMillis: input.deadlineEpochMillis ?? null,
        });
        await get().refresh();
        return created;
    },
    contributeToGoal: async (id, amountMinor) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const updated = await new GoalRepository(database).contribute(id, amountMinor);
        await get().refresh();
        return updated;
    },
    archiveGoal: async (id) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        await new GoalRepository(database).update(id, { isArchived: true });
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
registerFinanceSnapshotProvider(() => {
    const state = useFinanceStore.getState();
    return {
        recurringRules: state.recurringRules,
        categories: state.categories,
    };
});
