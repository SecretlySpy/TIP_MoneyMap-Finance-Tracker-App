import { useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { MonthChip } from "../components/MonthChip";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TransactionRow } from "../components/TransactionRow";
import { groupHistory } from "../domain/services/financeView";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

// This branch is shared by the populated and explicit Figma empty-state variants.
export function HistoryBody({
  groups,
  isFiltered = false,
  isSearchActive = false,
  onAdd,
  onClearFilters,
  onClearSearch,
  onDeleteTransaction,
  onSelectTransaction,
  searchQuery = "",
  selectedMonthYear = "",
}) {
  const theme = useTheme();

  if (groups.length === 0) {
    if (isSearchActive && searchQuery.trim().length > 0) {
      return (
        <EmptyState
          actionLabel="Clear search"
          emoji="🔍"
          message={`No transactions matched "${searchQuery.trim()}" in ${selectedMonthYear}. Try checking for typos, selecting another month, or clearing your search.`}
          onAction={onClearSearch}
          title="No transactions found"
        />
      );
    }

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

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {groups.map((group) => (
        <View key={group.id} style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
            {group.label}
          </Text>
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
            {group.transactions.map((transaction) => (
              <Pressable
                key={transaction.id}
                accessibilityHint="Tap to view details, long press to delete this transaction"
                accessibilityRole="button"
                onLongPress={() => onDeleteTransaction?.(transaction)}
                onPress={() => onSelectTransaction?.(transaction)}
              >
                <TransactionRow compact {...transaction} />
              </Pressable>
            ))}
          </SectionCard>
        </View>
      ))}
    </View>
  );
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

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [accountFilter, setAccountFilter] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);

  const { accountsById, categoriesById } = useMemo(
    () => mapsFromState({ accounts, categories }),
    [accounts, categories],
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (q.length > 0) {
        const noteText = (transaction.note ?? "").toLowerCase();
        const categoryName = (categoriesById.get(transaction.categoryId)?.name ?? "").toLowerCase();
        const accountName = (accountsById.get(transaction.accountId)?.name ?? "").toLowerCase();
        if (!noteText.includes(q) && !categoryName.includes(q) && !accountName.includes(q)) {
          return false;
        }
      }
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
  }, [transactions, searchQuery, categoryFilter, accountFilter, categoriesById, accountsById]);

  const groups = useMemo(
    () => groupHistory(filteredTransactions, categoriesById, accountsById, selectedMonthYear),
    [filteredTransactions, categoriesById, accountsById, selectedMonthYear],
  );

  const totalMatchingCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.transactions.length, 0),
    [groups],
  );

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

  const clearSearch = () => {
    setSearchQuery("");
  };

  const selectedAccount = accountsById.get(accountFilter);
  const isFiltered = categoryFilter !== null || accountFilter !== null;
  const isSearchActive = isSearchOpen || searchQuery.trim().length > 0;

  return (
    <ScreenContainer contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.xl }} testID="history-screen">
      {/* Top Header */}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
          History
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
          <Pressable
            accessibilityLabel={isSearchOpen ? "Close search" : "Open search"}
            accessibilityRole="button"
            hitSlop={theme.spacing.sm}
            onPress={() => {
              setIsSearchOpen((prev) => {
                if (prev) {
                  setSearchQuery("");
                }
                return !prev;
              });
            }}
            style={{
              alignItems: "center",
              backgroundColor: isSearchActive ? theme.colors.tint : theme.colors.surface,
              borderColor: isSearchActive ? theme.colors.primary : theme.colors.outline,
              borderRadius: theme.radii.round,
              borderWidth: 1,
              height: 36,
              justifyContent: "center",
              width: 36,
            }}
          >
            <Text style={{ fontSize: 16 }}>🔍</Text>
          </Pressable>

          {isFiltered ? (
            <Pressable accessibilityRole="button" hitSlop={theme.spacing.md} onPress={clearFilters}>
              <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
                Clear filters
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Frame 17 Search Active Bar */}
      {isSearchActive ? (
        <View style={{ gap: theme.spacing.xs }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
              borderRadius: theme.radii.button,
              borderWidth: 1,
              flexDirection: "row",
              height: 46,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Text style={{ fontSize: 16, marginRight: theme.spacing.sm }}>🔍</Text>
            <TextInput
              accessibilityLabel="Search transactions or notes"
              autoFocus={isSearchOpen && searchQuery.length === 0}
              onChangeText={setSearchQuery}
              placeholder="Search transactions or notes…"
              placeholderTextColor={theme.colors.sub}
              style={{
                color: theme.colors.text,
                flex: 1,
                fontFamily: theme.fonts.regular,
                fontSize: theme.typeScale.body,
                padding: 0,
              }}
              value={searchQuery}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                hitSlop={theme.spacing.sm}
                onPress={clearSearch}
              >
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: 16 }}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {searchQuery.trim().length > 0 ? (
            <Text
              style={{
                color: theme.colors.sub,
                fontFamily: theme.fonts.medium,
                fontSize: theme.typeScale.small,
                paddingHorizontal: theme.spacing.xs,
              }}
            >
              {totalMatchingCount === 1
                ? `1 transaction found`
                : `${totalMatchingCount} transactions found`}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Filter Chips: MonthChip, Category Chip, Account Chip */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        <MonthChip />
        <Chip
          onPress={() => setOpenFilter((current) => (current === "category" ? null : "category"))}
          selected={openFilter === "category"}
          style={{ height: theme.sizes.filterChip }}
        >
          {categoryFilter === null ? "All categories ▾" : `${categoryFilter} ▾`}
        </Chip>
        <Chip
          onPress={() => setOpenFilter((current) => (current === "account" ? null : "account"))}
          selected={openFilter === "account"}
          style={{ height: theme.sizes.filterChip }}
        >
          {selectedAccount === undefined ? "All accounts ▾" : `${selectedAccount.name} ▾`}
        </Chip>
      </View>

      {/* Category selection popover */}
      {openFilter === "category" ? (
        <SectionCard style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold }}>Choose category</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            <Chip
              onPress={() => {
                setCategoryFilter(null);
                setOpenFilter(null);
              }}
              selected={categoryFilter === null}
            >
              All categories
            </Chip>
            {categoryNames.map((name) => (
              <Chip
                key={name}
                onPress={() => {
                  setCategoryFilter(name);
                  setOpenFilter(null);
                }}
                selected={categoryFilter === name}
              >
                {name}
              </Chip>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {/* Account selection popover */}
      {openFilter === "account" ? (
        <SectionCard style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold }}>Choose account</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            <Chip
              onPress={() => {
                setAccountFilter(null);
                setOpenFilter(null);
              }}
              selected={accountFilter === null}
            >
              All accounts
            </Chip>
            {accounts.map((account) => (
              <Chip
                key={account.id}
                onPress={() => {
                  setAccountFilter(account.id);
                  setOpenFilter(null);
                }}
                selected={accountFilter === account.id}
              >
                {account.name}
                {account.isArchived ? " (archived)" : ""}
              </Chip>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {/* Groups or Empty State */}
      <HistoryBody
        groups={groups}
        isFiltered={isFiltered}
        isSearchActive={isSearchActive}
        onAdd={addTransaction}
        onClearFilters={clearFilters}
        onClearSearch={clearSearch}
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
        onSelectTransaction={(transaction) => {
          navigation.navigate("TransactionDetail", { transactionId: Number(transaction.id) });
        }}
        searchQuery={searchQuery}
        selectedMonthYear={selectedMonthYear}
      />
    </ScreenContainer>
  );
}
