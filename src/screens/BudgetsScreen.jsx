import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BudgetCard } from "../components/BudgetCard";
import { DashedButton } from "../components/Buttons";
import { EmojiPickerRow } from "../components/EmojiPickerRow";
import { EmptyState } from "../components/EmptyState";
import { MonthChip } from "../components/MonthChip";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import { BUDGET_BILL_EMOJI_PRESETS } from "../domain/services/emoji";
import { budgetSummary, buildBudgetCards } from "../domain/services/financeView";
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
  const [step, setStep] = useState(null); // name | emoji | limit | rename
  const [pendingCategoryName, setPendingCategoryName] = useState("");
  const [pendingEmoji, setPendingEmoji] = useState(BUDGET_BILL_EMOJI_PRESETS[0]);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingLimitName, setEditingLimitName] = useState(null);

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
    setEditingLimitName(null);
    setStep("name");
  };

  const handleNameConfirm = (value) => {
    const name = value.trim();
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
    setPendingCategoryName(name);
    setStep("emoji");
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
      setStep(null);
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
      setStep(null);
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
                setStep("limit");
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
                setStep("rename");
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

      <TextPromptModal
        confirmLabel="Next"
        message="Existing expense category or a new custom name."
        onCancel={() => {
          setStep(null);
          setPendingCategoryName("");
        }}
        onConfirm={handleNameConfirm}
        placeholder="Food, School, Load…"
        title="Budget category name"
        visible={step === "name"}
      />

      {step === "emoji" ? (
        <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            Icon for “{pendingCategoryName}”
          </Text>
          <EmojiPickerRow onChange={setPendingEmoji} value={pendingEmoji} />
          <DashedButton
            onPress={() => setStep("limit")}
          >
            Next: set limit
          </DashedButton>
          <Pressable
            onPress={() => {
              setStep(null);
              setPendingCategoryName("");
            }}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, textAlign: "center" }}>
              Cancel
            </Text>
          </Pressable>
        </SectionCard>
      ) : null}

      <TextPromptModal
        confirmLabel="Save"
        initialValue={limitInitial}
        keyboardType="decimal-pad"
        message={
          editingLimitName
            ? `Monthly limit for ${editingLimitName}`
            : `Monthly limit for ${pendingCategoryName || "this category"}`
        }
        onCancel={() => {
          setStep(null);
          setPendingCategoryName("");
          setEditingLimitName(null);
        }}
        onConfirm={(value) => void handleLimitConfirm(value)}
        placeholder="5000.00"
        title={editingLimitName ? "Edit budget limit" : "Budget limit"}
        visible={step === "limit"}
      />
      <TextPromptModal
        confirmLabel="Rename"
        initialValue={
          categories.find((c) => c.id === editingCategoryId)?.name ?? ""
        }
        message="Renames the category everywhere (budgets, history, entry)."
        onCancel={() => {
          setStep(null);
          setEditingCategoryId(null);
        }}
        onConfirm={(value) => void handleRenameConfirm(value)}
        placeholder="Category name"
        title="Rename category"
        visible={step === "rename"}
      />
    </ScreenContainer>
  );
}
