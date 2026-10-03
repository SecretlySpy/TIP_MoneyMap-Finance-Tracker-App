import { useEffect, useMemo, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { CalendarPickerSheet } from "../components/CalendarPickerSheet";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextPromptModal } from "../components/TextPromptModal";
import { categoriesForType, toMonthYear, } from "../domain/services/financeView";
import { resolveDisplayEmoji } from "../domain/services/emoji";
import { formatMinor, parseDecimalToMinor, updateMoneyInput } from "../domain/services/money";
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
    const addCategory = useFinanceStore((state) => state.addCategory);
    const setSelectedMonthYear = useFinanceStore((state) => state.setSelectedMonthYear);
    const [transactionType, setTransactionType] = useState("EXPENSE");
    const [amountInput, setAmountInput] = useState("0");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedAccountId, setSelectedAccountId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [note, setNote] = useState("");
    const [showNotePrompt, setShowNotePrompt] = useState(false);
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [selectedDateEpochMillis, setSelectedDateEpochMillis] = useState(() => localNoonToday());
    const sourceKeyRef = useRef(createManualSourceKey());
    const transactions = useFinanceStore((state) => state.transactions);
    const accountChips = useMemo(() => listAccountChips(accounts), [accounts]);
    const typeCategories = useMemo(() => categoriesForType(categories, transactionType), [categories, transactionType]);
    // Recent expense categories from history (for quick re-pick).
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
        // Labels follow the chosen currency symbol instead of a hardcoded peso sign.
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
    useEffect(() => {
        if (accountChips.some((account) => account.id === selectedAccountId)) {
            return;
        }
        setSelectedAccountId(accountChips[0]?.id ?? null);
    }, [accountChips, selectedAccountId]);
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
    const amountColor = transactionType === "EXPENSE" ? theme.colors.expense : theme.colors.income;
    const selectedAccountLabel = accountChips.find((account) => account.id === selectedAccountId)?.label.replace(/^\S+\s/, "") ?? "Choose account";
    const canSave = amountMinor > 0 && selectedCategory !== "" && selectedCategory !== "New" && selectedAccountId !== null && !saving;
    const handleSave = async () => {
        if (!canSave) {
            return;
        }
        setSaving(true);
        try {
            await addTransaction({
                accountId: selectedAccountId,
                amountMinor,
                categoryName: selectedCategory,
                note: note.trim() ? note.trim() : null,
                type: transactionType,
                dateEpochMillis: selectedDateEpochMillis,
                sourceKey: sourceKeyRef.current,
            });
            // A mounted Entry route may be revisited after switching tabs. Retire the
            // completed mutation key while preserving it across any failed/uncertain retry.
            sourceKeyRef.current = createManualSourceKey();
            setSelectedMonthYear(toMonthYear(new Date(selectedDateEpochMillis)));
            tabNavigation?.navigate("History", { screen: "HistoryList" });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Could not save transaction.";
            Alert.alert("Save failed", message);
        }
        finally {
            setSaving(false);
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
        {["EXPENSE", "INCOME"].map((type) => {
            const selected = transactionType === type;
            return (<Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={type} onPress={() => setTransactionType(type)} style={{
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
                {type === "EXPENSE" ? "Expense" : "Income"}
              </Text>
            </Pressable>);
        })}
      </View>

      <View style={{ alignItems: "center", height: theme.sizes.entryAmountBlock, justifyContent: "center" }}>
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
            {selectedAccountLabel} · {dateLabel(selectedDateEpochMillis)} ▾
          </Text>
        </Pressable>
      </View>

      {recentCategoryChips.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
            RECENT CATEGORIES
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {recentCategoryChips.map((name) => (
              <Chip
                key={`recent-${name}`}
                onPress={() => setSelectedCategory(name)}
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
                return (<Pressable accessibilityRole="button" accessibilityState={{ selected }} key={category.label} onPress={() => {
                        if (category.label === "New") {
                            setShowNewCategory(true);
                            return;
                        }
                        setSelectedCategory(category.label);
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
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
            {note.trim()}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.keyGap }}>
          {accountChips.map((account) => (<Chip key={account.id} onPress={() => setSelectedAccountId(account.id)} selected={selectedAccountId === account.id} style={{ height: theme.sizes.accountChip }}>
              {account.label}
            </Chip>))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.keyGap }}>
        {keypadRows.map((row, rowIndex) => (<View key={`keypad-row-${rowIndex}`} style={{ flexDirection: "row", gap: theme.spacing.keyGap }}>
            {row.map((key) => (<Pressable accessibilityLabel={key === "⌫" ? "Delete digit" : key === "." ? "Decimal point" : key} accessibilityRole="button" key={key} onPress={() => setAmountInput((current) => updateMoneyInput(current, key))} style={{
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
        {saving ? "Saving…" : "Save Transaction"}
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
    </ScreenContainer>);
}
