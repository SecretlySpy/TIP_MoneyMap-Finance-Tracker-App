export const ACCOUNT_TYPES = ["CASH", "CARD", "EWALLET"] as const;
export const TRANSACTION_TYPES = ["EXPENSE", "INCOME"] as const;
export const RECURRING_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  startingBalanceMinor: number;
  isArchived: boolean;
}

export type NewAccount = Omit<Account, "id">;
export type AccountUpdate = Partial<Omit<Account, "id">>;

export interface Category {
  id: number;
  name: string;
  icon: string;
  colorHex: string;
  type: TransactionType;
  isCustom: boolean;
}

export type NewCategory = Omit<Category, "id">;
export type CategoryUpdate = Partial<Omit<Category, "id">>;

export interface Transaction {
  id: number;
  amountMinor: number;
  type: TransactionType;
  categoryId: number;
  accountId: number;
  dateEpochMillis: number;
  note: string | null;
  recurringRuleId: number | null;
}

export type NewTransaction = Omit<Transaction, "id">;
export type TransactionUpdate = Partial<Omit<Transaction, "id">>;

export interface Budget {
  id: number;
  categoryId: number;
  monthYear: string;
  limitMinor: number;
}

export type NewBudget = Omit<Budget, "id">;
export type BudgetUpdate = Partial<Omit<Budget, "id">>;

export interface RecurringRule {
  id: number;
  amountMinor: number;
  type: TransactionType;
  categoryId: number;
  accountId: number;
  note: string | null;
  frequency: RecurringFrequency;
  nextRunEpochMillis: number;
  isActive: boolean;
  reminderEnabled: boolean;
  reminderLeadDays: number;
}

export type NewRecurringRule = Omit<RecurringRule, "id">;
export type RecurringRuleUpdate = Partial<Omit<RecurringRule, "id">>;
