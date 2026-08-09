import { categoryEmoji as resolveCategoryEmoji, resolveDisplayEmoji } from "./emoji";

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
];

const ACCOUNT_LABEL = {
    CASH: "Cash",
    CARD: "Card",
    EWALLET: "E-wallet",
};
const ACCOUNT_CHIP = {
    CASH: "💵 Cash",
    CARD: "💳 Card",
    EWALLET: "📱 E-wallet",
};
const CHART_COLORS = ["#0F6E5C", "#E8A13D", "#2563EB", "#64748B", "#DB2777", "#7C3AED"];
export function toMonthYear(date = new Date()) {
    const month = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
    return month;
}
export function formatMonthChip(monthYear) {
    const [yearText, monthText] = monthYear.split("-");
    const monthIndex = Number(monthText) - 1;
    if (!yearText || monthIndex < 0 || monthIndex > 11) {
        return monthYear;
    }
    return `${MONTH_LABELS[monthIndex]} ${yearText}`;
}
export function shiftMonthYear(monthYear, delta) {
    const [yearText, monthText] = monthYear.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return monthYear;
    }
    const date = new Date(year, month - 1 + delta, 1);
    return toMonthYear(date);
}
export function categoryEmoji(name) {
    return resolveCategoryEmoji(name);
}
export function accountLabel(type) {
    return ACCOUNT_LABEL[type];
}
export function accountChipLabel(type) {
    return ACCOUNT_CHIP[type];
}
export function transactionInMonth(transaction, monthYear) {
    const date = new Date(transaction.dateEpochMillis);
    return toMonthYear(date) === monthYear;
}
export function computeDashboardTotals(accounts, transactions, monthYear) {
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
        }
        else {
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
export function buildUiTransaction(transaction, categoriesById, accountsById) {
    const category = categoriesById.get(transaction.categoryId);
    const account = accountsById.get(transaction.accountId);
    const categoryName = category?.name ?? "Other";
    const title = transaction.note?.trim() ||
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
export function recentUiTransactions(transactions, categoriesById, accountsById, limit = 5) {
    return [...transactions]
        .sort((left, right) => right.dateEpochMillis - left.dateEpochMillis)
        .slice(0, limit)
        .map((transaction) => buildUiTransaction(transaction, categoriesById, accountsById));
}
export function spendingByCategory(transactions, categoriesById, monthYear) {
    const spent = new Map();
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
    const rows = restTotal > 0
        ? [...top, ["Other", (top.find(([label]) => label === "Other")?.[1] ?? 0) + restTotal]]
        : top;
    const merged = new Map();
    for (const [label, value] of rows) {
        merged.set(label, (merged.get(label) ?? 0) + value);
    }
    const segments = [...merged.entries()].map(([label, spentMinor], index) => ({
        color: CHART_COLORS[index % CHART_COLORS.length],
        label,
        percent: Math.max(1, Math.round((spentMinor / totalMinor) * 100)),
        spentMinor,
    }));
    const percentSum = segments.reduce((sum, segment) => sum + segment.percent, 0);
    if (segments.length > 0 && percentSum !== 100) {
        segments[0] = {
            ...segments[0],
            percent: Math.max(1, segments[0].percent + (100 - percentSum)),
        };
    }
    return { segments, totalMinor };
}
export function budgetStateFor(percent) {
    if (percent >= 100) {
        return "over";
    }
    if (percent >= 80) {
        return "warning";
    }
    return "normal";
}
export function buildBudgetCards(budgets, transactions, categoriesById, monthYear) {
    return budgets
        .filter((budget) => budget.monthYear === monthYear)
        .map((budget) => {
        const category = categoriesById.get(budget.categoryId);
        const spentMinor = transactions
            .filter((transaction) => transaction.type === "EXPENSE" &&
            transaction.categoryId === budget.categoryId &&
            transactionInMonth(transaction, monthYear))
            .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
        const percent = budget.limitMinor <= 0 ? 0 : Math.round((spentMinor / budget.limitMinor) * 100);
        const name = category?.name ?? "Budget";
        return {
            emoji: resolveDisplayEmoji({ icon: category?.icon, name }),
            limitMinor: budget.limitMinor,
            name,
            percent,
            spentMinor,
            state: budgetStateFor(percent),
        };
    })
        .sort((left, right) => right.percent - left.percent);
}
export function budgetSummary(cards) {
    return cards.reduce((summary, card) => ({
        spentMinor: summary.spentMinor + card.spentMinor,
        limitMinor: summary.limitMinor + card.limitMinor,
    }), { spentMinor: 0, limitMinor: 0 });
}
function startOfLocalDay(epochMillis) {
    const date = new Date(epochMillis);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
function historyGroupLabel(dayStart, now = new Date()) {
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
export function groupHistory(transactions, categoriesById, accountsById, monthYear, now = new Date()) {
    const filtered = transactions
        .filter((transaction) => transactionInMonth(transaction, monthYear))
        .sort((left, right) => right.dateEpochMillis - left.dateEpochMillis);
    const groups = new Map();
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
export function categoriesForType(categories, type) {
    return categories.filter((category) => category.type === type);
}
export function buildRecurringBills(rules, categoriesById) {
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
            emoji: resolveDisplayEmoji({ icon: rule.icon, name }),
            leadDays: rule.reminderLeadDays,
            name,
            nextRunEpochMillis: rule.nextRunEpochMillis,
        };
    });
}
export function nextReminderPreview(bills) {
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
