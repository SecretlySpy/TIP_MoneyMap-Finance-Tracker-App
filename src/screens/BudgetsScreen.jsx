import { useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BottomSheet } from "../components/BottomSheet";
import { BudgetCard } from "../components/BudgetCard";
import { DashedButton, PrimaryButton } from "../components/Buttons";
import { EmojiGrid } from "../components/EmojiGrid";
import { EmptyState } from "../components/EmptyState";
import { MonthChip } from "../components/MonthChip";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextPromptModal } from "../components/TextPromptModal";
import { BUDGET_BILL_EMOJI_PRESETS } from "../domain/services/emoji";
import { budgetSummary, buildBudgetCards, formatMonthChip } from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

export function BudgetsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
  const addBudget = useFinanceStore((state) => state.addBudget);
  const addCategory = useFinanceStore((state) => state.addCategory);
  const renameCategory = useFinanceStore((state) => state.renameCategory);
  const deleteBudgetByCategoryName = useFinanceStore((state) => state.deleteBudgetByCategoryName);

  const [busy, setBusy] = useState(false);
  const [sheetStep, setSheetStep] = useState(null); // name | limit
  const [pendingCategoryName, setPendingCategoryName] = useState("");
  const [pendingEmoji, setPendingEmoji] = useState(BUDGET_BILL_EMOJI_PRESETS[0]);
  const [pendingLimitInput, setPendingLimitInput] = useState("1500.00");
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingLimitName, setEditingLimitName] = useState(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);

  const { categoriesById } = useMemo(
    () => mapsFromState({ accounts: [], categories }),
    [categories],
  );
  const cards = useMemo(
    () => buildBudgetCards(budgets, transactions, categoriesById, selectedMonthYear),
    [budgets, transactions, categoriesById, selectedMonthYear],
  );
  const summary = useMemo(() => budgetSummary(cards), [cards]);

  const beginAddBudget = () => {
    setPendingCategoryName("");
    setPendingEmoji(BUDGET_BILL_EMOJI_PRESETS[0]);
    setPendingLimitInput("1500.00");
    setEditingLimitName(null);
    setSheetStep("name");
  };

  const closeSheet = () => {
    setSheetStep(null);
    setPendingCategoryName("");
    setEditingLimitName(null);
  };

  const handleNameStepNext = () => {
    const name = pendingCategoryName.trim();
    if (name.length === 0) {
      Alert.alert("Name required", "Enter a category name for this budget (e.g. Food, School).");
      return;
    }
    const monthBudgets = budgets.filter((b) => b.monthYear === selectedMonthYear);
    const existingCat = categories.find(
      (c) => c.type === "EXPENSE" && c.name.toLowerCase() === name.toLowerCase(),
    );
    if (existingCat) {
      const already = monthBudgets.some((b) => b.categoryId === existingCat.id);
      if (already) {
        Alert.alert("Already exists", `“${existingCat.name}” already has a budget this month.`);
        return;
      }
    }
    setSheetStep("limit");
  };

  const handleLimitConfirm = async (value) => {
    if (busy) return;
    setBusy(true);
    try {
      const limitMinor = parseDecimalToMinor(value.replace(/[₱$,\s]/g, "") || "0");
      if (limitMinor <= 0) {
        throw new Error("Enter a positive budget limit.");
      }
      if (editingLimitName) {
        await addBudget({
          categoryName: editingLimitName,
          limitMinor,
          monthYear: selectedMonthYear,
        });
      } else {
        const name = pendingCategoryName.trim();
        let category = categories.find(
          (c) => c.type === "EXPENSE" && c.name.toLowerCase() === name.toLowerCase(),
        );
        if (!category) {
          category = await addCategory({ name, type: "EXPENSE", icon: pendingEmoji });
        } else if (pendingEmoji) {
          category = await addCategory({ name: category.name, type: "EXPENSE", icon: pendingEmoji });
        }
        await addBudget({
          categoryName: category.name,
          limitMinor,
          monthYear: selectedMonthYear,
        });
      }
      setSheetStep(null);
      setPendingCategoryName("");
      setEditingLimitName(null);
    } catch (error) {
      Alert.alert("Budget failed", error instanceof Error ? error.message : "Could not save budget.");
    } finally {
      setBusy(false);
    }
  };

  const handleRenameConfirm = async (value) => {
    if (editingCategoryId === null || busy) return;
    setBusy(true);
    try {
      await renameCategory(editingCategoryId, value);
      setRenameModalVisible(false);
      setEditingCategoryId(null);
    } catch (error) {
      Alert.alert("Rename failed", error instanceof Error ? error.message : "Could not rename.");
    } finally {
      setBusy(false);
    }
  };

  const openBudgetActions = (budget) => {
    // Android Alert shows at most 3 buttons — keep Cancel | Edit | Delete.
    const category = categories.find(
      (c) => c.type === "EXPENSE" && c.name === budget.name,
    );
    Alert.alert(budget.name, "Manage this budget.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Edit",
        onPress: () => {
          Alert.alert(budget.name, "What do you want to change?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Edit limit",
              onPress: () => {
                setEditingLimitName(budget.name);
                setPendingCategoryName(budget.name);
                setPendingLimitInput(((budget.limitMinor) / 100).toFixed(2));
                setSheetStep("limit");
              },
            },
            {
              text: "Rename",
              onPress: () => {
                if (!category) {
                  Alert.alert("Not found", "Category could not be resolved.");
                  return;
                }
                setEditingCategoryId(category.id);
                setRenameModalVisible(true);
              },
            },
          ]);
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            `Delete “${budget.name}”?`,
            "Removes this month’s budget limit. Transactions stay in history.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                  void deleteBudgetByCategoryName(budget.name, selectedMonthYear).catch((error) => {
                    Alert.alert(
                      "Delete failed",
                      error instanceof Error ? error.message : "Could not delete.",
                    );
                  });
                },
              },
            ],
          );
        },
      },
    ]);
  };

  const limitInitial = (() => {
    if (editingLimitName) {
      const card = cards.find((c) => c.name === editingLimitName);
      return ((card?.limitMinor ?? 500_000) / 100).toFixed(2);
    }
    return "5000.00";
  })();

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.lg }} testID="budgets-screen">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle }}>
          Budgets
        </Text>
        <MonthChip />
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.colors.sub, flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
          {formatMinor(summary.spentMinor, { currencySymbol, showCents: false })} of{" "}
          {formatMinor(summary.limitMinor, { currencySymbol, showCents: false })} total budget spent
        </Text>
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Recurring")}>
          <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
            Bills
          </Text>
        </Pressable>
      </View>

      {cards.length === 0 ? (
        <EmptyState
          actionLabel="＋ Add budget"
          emoji="📊"
          message="Name a category, pick an icon, and set a monthly limit. Long-press a card to edit or delete."
          onAction={beginAddBudget}
          title="No budgets this month"
        />
      ) : (
        cards.map((budget) => (
          <Pressable
            key={budget.name}
            accessibilityHint="Long press to edit limit, rename category, or delete"
            accessibilityLabel={budget.name}
            accessibilityRole="button"
            delayLongPress={350}
            onLongPress={() => openBudgetActions(budget)}
          >
            <BudgetCard {...budget} currencySymbol={currencySymbol} />
          </Pressable>
        ))
      )}

      {cards.length > 0 ? (
        <>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>
            Tip: press and hold a budget card for Edit or Delete.
          </Text>
          <DashedButton disabled={busy} onPress={beginAddBudget}>
            {busy ? "Saving…" : "＋ Add budget"}
          </DashedButton>
        </>
      ) : null}

      {/* 08 Add Budget - Step 1: Category & Icon */}
      <BottomSheet
        onClose={closeSheet}
        testID="add-budget-step1-sheet"
        title="New budget"
        visible={sheetStep === "name"}
      >
        <TextInput
          autoFocus
          onChangeText={setPendingCategoryName}
          placeholder="Sample supplies"
          placeholderTextColor={theme.colors.sub}
          style={{
            backgroundColor: theme.colors.bg,
            borderRadius: theme.radii.row,
            color: theme.colors.text,
            fontFamily: theme.fonts.medium,
            fontSize: theme.typeScale.body,
            height: 48,
            paddingHorizontal: theme.spacing.lg,
          }}
          value={pendingCategoryName}
        />
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.label }}>
          Icon
        </Text>
        <EmojiGrid onChange={setPendingEmoji} value={pendingEmoji} />
        <PrimaryButton onPress={handleNameStepNext}>
          Next: set limit
        </PrimaryButton>
        <Pressable
          accessibilityRole="button"
          onPress={closeSheet}
          style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
        >
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium }}>Cancel</Text>
        </Pressable>
      </BottomSheet>

      {/* 08b Add Budget - Step 2: Set Limit */}
      <BottomSheet
        onClose={closeSheet}
        testID="add-budget-step2-sheet"
        title="Set monthly limit"
        visible={sheetStep === "limit"}
      >
        <TextInput
          autoFocus
          keyboardType="decimal-pad"
          onChangeText={setPendingLimitInput}
          placeholder="1500.00"
          placeholderTextColor={theme.colors.sub}
          style={{
            backgroundColor: theme.colors.bg,
            borderRadius: theme.radii.row,
            color: theme.colors.text,
            fontFamily: theme.fonts.bold,
            fontSize: theme.typeScale.cardHeader,
            height: 48,
            paddingHorizontal: theme.spacing.lg,
          }}
          value={pendingLimitInput}
        />
        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
          {`${pendingCategoryName || editingLimitName || "Budget"} · ${formatMonthChip(selectedMonthYear)}`}
        </Text>
        <EmojiGrid onChange={setPendingEmoji} value={pendingEmoji} />
        <PrimaryButton disabled={busy} onPress={() => void handleLimitConfirm(pendingLimitInput)}>
          {busy ? "Saving…" : "Save budget"}
        </PrimaryButton>
        <Pressable
          accessibilityRole="button"
          onPress={closeSheet}
          style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
        >
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium }}>Cancel</Text>
        </Pressable>
      </BottomSheet>

      <TextPromptModal
        confirmLabel="Rename"
        initialValue={
          categories.find((c) => c.id === editingCategoryId)?.name ?? ""
        }
        message="Renames the category everywhere (budgets, history, entry)."
        onCancel={() => {
          setRenameModalVisible(false);
          setEditingCategoryId(null);
        }}
        onConfirm={(value) => void handleRenameConfirm(value)}
        placeholder="Category name"
        title="Rename category"
        visible={renameModalVisible}
      />
    </ScreenContainer>
  );
}
