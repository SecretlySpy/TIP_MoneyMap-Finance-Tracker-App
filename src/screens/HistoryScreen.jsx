import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TransactionRow } from "../components/TransactionRow";
import { MonthChip } from "../components/MonthChip";
import { groupHistory } from "../domain/services/financeView";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
// This branch is shared by the populated and explicit Figma empty-state variants.
export function HistoryBody({ groups, isFiltered = false, onAdd, onClearFilters, onDeleteTransaction }) {
    const theme = useTheme();
    if (groups.length === 0) {
        return (
          <EmptyState
            actionLabel={isFiltered ? "Clear filters" : "+ Add your first transaction"}
            emoji="🧾"
            message={isFiltered
              ? "No transactions match the selected category and account."
              : "Transactions you log will show up here.\nStart by adding your first one."}
            onAction={isFiltered ? onClearFilters : onAdd}
            title={isFiltered ? "No matching transactions" : "No transactions yet"}
          />
        );
    }
    return (<View style={{ gap: theme.spacing.xl }}>
      {groups.map((group) => (<View key={group.id} style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
            {group.label}
          </Text>
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
             {group.transactions.map((transaction) => (
               <Pressable
                 key={transaction.id}
                 accessibilityHint="Long press to delete this transaction"
                 accessibilityRole="button"
                 onLongPress={() => onDeleteTransaction?.(transaction)}
               >
                 <TransactionRow compact {...transaction}/>
               </Pressable>
             ))}
           </SectionCard>
        </View>))}
    </View>);
}
// The history frame combines a fixed header/filter treatment with data-driven groups.
export function HistoryScreen({ navigation }) {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const tabNavigation = navigation.getParent();
    const accounts = useFinanceStore((state) => state.accounts);
    const categories = useFinanceStore((state) => state.categories);
    const transactions = useFinanceStore((state) => state.transactions);
    const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
    const deleteTransactionById = useFinanceStore((state) => state.deleteTransactionById);
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [accountFilter, setAccountFilter] = useState(null);
    const [openFilter, setOpenFilter] = useState(null);
    const { accountsById, categoriesById } = useMemo(() => mapsFromState({ accounts, categories }), [accounts, categories]);
    const filteredTransactions = useMemo(() => {
        return transactions.filter((transaction) => {
            if (categoryFilter !== null) {
                const name = categoriesById.get(transaction.categoryId)?.name;
                if (name !== categoryFilter) {
                    return false;
                }
            }
            if (accountFilter !== null) {
                if (transaction.accountId !== accountFilter) {
                    return false;
                }
            }
            return true;
        });
    }, [transactions, categoryFilter, accountFilter, categoriesById, accountsById]);
    const groups = useMemo(() => groupHistory(filteredTransactions, categoriesById, accountsById, selectedMonthYear), [filteredTransactions, categoriesById, accountsById, selectedMonthYear]);
    const categoryNames = useMemo(() => {
        const names = new Set();
        for (const category of categories) {
            names.add(category.name);
        }
        return [...names].sort((left, right) => left.localeCompare(right));
    }, [categories]);
    const addTransaction = () => tabNavigation?.navigate("Home", { screen: "Entry" });
    const clearFilters = () => {
        setCategoryFilter(null);
        setAccountFilter(null);
        setOpenFilter(null);
    };
    const selectedAccount = accountsById.get(accountFilter);
    const isFiltered = categoryFilter !== null || accountFilter !== null;
    return (<ScreenContainer contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.xl }} testID="history-screen">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
          History
        </Text>
        <Pressable accessibilityRole="button" disabled={!isFiltered} hitSlop={theme.spacing.md} onPress={clearFilters}>
          <Text style={{ color: isFiltered ? theme.colors.primary : theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
            Clear filters
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        <MonthChip />
        <Chip onPress={() => setOpenFilter((current) => current === "category" ? null : "category")} selected={openFilter === "category"} style={{ height: theme.sizes.filterChip }}>
          {categoryFilter === null ? "All categories ▾" : `${categoryFilter} ▾`}
        </Chip>
        <Chip onPress={() => setOpenFilter((current) => current === "account" ? null : "account")} selected={openFilter === "account"} style={{ height: theme.sizes.filterChip }}>
          {selectedAccount === undefined ? "All accounts ▾" : `${selectedAccount.name} ▾`}
        </Chip>
      </View>
      {openFilter === "category" ? (
        <SectionCard style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold }}>Choose category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            <Chip onPress={() => { setCategoryFilter(null); setOpenFilter(null); }} selected={categoryFilter === null}>All categories</Chip>
            {categoryNames.map((name) => (
              <Chip key={name} onPress={() => { setCategoryFilter(name); setOpenFilter(null); }} selected={categoryFilter === name}>{name}</Chip>
            ))}
          </View>
        </SectionCard>
      ) : null}
      {openFilter === "account" ? (
        <SectionCard style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold }}>Choose account</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            <Chip onPress={() => { setAccountFilter(null); setOpenFilter(null); }} selected={accountFilter === null}>All accounts</Chip>
            {accounts.map((account) => (
              <Chip key={account.id} onPress={() => { setAccountFilter(account.id); setOpenFilter(null); }} selected={accountFilter === account.id}>
                {account.name}{account.isArchived ? " (archived)" : ""}
              </Chip>
            ))}
          </View>
        </SectionCard>
      ) : null}
      <HistoryBody
        groups={groups}
        isFiltered={isFiltered}
        onAdd={addTransaction}
        onClearFilters={clearFilters}
        onDeleteTransaction={(transaction) => {
          Alert.alert(
            transaction.title ?? "Transaction",
            "Delete this transaction? This cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  void deleteTransactionById(Number(transaction.id)).catch((error) => {
                    Alert.alert("Delete failed", error instanceof Error ? error.message : "Could not delete.");
                  });
                },
              },
            ],
          );
        }}
      />
    </ScreenContainer>);
}
