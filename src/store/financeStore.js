import { create } from "zustand";
import { initializeDatabase } from "../db/client";
import { AccountRepository, BudgetRepository, CategoryRepository, GoalRepository, RecurringRepository, TransactionRepository, TransactionGroupRepository, TransferRepository, } from "../db/repositories";
import { canArchiveAccount, canDeleteAccount, canDeleteCategory, canRenameCategory, } from "../domain/services/entityGuards";
import { toMonthYear, } from "../domain/services/financeView";
import { advanceNextRunEpochMillis } from "../domain/services/recurringCatchUp";
import { buildAutomaticAccountResolutions, listImportAccountSources, unresolvedImportAccountSources, } from "../domain/services/importAccounts";
import { importAccountKey } from "../domain/services/importParser";
import { ACCOUNT_TYPES } from "../domain/types";
import { runRecurringCatchUp } from "../services/recurringCatchUp";
import { buildBackup, parseBackup, serializeBackup, validateBackup } from "../services/dataTransfer";
import { ONBOARDING_FIRST_TRANSACTION_SOURCE_KEY } from "../services/onboarding";
import { performLocalReset } from "../services/localReset";
import { registerFinanceSnapshotProvider, syncRemindersFromStores } from "./uiStore";
import { generateSplitGroupId, stripSplitSuffix, extractParentNote, validateSplitSum } from "../domain/services/splits";
import {
    getActiveBudgetTemplates,
    saveBudgetTemplate as persistBudgetTemplate,
    duplicateBudgetTemplate as persistDuplicateBudgetTemplate,
    deleteBudgetTemplate as persistDeleteBudgetTemplate,
    restoreBudgetTemplate as persistRestoreBudgetTemplate,
    clearBudgetTemplatesStorage,
} from "../services/budgetTemplatesStorage";
const DEFAULT_ACCOUNTS = [
    { name: "Cash", type: "CASH" },
    { name: "Card", type: "CARD" },
    { name: "E-wallet", type: "EWALLET" },
];
const ENTRY_CATEGORY_SEED = [
    { name: "Food", icon: "restaurant", colorHex: "#EA580C", type: "EXPENSE" },
    { name: "Transport", icon: "bus", colorHex: "#2563EB", type: "EXPENSE" },
    { name: "School", icon: "book", colorHex: "#7C3AED", type: "EXPENSE" },
    { name: "Load/Data", icon: "phone-portrait", colorHex: "#0F766E", type: "EXPENSE" },
    { name: "Bills", icon: "receipt", colorHex: "#CA8A04", type: "EXPENSE" },
    { name: "Shopping", icon: "shopping-bag", colorHex: "#DB2777", type: "EXPENSE" },
    { name: "Health", icon: "medkit", colorHex: "#DC2626", type: "EXPENSE" },
    { name: "Fun", icon: "game-controller", colorHex: "#9333EA", type: "EXPENSE" },
    { name: "Entertainment", icon: "game-controller", colorHex: "#9333EA", type: "EXPENSE" },
    { name: "Other", icon: "ellipsis-horizontal", colorHex: "#64748B", type: "EXPENSE" },
    { name: "Allowance", icon: "wallet", colorHex: "#16A34A", type: "INCOME" },
    { name: "Part-time", icon: "briefcase", colorHex: "#0F766E", type: "INCOME" },
    { name: "Salary", icon: "cash", colorHex: "#15803D", type: "INCOME" },
];
let databaseRef = null;
let hydratePromise = null;
let mutationTail = Promise.resolve();
let inFlightRestorePromise = null;
let inFlightRestoreSerialized = null;

async function withMutationLock(action) {
    const previous = mutationTail;
    let release;
    mutationTail = new Promise((resolve) => {
        release = resolve;
    });
    try {
        await previous;
        return await action();
    } finally {
        release();
    }
}

async function safeRefreshAfterCommit(get, set) {
    try {
        await get().refresh();
        set({ refreshPending: false });
    } catch (error) {
        set({ refreshPending: true });
    }
}

function repositories(database) {
    return {
        accounts: new AccountRepository(database),
        budgets: new BudgetRepository(database),
        categories: new CategoryRepository(database),
        goals: new GoalRepository(database),
        recurring: new RecurringRepository(database),
        transactions: new TransactionRepository(database),
        transactionGroups: new TransactionGroupRepository(database),
        transfers: new TransferRepository(database),
    };
}
async function ensureDefaultAccounts(accountRepo) {
    const existing = await accountRepo.list();
    for (const defaults of DEFAULT_ACCOUNTS) {
        const found = existing.find((account) => account.type === defaults.type);
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
async function ensureBootstrapDefaults(database) {
    const marker = await database.execute("SELECT value FROM app_metadata WHERE key = ?", ["bootstrap-defaults-v1"]);
    if (marker.rows[0]?.value === "complete") {
        return;
    }
    await database.transaction(async (transaction) => {
        const repos = repositories(transaction);
        await ensureDefaultAccounts(repos.accounts);
        await ensureEntryCategories(repos.categories);
        await transaction.execute(`INSERT INTO app_metadata (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`, ["bootstrap-defaults-v1", "complete"]);
    });
}
async function loadSnapshot(database) {
    const repos = repositories(database);
    // Defaults are a one-time bootstrap, not a repair loop. User archive/delete choices
    // and exact backup restores must survive every subsequent refresh.
    await ensureBootstrapDefaults(database);
    const [accounts, categories, transactions, transfers, budgets, recurringRules, goals, budgetTemplates, transactionGroups] = await Promise.all([
        repos.accounts.list(),
        repos.categories.list(),
        repos.transactions.list(),
        repos.transfers.list(),
        repos.budgets.list(),
        repos.recurring.list(),
        repos.goals.list(),
        getActiveBudgetTemplates({ database }),
        repos.transactionGroups.list(),
    ]);
    return { accounts, categories, transactions, transfers, budgets, recurringRules, goals, budgetTemplates, transactionGroups };
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
function findActiveAccountById(accounts, id) {
    const match = accounts.find((account) => account.id === id && !account.isArchived);
    if (!match) {
        throw new Error("The selected account is unavailable or archived.");
    }
    return match;
}
export const useFinanceStore = create((set, get) => ({
    accounts: [],
    budgets: [],
    budgetTemplates: [],
    categories: [],
    errorMessage: null,
    goals: [],
    recurringRules: [],
    refreshPending: false,
    revision: 0,
    selectedMonthYear: toMonthYear(),
    status: "idle",
    transactions: [],
    transactionGroups: [],
    transfers: [],
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
        await runRecurringCatchUp(database);
        const snapshot = await loadSnapshot(database);
        set({
            ...snapshot,
            status: "ready",
            errorMessage: null,
            revision: get().revision + 1,
        });
        void syncRemindersFromStores({ requestPermissionIfNeeded: false });
    },
    resetLocalData: async () => withMutationLock(async () => {
        databaseRef = null;
        hydratePromise = null;
        inFlightRestorePromise = null;
        inFlightRestoreSerialized = null;
        set({
            accounts: [],
            budgets: [],
            budgetTemplates: [],
            categories: [],
            errorMessage: null,
            goals: [],
            recurringRules: [],
            refreshPending: false,
            selectedMonthYear: toMonthYear(),
            status: "resetting",
            transactions: [],
            transactionGroups: [],
            transfers: [],
        });
        try {
            await clearBudgetTemplatesStorage({ database: databaseRef });
            await performLocalReset();
            set({ status: "idle", revision: get().revision + 1 });
        }
        catch (error) {
            set({
                status: "error",
                errorMessage: error instanceof Error ? error.message : "Local reset could not be completed.",
            });
            throw error;
        }
    }),
    addTransaction: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const { accounts, categories } = get();
        let category;
        if (input.categoryId !== undefined && input.categoryId !== null) {
            category = categories.find((c) => c.id === input.categoryId);
            if (!category) {
                throw new Error(`Category with ID ${input.categoryId} was not found.`);
            }
            if (input.type && category.type !== input.type) {
                throw new Error(`Transaction type must match category type.`);
            }
            if (input.categoryName && category.name.toLowerCase() !== input.categoryName.toLowerCase()) {
                throw new Error(`Category ID ${input.categoryId} does not match name "${input.categoryName}".`);
            }
        } else if (input.categoryName) {
            category = findCategory(categories, input.categoryName, input.type);
        } else if (input.note === "Reconciliation adjustment") {
            category = categories.find((c) => c.type === input.type);
            if (!category) {
                throw new Error(`No available category for ${input.type}.`);
            }
        } else {
            throw new Error("Category is required.");
        }
        const account = input.accountId === undefined
            ? findAccount(accounts, input.accountType)
            : findActiveAccountById(accounts, input.accountId);
        const transactionRepo = new TransactionRepository(database);
        const existingSourceTransaction = input.sourceKey
            ? await transactionRepo.getBySourceKey(input.sourceKey)
            : null;
        // A retry after commit may omit the original default date. Reuse the durable
        // timestamp only in that case; an explicitly changed date still fails collision checks.
        const dateEpochMillis = input.dateEpochMillis
            ?? existingSourceTransaction?.dateEpochMillis
            ?? Date.now();
        if (!Number.isSafeInteger(dateEpochMillis)) {
            throw new Error("Invalid transaction date.");
        }
        const payload = {
            amountMinor: input.amountMinor,
            type: input.type,
            categoryId: category.id,
            accountId: account.id,
            dateEpochMillis,
            note: input.note?.trim() ? input.note.trim() : null,
            recurringRuleId: null,
            scheduledDateEpochMillis: null,
            sourceKey: input.sourceKey ?? null,
        };
        const created = await transactionRepo.create(payload);
        await get().refresh();
        return created;
    },
    addSplitTransactions: async (splitInputs, options = {}) => withMutationLock(async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }

        let items = [];
        let explicitGroupTitle = options.groupTitle ?? null;
        let explicitGroupId = options.splitGroupId ?? null;
        let explicitAccountId = options.accountId ?? null;
        let explicitDateEpochMillis = options.dateEpochMillis ?? null;

        if (Array.isArray(splitInputs)) {
            items = splitInputs;
        } else if (splitInputs && typeof splitInputs === "object" && Array.isArray(splitInputs.splits)) {
            items = splitInputs.splits;
            explicitGroupTitle = splitInputs.groupTitle ?? explicitGroupTitle;
            explicitGroupId = splitInputs.splitGroupId ?? explicitGroupId;
            explicitAccountId = splitInputs.accountId ?? explicitAccountId;
            explicitDateEpochMillis = splitInputs.dateEpochMillis ?? explicitDateEpochMillis;
        } else {
            throw new Error("No split transactions provided.");
        }

        if (items.length === 0) {
            throw new Error("No split transactions provided.");
        }

        const { accounts, categories } = get();
        const validatedPayloads = [];

        let resolvedGroupId = explicitGroupId;
        if (!resolvedGroupId) {
            for (const item of items) {
                if (item.splitGroupId) {
                    resolvedGroupId = item.splitGroupId;
                    break;
                }
            }
        }
        if (!resolvedGroupId && items.length >= 2) {
            resolvedGroupId = generateSplitGroupId();
        }

        for (let i = 0; i < items.length; i++) {
            const input = items[i];
            let category;
            if (input.categoryId !== undefined && input.categoryId !== null) {
                category = categories.find((c) => c.id === input.categoryId);
                if (!category) {
                    throw new Error(`Category with ID ${input.categoryId} was not found.`);
                }
                if (input.type && category.type !== input.type) {
                    throw new Error("Transaction type must match category type.");
                }
                if (input.categoryName && category.name.toLowerCase() !== input.categoryName.toLowerCase()) {
                    throw new Error(`Category ID ${input.categoryId} does not match name "${input.categoryName}".`);
                }
            } else if (input.categoryName) {
                category = findCategory(categories, input.categoryName, input.type || "EXPENSE");
            } else {
                throw new Error(`Category is required for split #${i + 1}.`);
            }

            const targetAccountId = input.accountId ?? explicitAccountId;
            const account = targetAccountId === undefined || targetAccountId === null
                ? findAccount(accounts, input.accountType)
                : findActiveAccountById(accounts, targetAccountId);

            const dateEpochMillis = input.dateEpochMillis ?? explicitDateEpochMillis ?? Date.now();
            if (!Number.isSafeInteger(dateEpochMillis)) {
                throw new Error(`Invalid transaction date for split #${i + 1}.`);
            }

            if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
                throw new Error(`Split #${i + 1} must have a positive integer minor amount.`);
            }

            validatedPayloads.push({
                amountMinor: input.amountMinor,
                type: input.type || "EXPENSE",
                categoryId: category.id,
                accountId: account.id,
                dateEpochMillis,
                note: input.note?.trim() ? input.note.trim() : null,
                recurringRuleId: null,
                scheduledDateEpochMillis: null,
                sourceKey: input.sourceKey ?? null,
                splitGroupId: items.length >= 2 ? resolvedGroupId : null,
            });
        }

        let groupTitle = explicitGroupTitle?.trim() || null;
        if (!groupTitle && items.length >= 2) {
            for (const p of validatedPayloads) {
                const parent = extractParentNote(p.note, categories.find((c) => c.id === p.categoryId)?.name);
                if (parent) {
                    groupTitle = parent;
                    break;
                }
            }
        }

        const createdRecords = [];
        await database.transaction(async (transaction) => {
            const transactionRepo = new TransactionRepository(transaction);
            const groupRepo = new TransactionGroupRepository(transaction);

            if (items.length >= 2 && resolvedGroupId) {
                const firstPayload = validatedPayloads[0];
                await groupRepo.create({
                    id: resolvedGroupId,
                    title: groupTitle,
                    accountId: firstPayload.accountId,
                    dateEpochMillis: firstPayload.dateEpochMillis,
                    createdEpochMillis: Date.now(),
                });
            }

            for (const payload of validatedPayloads) {
                const created = await transactionRepo.create(payload);
                createdRecords.push(created);
            }
        });

        await get().refresh();
        createdRecords.splitGroupId = resolvedGroupId;
        createdRecords.transactions = createdRecords;
        return createdRecords;
    }),
    updateSplitTransactionGroup: async (groupId, { title, accountId, dateEpochMillis, splits }) => withMutationLock(async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        if (!groupId) {
            throw new Error("Split group ID is required.");
        }
        if (!Array.isArray(splits) || splits.length === 0) {
            throw new Error("At least one split allocation is required.");
        }

        for (let i = 0; i < splits.length; i++) {
            const s = splits[i];
            if (!Number.isSafeInteger(s.amountMinor) || s.amountMinor <= 0) {
                throw new Error(`Split #${i + 1} must have a positive integer minor amount.`);
            }
        }

        const { accounts, categories } = get();
        const resolvedAccount = accountId !== undefined && accountId !== null
            ? findActiveAccountById(accounts, accountId)
            : null;
        const resolvedDate = dateEpochMillis !== undefined ? dateEpochMillis : null;
        if (resolvedDate !== null && !Number.isSafeInteger(resolvedDate)) {
            throw new Error("Invalid transaction date.");
        }

        await database.transaction(async (tx) => {
            const txRepo = new TransactionRepository(tx);
            const groupRepo = new TransactionGroupRepository(tx);

            const existingGroup = await groupRepo.getById(groupId);
            const existingTxs = await txRepo.listBySplitGroupId(groupId);
            const existingIds = new Set(existingTxs.map((t) => t.id));

            const targetAccountId = resolvedAccount?.id ?? existingGroup?.accountId ?? existingTxs[0]?.accountId;
            const targetDate = resolvedDate ?? existingGroup?.dateEpochMillis ?? existingTxs[0]?.dateEpochMillis ?? Date.now();
            const groupTitle = title !== undefined ? (title?.trim() || null) : (existingGroup?.title ?? null);

            if (splits.length === 1) {
                // Logical transition to a normal single-category transaction
                const singleSplit = splits[0];
                let category;
                if (singleSplit.categoryId !== undefined && singleSplit.categoryId !== null) {
                    category = categories.find((c) => c.id === singleSplit.categoryId);
                } else if (singleSplit.categoryName) {
                    category = findCategory(categories, singleSplit.categoryName, "EXPENSE");
                }
                if (!category) {
                    throw new Error("Valid category is required.");
                }

                const cleanNote = singleSplit.note?.trim()
                    ? stripSplitSuffix(singleSplit.note.trim())
                    : (groupTitle || null);

                let primaryTxId = singleSplit.id && existingIds.has(singleSplit.id)
                    ? singleSplit.id
                    : existingTxs[0]?.id;

                if (primaryTxId) {
                    await txRepo.update(primaryTxId, {
                        amountMinor: singleSplit.amountMinor,
                        categoryId: category.id,
                        accountId: targetAccountId,
                        dateEpochMillis: targetDate,
                        note: cleanNote,
                        splitGroupId: null,
                    });
                    for (const txItem of existingTxs) {
                        if (txItem.id !== primaryTxId) {
                            await txRepo.delete(txItem.id);
                        }
                    }
                } else {
                    await txRepo.create({
                        amountMinor: singleSplit.amountMinor,
                        type: "EXPENSE",
                        categoryId: category.id,
                        accountId: targetAccountId,
                        dateEpochMillis: targetDate,
                        note: cleanNote,
                        splitGroupId: null,
                    });
                }

                if (existingGroup) {
                    await groupRepo.delete(groupId);
                }
            } else {
                // 2 or more splits
                if (existingGroup) {
                    await groupRepo.update(groupId, {
                        title: groupTitle,
                        accountId: targetAccountId,
                        dateEpochMillis: targetDate,
                    });
                } else {
                    await groupRepo.create({
                        id: groupId,
                        title: groupTitle,
                        accountId: targetAccountId,
                        dateEpochMillis: targetDate,
                        createdEpochMillis: Date.now(),
                    });
                }

                const retainedIds = new Set();
                for (let i = 0; i < splits.length; i++) {
                    const split = splits[i];
                    let category;
                    if (split.categoryId !== undefined && split.categoryId !== null) {
                        category = categories.find((c) => c.id === split.categoryId);
                    } else if (split.categoryName) {
                        category = findCategory(categories, split.categoryName, "EXPENSE");
                    }
                    if (!category) {
                        throw new Error(`Category is required for split #${i + 1}.`);
                    }

                    const note = split.note?.trim() ? split.note.trim() : null;

                    if (split.id && existingIds.has(split.id)) {
                        retainedIds.add(split.id);
                        await txRepo.update(split.id, {
                            amountMinor: split.amountMinor,
                            categoryId: category.id,
                            accountId: targetAccountId,
                            dateEpochMillis: targetDate,
                            note,
                            splitGroupId: groupId,
                        });
                    } else {
                        const created = await txRepo.create({
                            amountMinor: split.amountMinor,
                            type: "EXPENSE",
                            categoryId: category.id,
                            accountId: targetAccountId,
                            dateEpochMillis: targetDate,
                            note,
                            splitGroupId: groupId,
                        });
                        retainedIds.add(created.id);
                    }
                }

                for (const txItem of existingTxs) {
                    if (!retainedIds.has(txItem.id)) {
                        await txRepo.delete(txItem.id);
                    }
                }
            }
        });

        await get().refresh();
    }),
    deleteSplitTransactionGroup: async (groupId) => withMutationLock(async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        await database.transaction(async (tx) => {
            const txRepo = new TransactionRepository(tx);
            const groupRepo = new TransactionGroupRepository(tx);
            await txRepo.deleteBySplitGroupId(groupId);
            await groupRepo.delete(groupId);
        });
        await get().refresh();
    }),
    addAccountTransfer: async (input) => withMutationLock(async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        if (input.fromAccountId === input.toAccountId) {
            throw new Error("Choose two different accounts for a transfer.");
        }
        let created;
        await database.transaction(async (transaction) => {
            const transferRepo = new TransferRepository(transaction);
            const existingSourceTransfer = input.sourceKey
                ? await transferRepo.getBySourceKey(input.sourceKey)
                : null;
            created = await transferRepo.create({
                amountMinor: input.amountMinor,
                fromAccountId: input.fromAccountId,
                toAccountId: input.toAccountId,
                dateEpochMillis: input.dateEpochMillis
                    ?? existingSourceTransfer?.dateEpochMillis
                    ?? Date.now(),
                note: input.note?.trim() ? input.note.trim() : null,
                sourceKey: input.sourceKey ?? null,
            });
        });
        await get().refresh();
        return created;
    }),
    updateAccountTransfer: async (id, patch) => withMutationLock(async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const repoPatch = { ...patch };
        if (patch.note !== undefined) {
            repoPatch.note = patch.note?.trim() ? patch.note.trim() : null;
        }
        let updated;
        await database.transaction(async (transaction) => {
            updated = await new TransferRepository(transaction).update(Number(id), repoPatch);
        });
        if (updated === null) {
            throw new Error("Account transfer not found.");
        }
        await get().refresh();
        return updated;
    }),
    deleteAccountTransferById: async (id) => withMutationLock(async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        await new TransferRepository(database).delete(Number(id));
        await get().refresh();
    }),
    saveOnboardingExpense: async (input) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const existing = await new TransactionRepository(database).getBySourceKey(ONBOARDING_FIRST_TRANSACTION_SOURCE_KEY);
        if (existing !== null) {
            // A user can go back from the lock step or retry after a committed-but-unconfirmed write.
            return get().updateTransaction(existing.id, {
                accountId: input.accountId,
                amountMinor: input.amountMinor,
                categoryName: input.categoryName,
                note: input.note,
                type: "EXPENSE",
            });
        }
        return get().addTransaction({ ...input, sourceKey: ONBOARDING_FIRST_TRANSACTION_SOURCE_KEY, type: "EXPENSE" });
    },
    updateTransaction: async (id, patch) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const numericId = Number(id);
        const existing = get().transactions.find((tx) => tx.id === numericId)
            ?? (await new TransactionRepository(database).getById(numericId));
        if (!existing) {
            throw new Error("Transaction not found.");
        }
        if (existing.scheduledDateEpochMillis !== null || existing.recurringRuleId !== null) {
            if (patch.dateEpochMillis !== undefined && patch.dateEpochMillis !== existing.dateEpochMillis) {
                throw new Error("Cannot change the scheduled date of a recurring transaction occurrence.");
            }
        }
        const targetType = patch.type ?? existing.type;
        const repoPatch = {};
        if (patch.amountMinor !== undefined) {
            if (!Number.isInteger(patch.amountMinor) || patch.amountMinor <= 0) {
                throw new Error("Amount must be greater than zero.");
            }
            repoPatch.amountMinor = patch.amountMinor;
        }
        if (patch.type !== undefined) {
            repoPatch.type = patch.type;
        }
        if (patch.categoryName !== undefined) {
            const category = findCategory(get().categories, patch.categoryName, targetType);
            repoPatch.categoryId = category.id;
        } else if (patch.categoryId !== undefined) {
            const targetCat = get().categories.find((c) => c.id === patch.categoryId);
            if (targetCat && targetCat.type !== targetType) {
                throw new TypeError("Transaction type must match the category type.");
            }
            repoPatch.categoryId = patch.categoryId;
        } else if (patch.type !== undefined && patch.type !== existing.type) {
            const existingCat = get().categories.find((c) => c.id === existing.categoryId);
            if (existingCat?.type !== targetType) {
                const defaultCat = get().categories.find((c) => c.type === targetType);
                if (defaultCat) {
                    repoPatch.categoryId = defaultCat.id;
                }
            }
        }
        if (patch.accountId !== undefined) {
            const account = findActiveAccountById(get().accounts, patch.accountId);
            repoPatch.accountId = account.id;
        }
        if (patch.dateEpochMillis !== undefined) {
            if (!Number.isSafeInteger(patch.dateEpochMillis)) {
                throw new Error("Invalid transaction date.");
            }
            repoPatch.dateEpochMillis = patch.dateEpochMillis;
        }
        if (patch.note !== undefined) {
            repoPatch.note = patch.note?.trim() ? patch.note.trim() : null;
        }
        const updated = await new TransactionRepository(database).update(numericId, repoPatch);
        if (updated === null) {
            throw new Error("Transaction could not be updated.");
        }
        await get().refresh();
        return updated;
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
        let account;
        if (input.accountId !== undefined) {
            account = get().accounts.find((a) => a.id === input.accountId && !a.isArchived);
            if (!account) {
                throw new Error("Selected account not found or archived.");
            }
        } else {
            account = findAccount(get().accounts, input.accountType ?? "CASH");
        }
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
        try {
            const created = await new CategoryRepository(database).create({
                name,
                icon: input.icon?.trim() || "pricetag",
                colorHex: input.colorHex ?? (input.type === "INCOME" ? "#15803D" : "#64748B"),
                type: input.type,
                isCustom: true,
            });
            await get().refresh();
            return created;
        } catch (error) {
            if (error && (String(error.message).includes("UNIQUE constraint failed") || String(error.message).includes("already exists"))) {
                await get().refresh();
                const matched = get().categories.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.type === input.type);
                if (matched) return matched;
            }
            throw error;
        }
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
        return withMutationLock(async () => {
            await get().ensureHydrated();
            const database = databaseRef;
            if (database === null) {
                throw new Error("Database is not ready.");
            }
            await database.transaction(async (tx) => {
                const repos = repositories(tx);
                const [transactions, budgets, recurringRules] = await Promise.all([
                    repos.transactions.list(),
                    repos.budgets.list(),
                    repos.recurring.list(),
                ]);
                const guard = canDeleteCategory(id, {
                    transactions,
                    budgets,
                    recurringRules,
                });
                if (!guard.ok) {
                    throw new Error(guard.reason);
                }
                await repos.categories.delete(id);
            });
            await safeRefreshAfterCommit(get, set);
        });
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
        const accountRepo = new AccountRepository(database);
        if (input.reuseExistingType === true) {
            const durableAccounts = await accountRepo.list();
            const existing = durableAccounts.find((account) => account.type === input.type && !account.isArchived)
                ?? durableAccounts.find((account) => account.type === input.type);
            if (existing !== undefined) {
                const reconciled = await accountRepo.update(existing.id, {
                    isArchived: false,
                    name,
                    startingBalanceMinor: input.startingBalanceMinor ?? 0,
                });
                if (reconciled === null) {
                    throw new Error("Account could not be reconciled.");
                }
                await get().refresh();
                return reconciled;
            }
        }
        const created = await accountRepo.create({
            name,
            type: input.type,
            startingBalanceMinor: input.startingBalanceMinor ?? 0,
            isArchived: false,
        });
        await get().refresh();
        return created;
    },
    deleteAccount: async (id) => {
        return withMutationLock(async () => {
            await get().ensureHydrated();
            const database = databaseRef;
            if (database === null) {
                throw new Error("Database is not ready.");
            }
            await database.transaction(async (tx) => {
                const repos = repositories(tx);
                const [accounts, transactions, recurringRules, transfers] = await Promise.all([
                    repos.accounts.list(),
                    repos.transactions.list(),
                    repos.recurring.list(),
                    repos.transfers.list(),
                ]);
                const guard = canDeleteAccount(id, {
                    accounts,
                    transactions,
                    recurringRules,
                    transfers,
                });
                if (!guard.ok) {
                    throw new Error(guard.reason);
                }
                await repos.accounts.delete(id);
            });
            await safeRefreshAfterCommit(get, set);
        });
    },
    /**
     * Hide an account without touching its history. Unlike delete, this is allowed for
     * accounts that already have transactions -- that is the whole point of archiving.
     */
    archiveAccount: async (id) => {
        return withMutationLock(async () => {
            await get().ensureHydrated();
            const database = databaseRef;
            if (database === null) {
                throw new Error("Database is not ready.");
            }
            await database.transaction(async (tx) => {
                const repos = repositories(tx);
                const accounts = await repos.accounts.list();
                const guard = canArchiveAccount(id, { accounts });
                if (!guard.ok) {
                    throw new Error(guard.reason);
                }
                const updated = await repos.accounts.update(id, { isArchived: true });
                if (updated === null) {
                    throw new Error("Account could not be archived.");
                }
                await tx.execute("UPDATE recurring_rules SET is_active = 0 WHERE account_id = ?", [id]);
            });
            await safeRefreshAfterCommit(get, set);
            const updated = get().accounts.find((a) => a.id === id);
            return updated;
        });
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
        const existing = get().recurringRules.find((r) => r.id === id);
        let finalPatch = { ...patch };
        if (existing) {
            const now = Date.now();
            const frequency = patch.frequency ?? existing.frequency;
            const anchorDay = patch.anchorDay ?? existing.anchorDay ?? new Date(existing.nextRunEpochMillis).getDate();
            let nextRun = patch.nextRunEpochMillis ?? existing.nextRunEpochMillis;

            if (patch.isActive === false || patch.isActive === 0) {
                while (nextRun <= now) {
                    nextRun = advanceNextRunEpochMillis(nextRun, frequency, anchorDay);
                }
                finalPatch.nextRunEpochMillis = nextRun;
            } else if (patch.isActive === true || patch.isActive === 1) {
                while (nextRun <= now) {
                    nextRun = advanceNextRunEpochMillis(nextRun, frequency, anchorDay);
                }
                finalPatch.nextRunEpochMillis = nextRun;
            }
        }
        const updated = await new RecurringRepository(database).update(id, finalPatch);
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
     * Auto-creates missing categories after every source account is explicitly resolved.
     * (or a number for older callers that only read the created count).
     * @param {Array<{ dateEpochMillis: number, type: string, amountMinor: number, categoryName: string, accountLabel: string, accountKey?: string, accountType: string|null, note: string|null, sourceKey?: string }>} rows
     * @param {{ skipped?: Array<{ rowNumber: number, reason: string }>, accountResolutions?: Record<string, { kind: 'existing', accountId: number }|{ kind: 'create', name: string, type: string }> }} [meta]
     */
    importCsvRows: async (rows, meta = {}) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const skipped = Array.isArray(meta.skipped) ? [...meta.skipped] : [];
        if (rows.length === 0) {
            return { created: 0, reconciled: 0, skipped: skipped.length, skippedRows: skipped };
        }

        // Read durable state instead of relying on a possibly stale UI snapshot after an interrupted refresh.
        const currentAccounts = await new AccountRepository(database).list();
        const currentCategories = await new CategoryRepository(database).list();
        const accountResolutions = meta.accountResolutions
            ?? buildAutomaticAccountResolutions(rows, currentAccounts);
        const unresolved = unresolvedImportAccountSources(rows, accountResolutions);
        if (unresolved.length > 0) {
            throw new Error(`Resolve imported account "${unresolved[0].label}" before confirming the import.`);
        }
        const activeAccounts = currentAccounts.filter((account) => !account.isArchived);
        for (const source of listImportAccountSources(rows)) {
            const resolution = accountResolutions[source.key];
            if (resolution.kind === "existing") {
                if (!activeAccounts.some((account) => account.id === resolution.accountId)) {
                    throw new Error(`The selected account for "${source.label}" is unavailable or archived.`);
                }
                continue;
            }
            const name = String(resolution.name ?? "").trim();
            if (name.length === 0 || !ACCOUNT_TYPES.includes(resolution.type)) {
                throw new Error(`Choose a valid account name and type for "${source.label}".`);
            }
        }

        let createdCount = 0;
        let reconciledCount = 0;
        await database.transaction(async (tx) => {
            const categoryCache = new Map(
                currentCategories.map((category) => [`${category.type}:${category.name.toLowerCase()}`, category]),
            );
            const accountCache = new Map();
            const transactionRepo = new TransactionRepository(tx);
            const seenSourceKeys = new Set();

            const insertReturningId = async (statement, parameters) => {
                const result = await tx.execute(statement, parameters);
                if (result.insertId !== undefined && Number.isSafeInteger(result.insertId) && result.insertId > 0) {
                    return result.insertId;
                }
                throw new Error("Import could not read inserted row ids.");
            };

            for (const row of rows) {
                if (row.sourceKey) {
                    if (seenSourceKeys.has(row.sourceKey)) {
                        skipped.push({ rowNumber: row.sourceRowNumber ?? 0, reason: "This import contains the same source row more than once." });
                        continue;
                    }
                    seenSourceKeys.add(row.sourceKey);
                    const previous = await transactionRepo.getBySourceKey(row.sourceKey);
                    if (previous !== null) {
                        const category = currentCategories.find((item) => item.id === previous.categoryId);
                        const account = currentAccounts.find((item) => item.id === previous.accountId);
                        const resolution = accountResolutions[row.accountKey || importAccountKey(row.accountLabel)];
                        const sameAccount = resolution.kind === "existing"
                            ? resolution.accountId === previous.accountId
                            : account?.name.toLocaleLowerCase() === resolution.name.trim().toLocaleLowerCase()
                                && account?.type === resolution.type;
                        const unchanged = sameAccount && previous.type === row.type
                            && previous.amountMinor === row.amountMinor
                            && previous.dateEpochMillis === row.dateEpochMillis
                            && previous.note === (row.note ?? null)
                            && category?.name.toLocaleLowerCase() === row.categoryName.toLocaleLowerCase();
                        if (unchanged) {
                            reconciledCount += 1;
                        }
                        else {
                            skipped.push({ rowNumber: row.sourceRowNumber ?? 0, reason: "This imported transaction was edited after import; the existing version was kept." });
                        }
                        continue;
                    }
                }
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

                const accountKey = row.accountKey || importAccountKey(row.accountLabel);
                const resolution = accountResolutions[accountKey];
                let account = accountCache.get(accountKey);
                if (account === undefined) {
                    if (resolution.kind === "existing") {
                        account = activeAccounts.find((candidate) => candidate.id === resolution.accountId);
                    }
                    else {
                        const accountName = resolution.name.trim();
                        // A post-commit refresh failure can leave Zustand stale. Reuse the durable
                        // account created by the prior attempt before creating another one.
                        account = activeAccounts.find((candidate) => candidate.type === resolution.type
                            && candidate.name.toLocaleLowerCase() === accountName.toLocaleLowerCase());
                        if (account === undefined) {
                            const accountId = await insertReturningId(
                                `INSERT INTO accounts (name, type, starting_balance_minor, is_archived)
                 VALUES (?, ?, ?, 0)`,
                                [accountName, resolution.type, 0],
                            );
                            account = {
                                id: accountId,
                                name: accountName,
                                type: resolution.type,
                                startingBalanceMinor: 0,
                                isArchived: false,
                            };
                            activeAccounts.push(account);
                        }
                    }
                    accountCache.set(accountKey, account);
                }

                await transactionRepo.create({
                    amountMinor: row.amountMinor,
                    type: row.type,
                    categoryId: category.id,
                    accountId: account.id,
                    dateEpochMillis: row.dateEpochMillis,
                    note: row.note,
                    recurringRuleId: null,
                    scheduledDateEpochMillis: null,
                    sourceKey: row.sourceKey ?? null,
                });
                createdCount += 1;
            }
        });

        const summary = {
            created: createdCount,
            reconciled: reconciledCount,
            skipped: skipped.length,
            skippedRows: skipped,
        };
        try {
            await get().refresh();
        }
        catch (error) {
            const refreshError = new Error("The import was committed, but the refreshed ledger could not be displayed. Retrying this same import will reconcile the committed rows safely.");
            refreshError.code = "IMPORT_COMMITTED_REFRESH_FAILED";
            refreshError.cause = error;
            refreshError.summary = summary;
            throw refreshError;
        }
        // Number-like for callers that only display the created count.
        summary.valueOf = () => createdCount;
        return summary;
    },
    restoreBackup: async (backup, { recordRecovery = true } = {}) => {
        // Reject corrupt links/duplicate identities before the replacement transaction starts.
        validateBackup(backup);
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const serialized = serializeBackup(backup);
        if (inFlightRestorePromise !== null && inFlightRestoreSerialized === serialized) {
            return inFlightRestorePromise;
        }
        inFlightRestoreSerialized = serialized;
        inFlightRestorePromise = (async () => {
            try {
                const insertReturningId = async (tx, statement, parameters) => {
                    const result = await tx.execute(statement, parameters);
                    if (result.insertId !== undefined &&
                        Number.isSafeInteger(result.insertId) &&
                        result.insertId > 0) {
                        return result.insertId;
                    }
                    throw new Error("Backup restore could not read inserted row ids.");
                };
                await database.transaction(async (tx) => {
                    if (recordRecovery) {
                        const currentRepos = repositories(tx);
                        const recoveryBackup = buildBackup({
                            accounts: await currentRepos.accounts.list(),
                            categories: await currentRepos.categories.list(),
                            transactions: await currentRepos.transactions.list(),
                            transactionGroups: await currentRepos.transactionGroups.list(),
                            transfers: await currentRepos.transfers.list(),
                            budgets: await currentRepos.budgets.list(),
                            recurringRules: await currentRepos.recurring.list(),
                            goals: await currentRepos.goals.list(),
                        });
                        await tx.execute(`INSERT OR IGNORE INTO restore_recovery_snapshot (id, backup_json, created_epoch_millis)
                      VALUES (1, ?, ?)`, [
                            serializeBackup(recoveryBackup),
                            Date.now(),
                        ]);
                    }
                    else {
                        // Consume the undo slot inside the replacement transaction, so a second undo cannot redo it.
                        await tx.execute("DELETE FROM restore_recovery_snapshot WHERE id = 1");
                    }
            await tx.execute("DELETE FROM transactions");
            await tx.execute("DELETE FROM transaction_groups");
            await tx.execute("DELETE FROM account_transfers");
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
            for (const transfer of backup.transfers ?? []) {
                const fromAccountId = accountIdMap.get(transfer.fromAccountId);
                const toAccountId = accountIdMap.get(transfer.toAccountId);
                if (fromAccountId === undefined || toAccountId === undefined) {
                    throw new Error("Backup transfer references could not be restored.");
                }
                await tx.execute(`INSERT INTO account_transfers (
              amount_minor, from_account_id, to_account_id, date_epoch_millis, note, source_key
            ) VALUES (?, ?, ?, ?, ?, ?)`, [
                    transfer.amountMinor,
                    fromAccountId,
                    toAccountId,
                    transfer.dateEpochMillis,
                    transfer.note,
                    transfer.sourceKey ?? null,
                ]);
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
                    throw new Error("Backup recurring rule references could not be restored.");
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
            const groupIdMap = new Map();
            for (const group of backup.transactionGroups ?? []) {
                const accountId = accountIdMap.get(group.accountId);
                if (accountId !== undefined) {
                    await tx.execute(
                        `INSERT INTO transaction_groups (id, title, account_id, date_epoch_millis, created_epoch_millis)
                         VALUES (?, ?, ?, ?, ?)`,
                        [group.id, group.title ?? null, accountId, group.dateEpochMillis, group.createdEpochMillis ?? Date.now()]
                    );
                    groupIdMap.set(group.id, group.id);
                }
            }
            for (const transaction of backup.transactions) {
                const categoryId = categoryIdMap.get(transaction.categoryId);
                const accountId = accountIdMap.get(transaction.accountId);
                if (categoryId === undefined || accountId === undefined) {
                    throw new Error("Backup transaction references could not be restored.");
                }
                const recurringRuleId = transaction.recurringRuleId === null
                    ? null
                    : (recurringIdMap.get(transaction.recurringRuleId) ?? null);
                const splitGroupId = transaction.splitGroupId
                    ? (groupIdMap.get(transaction.splitGroupId) ?? transaction.splitGroupId)
                    : null;
                await tx.execute(`INSERT INTO transactions (
             amount_minor, type, category_id, account_id, date_epoch_millis, note, recurring_rule_id,
             scheduled_date_epoch_millis, source_key, split_group_id
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    transaction.amountMinor,
                    transaction.type,
                    categoryId,
                    accountId,
                    transaction.dateEpochMillis,
                    transaction.note,
                    recurringRuleId,
                    transaction.scheduledDateEpochMillis
                        ?? (recurringRuleId === null ? null : transaction.dateEpochMillis),
                    transaction.sourceKey ?? null,
                    splitGroupId,
                ]);
            }
            for (const budget of backup.budgets) {
                const categoryId = categoryIdMap.get(budget.categoryId);
                if (categoryId === undefined) {
                    throw new Error("Backup budget references could not be restored.");
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
        try {
            await get().refresh();
                    set({ refreshPending: false });
                }
                catch (error) {
                    set({ refreshPending: true });
                    const refreshError = new Error("The backup was restored, but the refreshed ledger could not be displayed. Retry the ledger refresh or undo this restore; do not apply the backup again.");
                    refreshError.code = "RESTORE_COMMITTED_REFRESH_FAILED";
                    refreshError.cause = error;
                    throw refreshError;
                }
            } finally {
                inFlightRestorePromise = null;
                inFlightRestoreSerialized = null;
            }
        })();
        return inFlightRestorePromise;
    },
    undoLastRestore: async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const result = await database.execute("SELECT backup_json FROM restore_recovery_snapshot WHERE id = 1");
        const serialized = result.rows[0]?.backup_json;
        if (typeof serialized !== "string") {
            throw new Error("No restore recovery snapshot is available.");
        }
        await get().restoreBackup(parseBackup(serialized), { recordRecovery: false });
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
    deleteTransactionById: async (id) => withMutationLock(async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const numericId = Number(id);
        await database.transaction(async (tx) => {
            const txRepo = new TransactionRepository(tx);
            const groupRepo = new TransactionGroupRepository(tx);
            const existing = await txRepo.getById(numericId);
            if (!existing) {
                return;
            }
            const splitGroupId = existing.splitGroupId;
            await txRepo.delete(numericId);
            if (splitGroupId) {
                const siblings = await txRepo.listBySplitGroupId(splitGroupId);
                if (siblings.length === 1) {
                    const remaining = siblings[0];
                    const cleanNote = stripSplitSuffix(remaining.note);
                    await txRepo.update(remaining.id, {
                        splitGroupId: null,
                        note: cleanNote,
                    });
                    await groupRepo.delete(splitGroupId);
                } else if (siblings.length === 0) {
                    await groupRepo.delete(splitGroupId);
                }
            }
        });
        await get().refresh();
    }),
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
    loadBudgetTemplates: async () => {
        await get().ensureHydrated();
        const database = databaseRef;
        const templates = await getActiveBudgetTemplates({ database });
        set({ budgetTemplates: templates });
        return templates;
    },
    saveBudgetTemplate: async (template) => {
        await get().ensureHydrated();
        const database = databaseRef;
        const result = await persistBudgetTemplate(template, { database });
        if (!result.success) {
            throw new Error(result.error || "Failed to save template.");
        }
        const updatedList = await getActiveBudgetTemplates({ database });
        set({ budgetTemplates: updatedList });
        return result.template;
    },
    duplicateBudgetTemplate: async (templateId, customName) => {
        await get().ensureHydrated();
        const database = databaseRef;
        const duplicated = await persistDuplicateBudgetTemplate(templateId, customName, { database });
        if (!duplicated) {
            throw new Error("Failed to duplicate template.");
        }
        const updatedList = await getActiveBudgetTemplates({ database });
        set({ budgetTemplates: updatedList });
        return duplicated;
    },
    deleteBudgetTemplate: async (templateId) => {
        await get().ensureHydrated();
        const database = databaseRef;
        const deleted = await persistDeleteBudgetTemplate(templateId, { database });
        if (!deleted) {
            throw new Error("Cannot delete this template. System presets cannot be deleted.");
        }
        const updatedList = await getActiveBudgetTemplates({ database });
        set({ budgetTemplates: updatedList });
        return true;
    },
    restoreBudgetTemplate: async (templateId) => {
        await get().ensureHydrated();
        const database = databaseRef;
        const restored = await persistRestoreBudgetTemplate(templateId, { database });
        if (!restored) {
            throw new Error("Failed to restore system template.");
        }
        const updatedList = await getActiveBudgetTemplates({ database });
        set({ budgetTemplates: updatedList });
        return restored;
    },
    applyBudgetTemplate: async ({ templateId, monthYear }) => {
        await get().ensureHydrated();
        const database = databaseRef;
        if (database === null) {
            throw new Error("Database is not ready.");
        }
        const templates = get().budgetTemplates.length > 0
            ? get().budgetTemplates
            : await getActiveBudgetTemplates({ database });
        const target = templates.find((t) => t.id === templateId);
        if (!target) {
            throw new Error(`Budget template "${templateId}" was not found.`);
        }

        const targetMonthYear = monthYear ?? get().selectedMonthYear;
        const appliedCategories = [];
        let totalMinor = 0;

        for (const cat of target.categories) {
            const catName = cat.name?.trim();
            if (!catName) continue;
            const templateMinor = Number(cat.amountMinor ?? cat.limitMinor ?? 0);
            const limitMinor = target.period === "SEMESTER"
                ? Math.round(templateMinor / 5)
                : templateMinor;
            if (limitMinor <= 0) continue;

            const icon = cat.icon ?? cat.emoji ?? "📊";
            await get().addCategory({ name: catName, type: "EXPENSE", icon });
            await get().addBudget({ categoryName: catName, limitMinor, monthYear: targetMonthYear });
            appliedCategories.push({ name: catName, limitMinor, icon });
            totalMinor += limitMinor;
        }

        await get().refresh();
        return { template: target, appliedCategories, totalMinor, monthYear: targetMonthYear };
    },
}));
export function listAccountChips(accounts) {
    const emojiByType = { CASH: "💵", CARD: "💳", EWALLET: "📱" };
    return accounts
        .filter((account) => !account.isArchived)
        .sort((left, right) => left.id - right.id)
        .map((account) => ({
            id: account.id,
            type: account.type,
            label: `${emojiByType[account.type] ?? "🏦"} ${account.name}`,
        }));
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
