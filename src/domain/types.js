/**
 * @typedef {'CASH' | 'CARD' | 'EWALLET'} AccountType
 * @typedef {'EXPENSE' | 'INCOME'} TransactionType
 * @typedef {'DAILY' | 'WEEKLY' | 'MONTHLY'} RecurringFrequency
 *
 * @typedef {Object} Account
 * @property {number} id
 * @property {string} name
 * @property {AccountType} type
 * @property {number} startingBalanceMinor
 * @property {boolean} isArchived
 *
 * @typedef {Omit<Account, 'id'>} NewAccount
 * @typedef {Partial<NewAccount>} AccountUpdate
 *
 * @typedef {Object} Category
 * @property {number} id
 * @property {string} name
 * @property {string} icon
 * @property {string} colorHex
 * @property {TransactionType} type
 * @property {boolean} isCustom
 *
 * @typedef {Omit<Category, 'id'>} NewCategory
 * @typedef {Partial<NewCategory>} CategoryUpdate
 *
 * @typedef {Object} Transaction
 * @property {number} id
 * @property {number} amountMinor
 * @property {TransactionType} type
 * @property {number} categoryId
 * @property {number} accountId
 * @property {number} dateEpochMillis
 * @property {string | null} note
 * @property {number | null} recurringRuleId
 *
 * @typedef {Omit<Transaction, 'id'>} NewTransaction
 * @typedef {Partial<NewTransaction>} TransactionUpdate
 *
 * @typedef {Object} Budget
 * @property {number} id
 * @property {number} categoryId
 * @property {string} monthYear
 * @property {number} limitMinor
 *
 * @typedef {Omit<Budget, 'id'>} NewBudget
 * @typedef {Partial<NewBudget>} BudgetUpdate
 *
 * @typedef {Object} RecurringRule
 * @property {number} id
 * @property {number} amountMinor
 * @property {TransactionType} type
 * @property {number} categoryId
 * @property {number} accountId
 * @property {string | null} note
 * @property {RecurringFrequency} frequency
 * @property {number} nextRunEpochMillis
 * @property {boolean} isActive
 * @property {boolean} reminderEnabled
 * @property {number} reminderLeadDays
 * @property {string | null} [icon] custom emoji for display
 *
 * @typedef {Omit<RecurringRule, 'id'>} NewRecurringRule
 * @typedef {Partial<NewRecurringRule>} RecurringRuleUpdate
 */

/** @type {readonly AccountType[]} */
export const ACCOUNT_TYPES = Object.freeze(["CASH", "CARD", "EWALLET"]);

/** @type {readonly TransactionType[]} */
export const TRANSACTION_TYPES = Object.freeze(["EXPENSE", "INCOME"]);

/** @type {readonly RecurringFrequency[]} */
export const RECURRING_FREQUENCIES = Object.freeze(["DAILY", "WEEKLY", "MONTHLY"]);
