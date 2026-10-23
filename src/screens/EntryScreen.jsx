import { useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BottomSheet } from "../components/BottomSheet";
import { CalendarPickerSheet } from "../components/CalendarPickerSheet";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SplitItemEditor } from "../components/SplitItemEditor";
import { TextPromptModal } from "../components/TextPromptModal";
import { accountChipLabel, categoriesForType, computeAccountBalances, toMonthYear } from "../domain/services/financeView";
import { resolveDisplayEmoji } from "../domain/services/emoji";
import { formatMinor, parseDecimalToMinor, updateMoneyInput } from "../domain/services/money";
import { buildSplitTransactions, computeSplitBreakdown, formatSplitEquation, validateSplitSum } from "../domain/services/splits";
import { extractTags } from "../domain/services/tags";
import { listAccountChips, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const keypadRows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "⌫"],
];
function localNoonToday(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0).getTime();
}
function dateLabel(epochMillis, now = new Date()) {
    const selected = new Date(epochMillis);
    const isToday = selected.getFullYear() === now.getFullYear()
        && selected.getMonth() === now.getMonth()
        && selected.getDate() === now.getDate();
    return `${isToday ? "Today, " : ""}${MONTH_SHORT[selected.getMonth()]} ${selected.getDate()}, ${selected.getFullYear()}`;
}
function createManualSourceKey() {
    try {
        const uuid = Crypto.randomUUID();
        if (typeof uuid === "string" && uuid.length > 0) {
            return `manual:v1:${uuid}`;
        }
    }
    catch {
        // Jest and older native runtimes can lack randomUUID; this fallback is local-only.
    }
    return `manual:v1:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
// The entry screen keeps the Figma three-step flow while all money stays integer minor units.
export function EntryScreen({ navigation }) {
    const tabNavigation = navigation.getParent();
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const currencySymbol = useUiStore((state) => state.currencySymbol);
    const accounts = useFinanceStore((state) => state.accounts);
    const categories = useFinanceStore((state) => state.categories);
    const addTransaction = useFinanceStore((state) => state.addTransaction);
    const addSplitTransactions = useFinanceStore((state) => state.addSplitTransactions);
    const addAccountTransfer = useFinanceStore((state) => state.addAccountTransfer);
    const transfers = useFinanceStore((state) => state.transfers);
    const addCategory = useFinanceStore((state) => state.addCategory);
    const setSelectedMonthYear = useFinanceStore((state) => state.setSelectedMonthYear);
    const [transactionType, setTransactionType] = useState("EXPENSE");
    const [amountInput, setAmountInput] = useState("0");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedAccountId, setSelectedAccountId] = useState(null);
    const [selectedToAccountId, setSelectedToAccountId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [note, setNote] = useState("");
    const [showNotePrompt, setShowNotePrompt] = useState(false);
    const [isSplitMode, setIsSplitMode] = useState(false);
    const [splits, setSplits] = useState([]);
    const [activeSplitId, setActiveSplitId] = useState(null);
    const [activeTarget, setActiveTarget] = useState("split");
    const [splitCategoryPickerVisible, setSplitCategoryPickerVisible] = useState(false);
    const [splitCategoryPickerTargetId, setSplitCategoryPickerTargetId] = useState(null);
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [selectedDateEpochMillis, setSelectedDateEpochMillis] = useState(() => localNoonToday());
    const sourceKeyRef = useRef(createManualSourceKey());
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const noteTags = useMemo(() => extractTags(note), [note]);
    const transactions = useFinanceStore((state) => state.transactions);
    const accountChips = useMemo(() => listAccountChips(accounts), [accounts]);
    const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
    const calculatedAccounts = useMemo(
        () => computeAccountBalances(accounts, transactions, transfers),
        [accounts, transactions, transfers],
    );
    useEffect(() => {
        const fromId = selectedAccountId ?? activeAccounts[0]?.id ?? null;
        if (selectedAccountId === null && fromId !== null) {
            setSelectedAccountId(fromId);
        }
        if (selectedToAccountId === null && activeAccounts.length > 1) {
            const second = activeAccounts.find((a) => a.id !== fromId);
            if (second) {
                setSelectedToAccountId(second.id);
            }
        }
    }, [activeAccounts, selectedAccountId, selectedToAccountId]);

    const fromAccountObj = activeAccounts.find((a) => a.id === selectedAccountId);
    const toAccountObj = activeAccounts.find((a) => a.id === selectedToAccountId);
    const fromBalanceMinor = calculatedAccounts.find((a) => a.id === selectedAccountId)?.balanceMinor ?? fromAccountObj?.startingBalanceMinor ?? 0;
    const toBalanceMinor = calculatedAccounts.find((a) => a.id === selectedToAccountId)?.balanceMinor ?? toAccountObj?.startingBalanceMinor ?? 0;

    const typeCategories = useMemo(() => categoriesForType(categories, transactionType), [categories, transactionType]);
    const recentCategoryChips = useMemo(() => {
        const names = [];
        const seen = new Set();
        const ordered = [...transactions].sort((a, b) => b.dateEpochMillis - a.dateEpochMillis);
        for (const tx of ordered) {
            if (tx.type !== transactionType) continue;
            const cat = categories.find((c) => c.id === tx.categoryId);
            if (!cat || seen.has(cat.name)) continue;
            seen.add(cat.name);
            names.push(cat.name);
            if (names.length >= 4) break;
        }
        return names;
    }, [transactions, categories, transactionType]);
    const quickTemplates = useMemo(() => {
        if (transactionType === "INCOME") {
            return [
                { label: `Allowance ${currencySymbol}15,000`, amount: "15000", note: "Monthly allowance", category: "Allowance" },
                { label: `Part-time ${currencySymbol}3,000`, amount: "3000", note: "Shift pay", category: "Part-time" },
            ];
        }
        return [
            { name: "Lunch", amount: "80", note: "Lunch", category: "Food" },
            { name: "Jeep", amount: "15", note: "Commute", category: "Transport" },
            { name: "Load", amount: "50", note: "Mobile load", category: "Load/Data" },
            { name: "Coffee", amount: "120", note: "Coffee", category: "Food" },
        ].map((template) => ({
            ...template,
            label: `${template.name} ${currencySymbol}${template.amount}`,
        }));
    }, [transactionType, currencySymbol]);
    const applyTemplate = (template) => {
        setAmountInput(template.amount);
        if (template.note) setNote(template.note);
        if (template.category && typeCategories.some((c) => c.name === template.category)) {
            setSelectedCategory(template.category);
        }
    };
    const categoryCells = useMemo(() => {
        // A12: no longer capped at 7 -- every category stays reachable, the grid just grows.
        const cells = typeCategories.map((category) => ({
            emoji: resolveDisplayEmoji({ icon: category.icon, name: category.name }),
            label: category.name,
        }));
        cells.push({ emoji: "+", label: "New" });
        while (cells.length % 4 !== 0) {
            cells.push({ emoji: "", label: "" });
        }
        return cells;
    }, [typeCategories]);
    const categoryRows = useMemo(() => {
        const rows = [];
        for (let index = 0; index < categoryCells.length; index += 4) {
            rows.push(categoryCells.slice(index, index + 4));
        }
        return rows;
    }, [categoryCells]);
    useEffect(() => {
        const first = typeCategories[0];
        if (first === undefined) {
            setSelectedCategory("");
            return;
        }
        if (!typeCategories.some((category) => category.name === selectedCategory)) {
            setSelectedCategory(first.name);
        }
    }, [typeCategories, selectedCategory]);
    const amountMinor = useMemo(() => {
        try {
            return parseDecimalToMinor(amountInput);
        }
        catch {
            return 0;
        }
    }, [amountInput]);
    const hasCentavos = useMemo(() => {
        return amountMinor % 100 !== 0 || splits.some((s) => (s.amountMinor || 0) % 100 !== 0);
    }, [amountMinor, splits]);

    const splitBreakdown = useMemo(() => {
        if (!isSplitMode || splits.length === 0) return null;
        return computeSplitBreakdown({ totalMinor: amountMinor, splits });
    }, [isSplitMode, splits, amountMinor]);

    const splitValidation = useMemo(() => {
        if (!isSplitMode || splits.length === 0) return { isValid: false, error: null };
        return validateSplitSum(splits, amountMinor, { requireCategory: true });
    }, [isSplitMode, splits, amountMinor]);

    const handleSelectSplit = (splitId) => {
        setActiveSplitId(splitId);
        setActiveTarget("split");
        const found = splits.find((s) => s.id === splitId);
        if (found?.categoryName) {
            setSelectedCategory(found.categoryName);
        }
    };

    const handleCategoryPress = (categoryName) => {
        if (categoryName === "New") {
            setShowNewCategory(true);
            return;
        }
        if (isSplitMode && activeSplitId) {
            const catObj = typeCategories.find((c) => c.name === categoryName) || categories.find((c) => c.name === categoryName);
            setSplits((prevSplits) =>
                prevSplits.map((s) =>
                    s.id === activeSplitId
                        ? { ...s, categoryName, categoryId: catObj?.id ?? s.categoryId }
                        : s
                )
            );
            setSelectedCategory(categoryName);
        } else {
            setSelectedCategory(categoryName);
        }
    };

    const handleSplitAmountChange = (splitId, text) => {
        setSplits((prevSplits) =>
            prevSplits.map((s) => {
                if (s.id !== splitId) return s;
                let parsedMinor = 0;
                try {
                    parsedMinor = parseDecimalToMinor(text);
                } catch {
                    parsedMinor = 0;
                }
                return {
                    ...s,
                    rawAmount: text,
                    amountMinor: parsedMinor,
                };
            })
        );
    };

    const handleKeypadPress = (key) => {
        if (isSplitMode && activeTarget === "split" && activeSplitId) {
            const activeSplit = splits.find((s) => s.id === activeSplitId);
            if (!activeSplit) return;
            const currentVal = activeSplit.rawAmount !== undefined
                ? activeSplit.rawAmount
                : (activeSplit.amountMinor === 0 ? "0" : (activeSplit.amountMinor % 100 === 0 ? String(activeSplit.amountMinor / 100) : (activeSplit.amountMinor / 100).toFixed(2)));
            const nextVal = updateMoneyInput(currentVal, key);
            handleSplitAmountChange(activeSplitId, nextVal);
        } else {
            setAmountInput((current) => updateMoneyInput(current, key));
        }
    };

    const handleAddSplit = () => {
        const nextIndex = splits.length + 1;
        const cat = typeCategories[(nextIndex - 1) % typeCategories.length] || typeCategories[0] || { id: 1, name: "Expense" };
        const newSplit = {
            id: `split-${Date.now()}-${nextIndex}-${Math.random().toString(36).slice(2, 7)}`,
            categoryId: cat.id,
            categoryName: cat.name,
            amountMinor: 0,
            rawAmount: "0",
        };
        setSplits((prev) => [...prev, newSplit]);
        setActiveSplitId(newSplit.id);
        setActiveTarget("split");
        setSelectedCategory(cat.name);
    };

    const handleRemoveSplit = (splitId) => {
        if (splits.length <= 2) return;
        setSplits((prev) => {
            if (prev.length <= 2) return prev;
            const next = prev.filter((s) => s.id !== splitId);
            if (activeSplitId === splitId && next.length > 0) {
                setActiveSplitId(next[0].id);
                if (next[0].categoryName) {
                    setSelectedCategory(next[0].categoryName);
                }
            }
            return next;
        });
    };

    const amountColor = transactionType === "EXPENSE" ? theme.colors.expense : transactionType === "INCOME" ? theme.colors.income : theme.colors.text;
    const selectedAccountLabel = accountChips.find((account) => account.id === selectedAccountId)?.label.replace(/^\S+\s/, "") ?? "Choose account";
    const canSave = transactionType === "TRANSFER"
        ? amountMinor > 0 && selectedAccountId !== null && selectedToAccountId !== null && selectedAccountId !== selectedToAccountId && activeAccounts.length >= 2 && !saving
        : (isSplitMode && transactionType === "EXPENSE")
            ? amountMinor > 0 && splits.length > 0 && splitValidation.isValid && selectedAccountId !== null && !saving
            : amountMinor > 0 && selectedCategory !== "" && selectedCategory !== "New" && selectedAccountId !== null && !saving;

    const handleSave = async () => {
        if (!canSave) {
            return;
        }
        setSaving(true);
        try {
            if (transactionType === "TRANSFER") {
                await addAccountTransfer({
                    fromAccountId: selectedAccountId,
                    toAccountId: selectedToAccountId,
                    amountMinor,
                    note: note.trim() ? note.trim() : null,
                    dateEpochMillis: selectedDateEpochMillis,
                    sourceKey: sourceKeyRef.current,
                });
            } else if (isSplitMode && transactionType === "EXPENSE" && splits.length > 0) {
                const validation = validateSplitSum(splits, amountMinor, { requireCategory: true });
                if (!validation.isValid) {
                    Alert.alert("Split Mismatch", validation.error || "Splits do not equal total.");
                    return;
                }
                for (let i = 0; i < splits.length; i++) {
                    const s = splits[i];
                    const cat = categories.find((c) => c.id === s.categoryId) || categories.find((c) => c.name.toLowerCase() === s.categoryName?.toLowerCase() && c.type === "EXPENSE");
                    if (!cat) {
                        Alert.alert("Invalid Category", `Split #${i + 1} has an invalid or missing category.`);
                        return;
                    }
                }
                const splitTxs = buildSplitTransactions({
                    parentTransaction: {
                        type: "EXPENSE",
                        accountId: selectedAccountId,
                        amountMinor,
                        note: note.trim() ? note.trim() : null,
                        dateEpochMillis: selectedDateEpochMillis,
                        sourceKey: sourceKeyRef.current,
                    },
                    splits: splits.map((s) => {
                        const cat = categories.find((c) => c.id === s.categoryId) || categories.find((c) => c.name.toLowerCase() === s.categoryName?.toLowerCase() && c.type === "EXPENSE");
                        return {
                            categoryId: cat.id,
                            categoryName: cat.name,
                            amountMinor: s.amountMinor,
                            note: s.note?.trim() ? s.note.trim() : (note.trim() ? `${note.trim()} - ${cat.name}` : cat.name),
                        };
                    }),
                });
                if (typeof addSplitTransactions === "function") {
                    await addSplitTransactions(splitTxs);
                } else {
                    for (const sTx of splitTxs) {
                        await addTransaction(sTx);
                    }
                }
            } else {
                await addTransaction({
                    accountId: selectedAccountId,
                    amountMinor,
                    categoryName: selectedCategory,
                    note: note.trim() ? note.trim() : null,
                    type: transactionType,
                    dateEpochMillis: selectedDateEpochMillis,
                    sourceKey: sourceKeyRef.current,
                });
            }
            // A mounted Entry route may be revisited after switching tabs. Retire the
            // completed mutation key while preserving it across any failed/uncertain retry.
            sourceKeyRef.current = createManualSourceKey();
            if (typeof setSelectedMonthYear === "function") {
                setSelectedMonthYear(toMonthYear(new Date(selectedDateEpochMillis)));
            }
            if (isMountedRef.current) {
                setAmountInput("");
                setNote("");
                setIsSplitMode(false);
                setSplits([]);
                setActiveSplitId(null);
                setActiveTarget("split");
                setSelectedDateEpochMillis(localNoonToday());
            }
            if (typeof navigation?.canGoBack === "function" && navigation.canGoBack()) {
                navigation.goBack();
            }
            tabNavigation?.navigate("History", { screen: "HistoryList" });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Could not save transaction.";
            Alert.alert("Save failed", message);
        }
        finally {
            if (isMountedRef.current) {
                setSaving(false);
            }
        }
    };
    return (<ScreenContainer contentContainerStyle={{ gap: theme.spacing.card }} safeBottom testID="entry-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
        <Pressable accessibilityLabel="Close add transaction" accessibilityRole="button" hitSlop={theme.spacing.md} onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.subScreenTitle }}>
            ✕
          </Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Add Transaction
        </Text>
      </View>

      <View accessibilityRole="tablist" style={{
            backgroundColor: theme.colors.track,
            borderRadius: theme.radii.balance,
            flexDirection: "row",
            height: theme.sizes.entryToggle,
            padding: theme.spacing.xs,
        }}>
        {["EXPENSE", "INCOME", "TRANSFER"].map((type) => {
            const selected = transactionType === type;
            return (<Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={type} onPress={() => {
                setTransactionType(type);
                if (type !== "EXPENSE" && isSplitMode) {
                    setIsSplitMode(false);
                    setSplits([]);
                    setActiveSplitId(null);
                    setActiveTarget("split");
                }
            }} style={{
                    alignItems: "center",
                    backgroundColor: selected ? theme.colors.surface : theme.colors.track,
                    borderRadius: theme.radii.chip,
                    flex: 1,
                    height: theme.sizes.entrySegment,
                    justifyContent: "center",
                    shadowColor: theme.colors.shadow,
                    ...(selected ? theme.shadows.card : {}),
                }}>
              <Text style={{
                    color: selected ? theme.colors.text : theme.colors.sub,
                    fontFamily: selected ? theme.fonts.bold : theme.fonts.medium,
                    fontSize: theme.typeScale.body,
                }}>
                {type === "EXPENSE" ? "Expense" : type === "INCOME" ? "Income" : "Transfer"}
              </Text>
            </Pressable>);
        })}
      </View>

      <Pressable
        accessibilityHint="Tap to edit total amount"
        accessibilityLabel={`Total amount ${formatMinor(amountMinor, { currencySymbol })}`}
        accessibilityRole="button"
        onPress={() => {
          if (isSplitMode) {
            setActiveTarget("parent");
          }
        }}
        testID="entry-parent-amount"
        style={{
          alignItems: "center",
          borderColor: isSplitMode && activeTarget === "parent" ? theme.colors.primary : "transparent",
          borderRadius: theme.radii.card,
          borderWidth: isSplitMode && activeTarget === "parent" ? 2 : 0,
          height: theme.sizes.entryAmountBlock,
          justifyContent: "center",
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <Text style={{ color: amountColor, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.entryAmount }}>
          {formatMinor(amountMinor, { currencySymbol })}
        </Text>
        <Pressable
          accessibilityHint="Opens the transaction date calendar"
          accessibilityLabel={`Transaction date ${dateLabel(selectedDateEpochMillis)}`}
          accessibilityRole="button"
          onPress={() => setDatePickerVisible(true)}
          style={{ alignItems: "center", justifyContent: "center", minHeight: 44, paddingHorizontal: theme.spacing.md }}
        >
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
            {dateLabel(selectedDateEpochMillis)} ▾
          </Text>
        </Pressable>
      </Pressable>

      {transactionType === "TRANSFER" ? (
        <View style={{ gap: theme.spacing.md }}>
          {/* Phase 2 Frame 299:2779: Transfer Flow Info */}
          <View
            testID="transfer-flow-info"
            style={{
              backgroundColor: theme.colors.tint,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.row,
              borderWidth: 1,
              gap: theme.spacing.xxs,
              padding: theme.spacing.md,
            }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              Transfer between accounts
            </Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small, lineHeight: 18 }}>
              From → To • Amount • Date • Note{"\n"}Does not count as income or expense.
            </Text>
          </View>

          {/* Insufficient accounts warning */}
          {activeAccounts.length < 2 ? (
            <View
              testID="insufficient-accounts-banner"
              style={{
                backgroundColor: theme.colors.amberBg,
                borderColor: theme.colors.warning,
                borderRadius: theme.radii.row,
                borderWidth: 1,
                gap: theme.spacing.xs,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                At least two accounts needed
              </Text>
              <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small, lineHeight: 18 }}>
                Transfers require at least two active accounts. Create or unarchive another account to transfer funds.
              </Text>
            </View>
          ) : null}

          {/* Phase 2 Frame 299:2782: Same Account Error Banner */}
          {selectedAccountId !== null && selectedToAccountId !== null && selectedAccountId === selectedToAccountId ? (
            <View
              testID="same-account-error"
              style={{
                backgroundColor: theme.colors.avatarBg,
                borderColor: theme.colors.expense,
                borderRadius: theme.radii.row,
                borderWidth: 1,
                gap: theme.spacing.xs,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                Choose two different accounts
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small, lineHeight: 18 }}>
                Same-account transfers are blocked. Negative balances are allowed and explained.
              </Text>
            </View>
          ) : null}

          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              From Account
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.keyGap }}>
              {activeAccounts.map((account) => (
                <Chip
                  key={`from-${account.id}`}
                  onPress={() => setSelectedAccountId(account.id)}
                  selected={selectedAccountId === account.id}
                  style={{ height: theme.sizes.accountChip }}
                  testID={`from-account-${account.id}`}
                >
                  {accountChipLabel(account.type)} · {account.name}
                </Chip>
              ))}
            </View>
          </View>

          <View style={{ alignItems: "center", marginVertical: theme.spacing.xs }}>
            <Pressable
              accessibilityLabel="Swap accounts"
              accessibilityRole="button"
              hitSlop={theme.spacing.sm}
              onPress={() => {
                const temp = selectedAccountId;
                setSelectedAccountId(selectedToAccountId);
                setSelectedToAccountId(temp);
              }}
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.round,
                borderWidth: 1,
                flexDirection: "row",
                gap: theme.spacing.xs,
                minHeight: 44,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.xs,
              }}
            >
              <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                Swap accounts
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              To Account
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.keyGap }}>
              {activeAccounts.map((account) => (
                <Chip
                  key={`to-${account.id}`}
                  onPress={() => setSelectedToAccountId(account.id)}
                  selected={selectedToAccountId === account.id}
                  style={{ height: theme.sizes.accountChip }}
                  testID={`to-account-${account.id}`}
                >
                  {accountChipLabel(account.type)} · {account.name}
                </Chip>
              ))}
            </View>
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
              {note.trim() ? `Note: ${note.trim()}` : "No note added"}
            </Text>
            <Pressable
              accessibilityLabel={note.trim() ? "Edit note" : "Add note"}
              accessibilityRole="button"
              hitSlop={theme.spacing.sm}
              onPress={() => setShowNotePrompt(true)}
              style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
            >
              <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
                {note.trim() ? "Edit note" : "+ Add note"}
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
              borderRadius: theme.radii.card,
              borderWidth: 1,
              gap: theme.spacing.xs,
              padding: theme.spacing.md,
            }}
          >
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny }}>
              POST-TRANSFER BALANCE PREVIEW
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.small }}>
                {fromAccountObj?.name ?? "From"}: {formatMinor(fromBalanceMinor, { currencySymbol })} → {formatMinor(fromBalanceMinor - amountMinor, { currencySymbol })}
              </Text>
              <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.small }}>
                {toAccountObj?.name ?? "To"}: {formatMinor(toBalanceMinor, { currencySymbol })} → {formatMinor(toBalanceMinor + amountMinor, { currencySymbol })}
              </Text>
            </View>
            {fromBalanceMinor - amountMinor < 0 ? (
              <Text style={{ color: theme.colors.expense, fontSize: theme.typeScale.tiny, fontFamily: theme.fonts.bold }}>
                ⚠️ Overdraft warning: from account balance will be negative.
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          {recentCategoryChips.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                RECENT CATEGORIES
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
                {recentCategoryChips.map((name) => (
                  <Chip
                    key={`recent-${name}`}
                    onPress={() => handleCategoryPress(name)}
                    selected={selectedCategory === name}
                    style={{ height: theme.sizes.filterChip }}
                  >
                    {name}
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
              QUICK TEMPLATES
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {quickTemplates.map((template) => (
                <Chip
                  key={template.label}
                  onPress={() => applyTemplate(template)}
                  style={{ height: theme.sizes.filterChip }}
                >
                  {template.label}
                </Chip>
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              Category
            </Text>
            {categoryRows.map((row, rowIndex) => (<View key={`category-row-${rowIndex}`} style={{ flexDirection: "row", gap: theme.spacing.md }}>
                {row.map((category, cellIndex) => {
                    if (category.label === "") {
                        return <View key={`empty-${rowIndex}-${cellIndex}`} style={{ flex: 1 }}/>;
                    }
                    const selected = selectedCategory === category.label;
                    return (<Pressable accessibilityLabel={category.label} accessibilityRole="button" accessibilityState={{ selected }} key={category.label} testID={`category-cell-${category.label}`} onPress={() => {
                            handleCategoryPress(category.label);
                        }} style={{
                            alignItems: "center",
                            backgroundColor: selected ? theme.colors.tint : theme.colors.surface,
                            borderColor: selected ? theme.colors.primary : theme.colors.outline,
                            borderRadius: theme.radii.row,
                            borderWidth: selected ? 1.5 : theme.spacing.hairline,
                            flex: 1,
                            height: theme.sizes.categoryCell,
                            justifyContent: "center",
                        }}>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: 20 }}>
                        {category.emoji}
                      </Text>
                      <Text style={{
                            color: selected ? theme.colors.primary : theme.colors.sub,
                            fontFamily: selected ? theme.fonts.bold : theme.fonts.medium,
                            fontSize: theme.typeScale.small,
                            marginTop: theme.spacing.xs,
                        }}>
                        {category.label}
                      </Text>
                    </Pressable>);
                })}
              </View>))}
          </View>

          <View style={{ gap: theme.spacing.keyGap }}>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                Account
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setShowNotePrompt(true)}>
                <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
                  {note.trim() ? "Edit note" : "+ Add note"}
                </Text>
              </Pressable>
            </View>
            {note.trim() ? (
              <View style={{ gap: theme.spacing.xxs }}>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
                  {note.trim()}
                </Text>
                {noteTags.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
                    {noteTags.map((tag) => (
                      <View key={tag} style={{ backgroundColor: theme.colors.tint, borderRadius: theme.radii.chip, paddingHorizontal: theme.spacing.sm, paddingVertical: 2 }}>
                        <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.tiny }}>
                          #{tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.keyGap }}>
              {accountChips.map((account) => (<Chip key={account.id} onPress={() => setSelectedAccountId(account.id)} selected={selectedAccountId === account.id} style={{ height: theme.sizes.accountChip }}>
                  {account.label}
                </Chip>))}
            </View>
          </View>

          {/* Power Tools: Split Transaction */}
          {transactionType === "EXPENSE" && amountMinor > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.tiny }}>
                  POWER TOOLS
                </Text>
                <Pressable
                  accessibilityLabel={isSplitMode ? "Cancel split" : "Split transaction"}
                  accessibilityRole="button"
                  onPress={() => {
                    if (!isSplitMode) {
                      const half = Math.floor(amountMinor / 2);
                      const cat1 = typeCategories.find((c) => c.name === selectedCategory) || typeCategories[0] || { id: 1, name: "Expense" };
                      const cat2 = typeCategories.find((c) => c.id !== cat1.id) || typeCategories[1] || cat1;
                      const initialSplits = [
                        {
                          id: "split-1",
                          categoryId: cat1.id,
                          categoryName: cat1.name,
                          amountMinor: half,
                          rawAmount: half % 100 === 0 ? String(half / 100) : (half / 100).toFixed(2),
                        },
                        {
                          id: "split-2",
                          categoryId: cat2.id,
                          categoryName: cat2.name,
                          amountMinor: amountMinor - half,
                          rawAmount: (amountMinor - half) % 100 === 0 ? String((amountMinor - half) / 100) : ((amountMinor - half) / 100).toFixed(2),
                        },
                      ];
                      setSplits(initialSplits);
                      setActiveSplitId("split-1");
                      setActiveTarget("split");
                      setIsSplitMode(true);
                      setSelectedCategory(cat1.name);
                    } else {
                      setIsSplitMode(false);
                      setSplits([]);
                      setActiveSplitId(null);
                      setActiveTarget("split");
                    }
                  }}
                  style={{
                    backgroundColor: isSplitMode ? theme.colors.tint : theme.colors.surface,
                    borderColor: isSplitMode ? theme.colors.primary : theme.colors.outline,
                    borderRadius: theme.radii.chip,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 44,
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  <Text style={{ color: isSplitMode ? theme.colors.primary : theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                    {isSplitMode ? "✓ Split Active" : "✂ Split Transaction"}
                  </Text>
                </Pressable>
              </View>

              {isSplitMode ? (
                <View
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary,
                    borderRadius: theme.radii.card,
                    borderWidth: 1,
                    gap: theme.spacing.sm,
                    padding: theme.spacing.md,
                  }}
                  testID="split-breakdown-card"
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                    EXACT-SUM SPLIT BREAKDOWN
                  </Text>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                    {formatSplitEquation(splits, amountMinor, currencySymbol, { showCents: hasCentavos })}
                  </Text>

                  {/* Split items list */}
                  <View style={{ gap: theme.spacing.xs }}>
                    {splits.map((split, idx) => (
                      <SplitItemEditor
                        categoryIcon={categories.find((c) => c.id === split.categoryId)?.icon}
                        currencySymbol={currencySymbol}
                        index={idx}
                        isActive={activeTarget === "split" && activeSplitId === split.id}
                        key={split.id}
                        onAmountChange={(text) => handleSplitAmountChange(split.id, text)}
                        onAmountFocus={() => {
                          setActiveSplitId(split.id);
                          setActiveTarget("split");
                        }}
                        onCategoryPress={() => {
                          setActiveSplitId(split.id);
                          setActiveTarget("split");
                          setSplitCategoryPickerTargetId(split.id);
                          setSplitCategoryPickerVisible(true);
                        }}
                        canRemove={splits.length > 2}
                        onRemove={() => handleRemoveSplit(split.id)}
                        onSelect={() => handleSelectSplit(split.id)}
                        split={split}
                      />
                    ))}
                  </View>

                  {/* Add split button */}
                  <Pressable
                    accessibilityLabel="Add split item"
                    accessibilityRole="button"
                    hitSlop={theme.spacing.xs}
                    onPress={handleAddSplit}
                    style={{
                      alignItems: "center",
                      borderColor: theme.colors.primary,
                      borderRadius: theme.radii.row,
                      borderStyle: "dashed",
                      borderWidth: 1,
                      justifyContent: "center",
                      minHeight: 38,
                      paddingVertical: theme.spacing.xs,
                    }}
                    testID="add-split-btn"
                  >
                    <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                      + Add Split
                    </Text>
                  </Pressable>

                  {/* Verification status and totals */}
                  <View style={{ borderTopColor: theme.colors.outline, borderTopWidth: theme.spacing.hairline, gap: 4, paddingTop: theme.spacing.xs }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                        Allocated: {formatMinor(splitBreakdown?.sumMinor || 0, { currencySymbol, showCents: hasCentavos })}
                      </Text>
                      <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                        Total: {formatMinor(amountMinor, { currencySymbol, showCents: hasCentavos })}
                      </Text>
                    </View>
                    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                      {splitValidation.isValid ? (
                        <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                          ✓ Exact sum verified
                        </Text>
                      ) : splitValidation.error && !splitValidation.error.includes("does not equal transaction total") ? (
                        <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                          ⚠️ {splitValidation.error}
                        </Text>
                      ) : splitBreakdown && splitBreakdown.remainingMinor > 0 ? (
                        <Text style={{ color: theme.colors.warning || theme.colors.amberText, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                          ⚠️ {formatMinor(splitBreakdown.remainingMinor, { currencySymbol, showCents: hasCentavos })} remaining
                        </Text>
                      ) : splitBreakdown && splitBreakdown.remainingMinor < 0 ? (
                        <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                          ⚠️ {formatMinor(Math.abs(splitBreakdown.remainingMinor), { currencySymbol, showCents: hasCentavos })} over-allocation
                        </Text>
                      ) : (
                        <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                          ⚠️ {splitValidation.error || "Sum mismatch"}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <View style={{ gap: theme.spacing.keyGap }}>
        {keypadRows.map((row, rowIndex) => (<View key={`keypad-row-${rowIndex}`} style={{ flexDirection: "row", gap: theme.spacing.keyGap }}>
            {row.map((key) => (<Pressable accessibilityLabel={key === "⌫" ? "Delete digit" : key === "." ? "Decimal point" : key} accessibilityRole="button" key={key} onPress={() => handleKeypadPress(key)} style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outline,
                    borderRadius: theme.radii.row,
                    borderWidth: theme.spacing.hairline,
                    flex: 1,
                    height: theme.sizes.entryKey,
                    justifyContent: "center",
                }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.keypad }}>
                  {key}
                </Text>
              </Pressable>))}
          </View>))}
      </View>

      <PrimaryButton disabled={!canSave} onPress={() => void handleSave()}>
        {saving ? "Saving…" : transactionType === "TRANSFER" ? "Save Transfer" : "Save Transaction"}
      </PrimaryButton>
      <CalendarPickerSheet
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(epochMillis) => {
            setSelectedDateEpochMillis(epochMillis);
            setDatePickerVisible(false);
        }}
        selectedDateEpochMillis={selectedDateEpochMillis}
        testID="entry-date-picker-sheet"
        title="Transaction date"
        visible={datePickerVisible}
      />
      <TextPromptModal confirmLabel="Add" message="Creates a custom category on this device." onCancel={() => setShowNewCategory(false)} onConfirm={(value) => {
            void (async () => {
                try {
                    const created = await addCategory({ name: value, type: transactionType });
                    if (isSplitMode && activeSplitId) {
                      setSplits((prev) =>
                        prev.map((s) =>
                          s.id === activeSplitId
                            ? { ...s, categoryName: created.name, categoryId: created.id }
                            : s
                        )
                      );
                    }
                    setSelectedCategory(created.name);
                    setShowNewCategory(false);
                }
                catch (error) {
                    Alert.alert("Could not add category", error instanceof Error ? error.message : "Unknown error");
                }
            })();
        }} placeholder="Category name" title="New category" visible={showNewCategory}/>
      <TextPromptModal confirmLabel="Save note" initialValue={note} message="Optional description for this transaction." onCancel={() => setShowNotePrompt(false)} onConfirm={(value) => {
            setNote(value);
            setShowNotePrompt(false);
        }} placeholder="Lunch — Jollibee" title="Transaction note" visible={showNotePrompt}/>

      {/* Split Category Picker Sheet */}
      <BottomSheet
        onClose={() => setSplitCategoryPickerVisible(false)}
        testID="split-category-picker-sheet"
        title="Select Split Category"
        visible={splitCategoryPickerVisible}
      >
        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, paddingVertical: theme.spacing.md }}>
          {typeCategories.map((cat) => {
            const currentSplit = splits.find((s) => s.id === splitCategoryPickerTargetId);
            const isSelected = currentSplit?.categoryId === cat.id || currentSplit?.categoryName === cat.name;
            const catEmoji = resolveDisplayEmoji({ icon: cat.icon, name: cat.name });
            return (
              <Chip
                key={`picker-cat-${cat.id}`}
                onPress={() => {
                  if (splitCategoryPickerTargetId) {
                    setSplits((prev) =>
                      prev.map((s) =>
                        s.id === splitCategoryPickerTargetId
                          ? { ...s, categoryId: cat.id, categoryName: cat.name }
                          : s
                      )
                    );
                    setSelectedCategory(cat.name);
                  }
                  setSplitCategoryPickerVisible(false);
                }}
                selected={isSelected}
                testID={`picker-category-chip-${cat.id}`}
              >
                {catEmoji} {cat.name}
              </Chip>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </ScreenContainer>);
}
