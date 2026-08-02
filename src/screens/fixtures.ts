import type { TransactionType } from "../domain/types";
import type { BudgetCardProps, BudgetState } from "../components/BudgetCard";

export interface UiTransaction {
  readonly amountMinor: number;
  readonly emoji: string;
  readonly id: string;
  readonly meta: string;
  readonly title: string;
  readonly type: TransactionType;
}

export interface HistoryGroup {
  readonly id: string;
  readonly label: string;
  readonly transactions: readonly UiTransaction[];
}

export interface BudgetSnapshot {
  readonly limitMinor: number;
  readonly name: string;
  readonly percent: number;
  readonly spentMinor: number;
  readonly state: BudgetState;
}

export interface RecurringBillFixture {
  readonly amountMinor: number;
  readonly due: string;
  readonly emoji: string;
  readonly id: string;
  readonly leadDays: number;
  readonly name: string;
}

export interface SmartTipFixture {
  readonly emoji: string;
  readonly id: string;
  readonly meta: UiCopy;
  readonly tag: UiCopy;
  readonly title: UiCopy;
}

export type UiCopy =
  | string
  | {
      readonly after: string;
      readonly amountMinor: number;
      readonly before: string;
      readonly approximate?: boolean;
    };

// Every amount below is an integer minor-unit fixture; no screen owns decimal money.
export const dashboardTotals = {
  balanceMinor: 4_285_000,
  expenseMinor: 2_215_000,
  incomeMinor: 6_500_000,
} as const;

export const recentTransactions: readonly UiTransaction[] = [
  {
    id: "recent-lunch",
    emoji: "🍜",
    title: "Lunch — Jollibee",
    meta: "Food · Cash",
    amountMinor: 18_500,
    type: "EXPENSE",
  },
  {
    id: "recent-commute",
    emoji: "🚌",
    title: "Commute",
    meta: "Transport · E-wallet",
    amountMinor: 4_500,
    type: "EXPENSE",
  },
  {
    id: "recent-salary",
    emoji: "💼",
    title: "Salary",
    meta: "Income · Card",
    amountMinor: 3_250_000,
    type: "INCOME",
  },
] as const;

export const budgetSnapshots: readonly BudgetSnapshot[] = [
  { name: "Food", spentMinor: 940_000, limitMinor: 1_200_000, percent: 78, state: "warning" },
  { name: "Transport", spentMinor: 285_000, limitMinor: 400_000, percent: 71, state: "normal" },
] as const;

export const historyGroups: readonly HistoryGroup[] = [
  {
    id: "today",
    label: "Today — Jul 16",
    transactions: [recentTransactions[0]!, recentTransactions[1]!],
  },
  {
    id: "yesterday",
    label: "Yesterday — Jul 15",
    transactions: [
      {
        id: "history-meralco",
        emoji: "🧾",
        title: "Meralco Bill",
        meta: "Bills · Card",
        amountMinor: 234_000,
        type: "EXPENSE",
      },
      recentTransactions[2]!,
    ],
  },
  {
    id: "jul-14",
    label: "Jul 14",
    transactions: [
      {
        id: "history-uniqlo",
        emoji: "🛍️",
        title: "Uniqlo",
        meta: "Shopping · Card",
        amountMinor: 129_000,
        type: "EXPENSE",
      },
      {
        id: "history-drug",
        emoji: "💊",
        title: "Mercury Drug",
        meta: "Health · Cash",
        amountMinor: 41_000,
        type: "EXPENSE",
      },
    ],
  },
] as const;

export const budgetCards: readonly BudgetCardProps[] = [
  { emoji: "🍜", name: "Food", spentMinor: 1_056_000, limitMinor: 1_200_000, percent: 88, state: "warning" },
  { emoji: "🛍️", name: "Shopping", spentMinor: 473_000, limitMinor: 400_000, percent: 118, state: "over" },
  { emoji: "🚌", name: "Transport", spentMinor: 285_000, limitMinor: 400_000, percent: 71, state: "normal" },
  { emoji: "🧾", name: "Bills", spentMinor: 234_000, limitMinor: 500_000, percent: 47, state: "normal" },
] as const;

export const recurringBills: readonly RecurringBillFixture[] = [
  { id: "internet", emoji: "🌐", name: "Internet", due: "Jul 26", amountMinor: 100_000, leadDays: 10 },
  { id: "rent", emoji: "🏠", name: "Rent", due: "Aug 1", amountMinor: 800_000, leadDays: 7 },
  { id: "netflix", emoji: "📺", name: "Netflix", due: "Jul 20", amountMinor: 54_900, leadDays: 3 },
  { id: "water", emoji: "💧", name: "Water", due: "Jul 28", amountMinor: 35_000, leadDays: 5 },
] as const;

export const smartTips: readonly SmartTipFixture[] = [
  {
    id: "lugaw",
    emoji: "🍜",
    title: "Lugaw + egg",
    meta: { before: "", amountMinor: 4_500, after: " · fits your daily food budget" },
    tag: "-70% vs eating out",
  },
  {
    id: "carinderia",
    emoji: "🍚",
    title: "Carinderia rice meal",
    meta: { before: "", amountMinor: 7_000, after: " · popular & filling near campus" },
    tag: "Budget pick",
  },
  {
    id: "coffee",
    emoji: "☕",
    title: { before: "Skip the daily ", amountMinor: 15_000, after: " coffee" },
    meta: "Brew at home instead",
    tag: { before: "Save ", amountMinor: 60_000, after: "/mo" },
  },
  {
    id: "cook",
    emoji: "🛒",
    title: "Cook 3 meals at home",
    meta: { before: "", amountMinor: 20_000, after: " total ingredients", approximate: true },
    tag: { before: "vs ", amountMinor: 45_000, after: " takeout" },
  },
] as const;
