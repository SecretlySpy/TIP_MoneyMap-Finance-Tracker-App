import type { BudgetCardProps, BudgetState } from "../../components/BudgetCard";
import type {
  HistoryGroup,
  UiTransaction,
} from "../../screens/fixtures";
import type {
  Account,
  Budget,
  Category,
  RecurringRule,
  Transaction,
  TransactionType,
} from "../types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const CATEGORY_EMOJI: Record<string, string> = {
  Food: "🍜",
  Transport: "🚌",
  School: "📚",
  "Load/Data": "📱",
  Shopping: "🛍️",
  Entertainment: "🎮",
  Fun: "🎮",
  Bills: "🧾",
  Health: "💊",
  Other: "📦",
  Allowance: "💵",
  "Part-time": "💼",
  Scholarship: "🎓",
  Gifts: "🎁",
  Income: "💼",
  Internet: "🌐",
  Rent: "🏠",
  Netflix: "📺",
  Water: "💧",
};

const ACCOUNT_LABEL: Record<Account["type"], string> = {
  CASH: "Cash",
  CARD: "Card",
  EWALLET: "E-wallet",
};

const ACCOUNT_CHIP: Record<Account["type"], string> = {
  CASH: "💵 Cash",
  CARD: "💳 Card",
  EWALLET: "📱 E-wallet",
};

const CHART_COLORS = ["#0F6E5C", "#E8A13D", "#2563EB", "#64748B", "#DB2777", "#7C3AED"] as const;

export function toMonthYear(date: Date = new Date()): string {
  const month = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
  return month;
}

export function formatMonthChip(monthYear: string): string {
  const [yearText, monthText] = monthYear.split("-");
  const monthIndex = Number(monthText) - 1;
  if (!yearText || monthIndex < 0 || monthIndex > 11) {
    return monthYear;
  }
  return `${MONTH_LABELS[monthIndex]} ${yearText}`;
}

export function shiftMonthYear(monthYear: string, delta: number): string {
  const [yearText, monthText] = monthYear.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return monthYear;
  }
  const date = new Date(year, month - 1 + delta, 1);
  return toMonthYear(date);
}

export function categoryEmoji(name: string): string {
  return CATEGORY_EMOJI[name] ?? "📦";
}

export function accountLabel(type: Account["type"]): string {
  return ACCOUNT_LABEL[type];
}

export function accountChipLabel(type: Account["type"]): string {
  return ACCOUNT_CHIP[type];
}

export function transactionInMonth(transaction: Transaction, monthYear: string): boolean {
  const date = new Date(transaction.dateEpochMillis);
  return toMonthYear(date) === monthYear;
}

export function computeDashboardTotals(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  monthYear: string,
): { balanceMinor: number; expenseMinor: number; incomeMinor: number } {
  const starting = accounts
    .filter((account) => !account.isArchived)
    .reduce((sum, account) => sum + account.startingBalanceMinor, 0);

  let lifetimeIncome = 0;
  let lifetimeExpense = 0;
  let monthIncome = 0;
  let monthExpense = 0;

  for (const transaction of transactions) {
    if (transaction.type === "INCOME") {
      lifetimeIncome += transaction.amountMinor;
      if (transactionInMonth(transaction, monthYear)) {
        monthIncome += transaction.amountMinor;
      }
    } else {
      lifetimeExpense += transaction.amountMinor;
      if (transactionInMonth(transaction, monthYear)) {
        monthExpense += transaction.amountMinor;
      }
    }
  }

  return {
    balanceMinor: starting + lifetimeIncome - lifetimeExpense,
    expenseMinor: monthExpense,
    incomeMinor: monthIncome,
  };
}

export function buildUiTransaction(
  transaction: Transaction,
  categoriesById: ReadonlyMap<number, Category>,
  accountsById: ReadonlyMap<number, Account>,
): UiTransaction {
  const category = categoriesById.get(transaction.categoryId);
  const account = accountsById.get(transaction.accountId);
  const categoryName = category?.name ?? "Other";
  const title =
    transaction.note?.trim() ||
    (transaction.type === "INCOME" ? categoryName : categoryName);

  return {
    id: String(transaction.id),
    amountMinor: transaction.amountMinor,
    emoji: categoryEmoji(categoryName),
    meta: `${categoryName} · ${account ? accountLabel(account.type) : "Account"}`,
    title,
    type: transaction.type,
  };
}

export function recentUiTransactions(
  transactions: readonly Transaction[],
  categoriesById: ReadonlyMap<number, Category>,
  accountsById: ReadonlyMap<number, Account>,
  limit = 5,
): UiTransaction[] {
  return [...transactions]
    .sort((left, right) => right.dateEpochMillis - left.dateEpochMillis)
    .slice(0, limit)
    .map((transaction) => buildUiTransaction(transaction, categoriesById, accountsById));
}

export interface SpendingSegmentView {
  readonly color: string;
  readonly label: string;
  readonly percent: number;
  readonly spentMinor: number;
}

export function spendingByCategory(
  transactions: readonly Transaction[],
  categoriesById: ReadonlyMap<number, Category>,
  monthYear: string,
): { segments: SpendingSegmentView[]; totalMinor: number } {
  const spent = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "EXPENSE" || !transactionInMonth(transaction, monthYear)) {
      continue;
    }
    const name = categoriesById.get(transaction.categoryId)?.name ?? "Other";
    spent.set(name, (spent.get(name) ?? 0) + transaction.amountMinor);
  }

  const totalMinor = [...spent.values()].reduce((sum, value) => sum + value, 0);
  if (totalMinor === 0) {
    return { segments: [], totalMinor: 0 };
  }

  const ranked = [...spent.entries()].sort((left, right) => right[1] - left[1]);
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const restTotal = rest.reduce((sum, [, value]) => sum + value, 0);
  const rows =
    restTotal > 0
      ? [...top, ["Other", (top.find(([label]) => label === "Other")?.[1] ?? 0) + restTotal] as const]
      : top;

  const merged = new Map<string, number>();
  for (const [label, value] of rows) {
    merged.set(label, (merged.get(label) ?? 0) + value);
  }

  const segments = [...merged.entries()].map(([label, spentMinor], index) => ({
    color: CHART_COLORS[index % CHART_COLORS.length]!,
    label,
    percent: Math.max(1, Math.round((spentMinor / totalMinor) * 100)),
    spentMinor,
  }));

  const percentSum = segments.reduce((sum, segment) => sum + segment.percent, 0);
  if (segments.length > 0 && percentSum !== 100) {
    segments[0] = {
      ...segments[0]!,
      percent: Math.max(1, segments[0]!.percent + (100 - percentSum)),
    };
  }

  return { segments, totalMinor };
}

export function budgetStateFor(percent: number): BudgetState {
  if (percent >= 100) {
    return "over";
  }
  if (percent >= 80) {
    return "warning";
  }
  return "normal";
}

export function buildBudgetCards(
  budgets: readonly Budget[],
  transactions: readonly Transaction[],
  categoriesById: ReadonlyMap<number, Category>,
  monthYear: string,
): BudgetCardProps[] {
  return budgets
    .filter((budget) => budget.monthYear === monthYear)
    .map((budget) => {
      const category = categoriesById.get(budget.categoryId);
      const spentMinor = transactions
        .filter(
          (transaction) =>
            transaction.type === "EXPENSE" &&
            transaction.categoryId === budget.categoryId &&
            transactionInMonth(transaction, monthYear),
        )
        .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
      const percent =
        budget.limitMinor <= 0 ? 0 : Math.round((spentMinor / budget.limitMinor) * 100);
      const name = category?.name ?? "Budget";
      return {
        emoji: categoryEmoji(name),
        limitMinor: budget.limitMinor,
        name,
        percent,
        spentMinor,
        state: budgetStateFor(percent),
      };
    })
    .sort((left, right) => right.percent - left.percent);
}

export function budgetSummary(cards: readonly BudgetCardProps[]): {
  spentMinor: number;
  limitMinor: number;
} {
  return cards.reduce(
    (summary, card) => ({
      spentMinor: summary.spentMinor + card.spentMinor,
      limitMinor: summary.limitMinor + card.limitMinor,
    }),
    { spentMinor: 0, limitMinor: 0 },
  );
}

function startOfLocalDay(epochMillis: number): number {
  const date = new Date(epochMillis);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function historyGroupLabel(dayStart: number, now = new Date()): string {
  const todayStart = startOfLocalDay(now.getTime());
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const date = new Date(dayStart);
  const month = MONTH_LABELS[date.getMonth()];
  const day = date.getDate();

  if (dayStart === todayStart) {
    return `Today — ${month} ${day}`;
  }
  if (dayStart === yesterdayStart) {
    return `Yesterday — ${month} ${day}`;
  }
  return `${month} ${day}`;
}

export function groupHistory(
  transactions: readonly Transaction[],
  categoriesById: ReadonlyMap<number, Category>,
  accountsById: ReadonlyMap<number, Account>,
  monthYear: string,
  now = new Date(),
): HistoryGroup[] {
  const filtered = transactions
    .filter((transaction) => transactionInMonth(transaction, monthYear))
    .sort((left, right) => right.dateEpochMillis - left.dateEpochMillis);

  const groups = new Map<number, UiTransaction[]>();
  for (const transaction of filtered) {
    const day = startOfLocalDay(transaction.dateEpochMillis);
    const bucket = groups.get(day) ?? [];
    bucket.push(buildUiTransaction(transaction, categoriesById, accountsById));
    groups.set(day, bucket);
  }

  return [...groups.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([dayStart, items]) => ({
      id: String(dayStart),
      label: historyGroupLabel(dayStart, now),
      transactions: items,
    }));
}

export function categoriesForType(
  categories: readonly Category[],
  type: TransactionType,
): Category[] {
  return categories.filter((category) => category.type === type);
}

export interface RecurringBillView {
  readonly amountMinor: number;
  readonly due: string;
  readonly emoji: string;
  readonly id: string;
  readonly leadDays: number;
  readonly name: string;
}

export function buildRecurringBills(
  rules: readonly RecurringRule[],
  categoriesById: ReadonlyMap<number, Category>,
): RecurringBillView[] {
  return rules
    .filter((rule) => rule.isActive)
    .sort((left, right) => left.nextRunEpochMillis - right.nextRunEpochMillis)
    .map((rule) => {
      const category = categoriesById.get(rule.categoryId);
      const name = rule.note?.trim() || category?.name || "Bill";
      const dueDate = new Date(rule.nextRunEpochMillis);
      return {
        id: String(rule.id),
        amountMinor: rule.amountMinor,
        due: `${MONTH_LABELS[dueDate.getMonth()]} ${dueDate.getDate()}`,
        emoji: categoryEmoji(name),
        leadDays: rule.reminderLeadDays,
        name,
      };
    });
}

export function nextReminderPreview(
  bills: readonly RecurringBillView[],
): { title: string; detailAmountMinor: number; dueLabel: string; dailyMinor: number } | null {
  const first = bills[0];
  if (!first) {
    return null;
  }
  const dailyMinor = Math.max(1, Math.ceil(first.amountMinor / Math.max(first.leadDays, 1)));
  return {
    title: `${first.name} bill due in ${first.leadDays} days`,
    detailAmountMinor: first.amountMinor,
    dueLabel: first.due,
    dailyMinor,
  };
}
