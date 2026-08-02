// Every amount below is an integer minor-unit fixture; no screen owns decimal money.
export const dashboardTotals = {
    balanceMinor: 4_285_000,
    expenseMinor: 2_215_000,
    incomeMinor: 6_500_000,
};
export const recentTransactions = [
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
];
export const budgetSnapshots = [
    { name: "Food", spentMinor: 940_000, limitMinor: 1_200_000, percent: 78, state: "warning" },
    { name: "Transport", spentMinor: 285_000, limitMinor: 400_000, percent: 71, state: "normal" },
];
export const historyGroups = [
    {
        id: "today",
        label: "Today — Jul 16",
        transactions: [recentTransactions[0], recentTransactions[1]],
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
            recentTransactions[2],
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
];
export const budgetCards = [
    { emoji: "🍜", name: "Food", spentMinor: 1_056_000, limitMinor: 1_200_000, percent: 88, state: "warning" },
    { emoji: "🛍️", name: "Shopping", spentMinor: 473_000, limitMinor: 400_000, percent: 118, state: "over" },
    { emoji: "🚌", name: "Transport", spentMinor: 285_000, limitMinor: 400_000, percent: 71, state: "normal" },
    { emoji: "🧾", name: "Bills", spentMinor: 234_000, limitMinor: 500_000, percent: 47, state: "normal" },
];
export const recurringBills = [
    { id: "internet", emoji: "🌐", name: "Internet", due: "Jul 26", amountMinor: 100_000, leadDays: 10 },
    { id: "rent", emoji: "🏠", name: "Rent", due: "Aug 1", amountMinor: 800_000, leadDays: 7 },
    { id: "netflix", emoji: "📺", name: "Netflix", due: "Jul 20", amountMinor: 54_900, leadDays: 3 },
    { id: "water", emoji: "💧", name: "Water", due: "Jul 28", amountMinor: 35_000, leadDays: 5 },
];
