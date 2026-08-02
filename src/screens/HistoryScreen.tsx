import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TransactionRow } from "../components/TransactionRow";
import {
  formatMonthChip,
  groupHistory,
  shiftMonthYear,
} from "../domain/services/financeView";
import type { HistoryStackParamList, MainTabParamList } from "../navigation/routes";
import type { HistoryGroup } from "./fixtures";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";

type HistoryProps = NativeStackScreenProps<HistoryStackParamList, "HistoryList">;

interface HistoryBodyProps {
  readonly groups: readonly HistoryGroup[];
  readonly onAdd: () => void;
}

// This branch is shared by the populated and explicit Figma empty-state variants.
export function HistoryBody({ groups, onAdd }: HistoryBodyProps) {
  const theme = useTheme();

  if (groups.length === 0) {
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center", paddingVertical: theme.spacing.xxl }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.tint,
            borderRadius: theme.radii.round,
            height: theme.sizes.emptyCircle,
            justifyContent: "center",
            width: theme.sizes.emptyCircle,
          }}
        >
          <Text style={{ fontFamily: theme.fonts.regular, fontSize: theme.typeScale.entryAmount }}>🧾</Text>
        </View>
        <Text
          style={{
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.emptyTitle,
            marginTop: theme.spacing.lg,
          }}
        >
          No transactions yet
        </Text>
        <Text
          style={{
            color: theme.colors.sub,
            fontFamily: theme.fonts.regular,
            fontSize: theme.typeScale.body,
            lineHeight: theme.spacing.screen,
            marginTop: theme.spacing.md,
            textAlign: "center",
          }}
        >
          Transactions you log will show up here.{"\n"}Start by adding your first one.
        </Text>
        <PrimaryButton
          onPress={onAdd}
          style={{ alignSelf: "center", height: theme.sizes.secondaryButton, marginTop: theme.spacing.lg, width: theme.sizes.emptyActionWidth }}
        >
          ＋ Add your first transaction
        </PrimaryButton>
      </View>
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
              <TransactionRow compact key={transaction.id} {...transaction} />
            ))}
          </SectionCard>
        </View>
      ))}
    </View>
  );
}

// The history frame combines a fixed header/filter treatment with data-driven groups.
export function HistoryScreen({ navigation }: HistoryProps) {
  const theme = useTheme();
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<MainTabParamList>>();
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
  const setSelectedMonthYear = useFinanceStore((state) => state.setSelectedMonthYear);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [accountFilter, setAccountFilter] = useState<string | null>(null);

  const { accountsById, categoriesById } = useMemo(
    () => mapsFromState({ accounts, categories }),
    [accounts, categories],
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (categoryFilter !== null) {
        const name = categoriesById.get(transaction.categoryId)?.name;
        if (name !== categoryFilter) {
          return false;
        }
      }
      if (accountFilter !== null) {
        const type = accountsById.get(transaction.accountId)?.type;
        if (type !== accountFilter) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, categoryFilter, accountFilter, categoriesById, accountsById]);

  const groups = useMemo(
    () => groupHistory(filteredTransactions, categoriesById, accountsById, selectedMonthYear),
    [filteredTransactions, categoriesById, accountsById, selectedMonthYear],
  );

  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    for (const category of categories) {
      names.add(category.name);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [categories]);

  const addTransaction = () => tabNavigation?.navigate("Home", { screen: "Entry" });

  const cycleCategory = () => {
    if (categoryNames.length === 0) {
      setCategoryFilter(null);
      return;
    }
    if (categoryFilter === null) {
      setCategoryFilter(categoryNames[0]!);
      return;
    }
    const index = categoryNames.indexOf(categoryFilter);
    if (index < 0 || index >= categoryNames.length - 1) {
      setCategoryFilter(null);
      return;
    }
    setCategoryFilter(categoryNames[index + 1]!);
  };

  const cycleAccount = () => {
    const order = [null, "CASH", "CARD", "EWALLET"] as const;
    const index = order.indexOf(accountFilter as (typeof order)[number]);
    const next = order[(index + 1) % order.length] ?? null;
    setAccountFilter(next);
  };

  const accountChipLabel =
    accountFilter === null
      ? "All accounts ▾"
      : accountFilter === "CASH"
        ? "Cash ▾"
        : accountFilter === "CARD"
          ? "Card ▾"
          : "E-wallet ▾";

  return (
    <ScreenContainer
      contentContainerStyle={{ flexGrow: 1, gap: theme.spacing.xl }}
      testID="history-screen"
    >
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
          History
        </Text>
        <Pressable
          accessibilityLabel="Clear history filters"
          accessibilityRole="button"
          hitSlop={theme.spacing.md}
          onPress={() => {
            setCategoryFilter(null);
            setAccountFilter(null);
          }}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.emptyTitle }}>
            🔍
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        <Chip
          onPress={() => setSelectedMonthYear(shiftMonthYear(selectedMonthYear, -1))}
          style={{ height: theme.sizes.filterChip }}
        >
          {formatMonthChip(selectedMonthYear)} ▾
        </Chip>
        <Chip onPress={cycleCategory} style={{ height: theme.sizes.filterChip }}>
          {categoryFilter === null ? "All categories ▾" : `${categoryFilter} ▾`}
        </Chip>
        <Chip onPress={cycleAccount} style={{ height: theme.sizes.filterChip }}>
          {accountChipLabel}
        </Chip>
      </View>
      <HistoryBody groups={groups} onAdd={addTransaction} />
    </ScreenContainer>
  );
}
