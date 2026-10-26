import { useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { BottomSheet } from "../components/BottomSheet";
import { BudgetCard } from "../components/BudgetCard";
import { PrimaryButton } from "../components/Buttons";
import { EmojiGrid } from "../components/EmojiGrid";
import { EmptyState } from "../components/EmptyState";
import { MonthChip } from "../components/MonthChip";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextPromptModal } from "../components/TextPromptModal";
import { BUDGET_BILL_EMOJI_PRESETS } from "../domain/services/emoji";
import { budgetSummary, buildBudgetCards, formatMonthChip, shiftMonthYear } from "../domain/services/financeView";
import { computeCategoryRollover, formatRolloverEquation, getBudgetsToCopy } from "../domain/services/rollover";
import { BudgetTemplateModal } from "../components/BudgetTemplateModal";
import { formatMinor, minorToWholePesos, parseWholePesosToMinor } from "../domain/services/money";
import { mapsFromState, useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

export function BudgetsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const budgets = useFinanceStore((state) => state.budgets);
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const accounts = useFinanceStore((state) => state.accounts);
  const selectedMonthYear = useFinanceStore((state) => state.selectedMonthYear);
  const addBudget = useFinanceStore((state) => state.addBudget);
  const addCategory = useFinanceStore((state) => state.addCategory);
  const renameCategory = useFinanceStore((state) => state.renameCategory);
  const deleteBudgetByCategoryName = useFinanceStore((state) => state.deleteBudgetByCategoryName);

  const [busy, setBusy] = useState(false);
  const [sheetStep, setSheetStep] = useState(null); // name | limit
  const [pendingCategoryName, setPendingCategoryName] = useState("");
  const [pendingEmoji, setPendingEmoji] = useState(BUDGET_BILL_EMOJI_PRESETS[0]);
  const [pendingLimitInput, setPendingLimitInput] = useState("1500");
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingLimitName, setEditingLimitName] = useState(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [semesterSheetVisible, setSemesterSheetVisible] = useState(false);
  const [selectedRolloverBudget, setSelectedRolloverBudget] = useState(null);

  const { categoriesById } = useMemo(
    () => mapsFromState({ accounts: [], categories }),
    [categories],
  );
  const cards = useMemo(
    () => buildBudgetCards(budgets, transactions, categoriesById, selectedMonthYear, accounts),
    [budgets, transactions, categoriesById, selectedMonthYear, accounts],
  );
  const summary = useMemo(() => budgetSummary(cards), [cards]);

  const selectedRolloverCategory = useMemo(() => {
    if (!selectedRolloverBudget) return null;
    return categories.find((c) => c.type === "EXPENSE" && c.name === selectedRolloverBudget.name);
  }, [categories, selectedRolloverBudget]);

  const rolloverData = useMemo(() => {
    if (!selectedRolloverCategory) return null;
    return computeCategoryRollover({
      categoryId: selectedRolloverCategory.id,
      monthYear: selectedMonthYear,
      budgets,
      transactions,
    });
  }, [selectedRolloverCategory, selectedMonthYear, budgets, transactions]);

  const beginAddBudget = () => {
    setPendingCategoryName("");
    setPendingEmoji(BUDGET_BILL_EMOJI_PRESETS[0]);
    setPendingLimitInput("1500");
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
      const originalLimit = editingLimitName
        ? cards.find((card) => card.name === editingLimitName)?.limitMinor
        : null;
      const limitMinor = originalLimit != null && value.trim() === String(minorToWholePesos(originalLimit))
        ? originalLimit
        : parseWholePesosToMinor(value.trim());
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
                setPendingLimitInput(String(minorToWholePesos(budget.limitMinor)));
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
            Bills ›
          </Text>
        </Pressable>
      </View>

      {cards.length === 0 ? (
        <EmptyState
          actionLabel="Add Budget"
          emoji="📊"
          message="Name a category, pick an icon, and set a monthly limit. Long-press a card to edit or delete."
          onAction={beginAddBudget}
          title="No budgets this month"
        />
      ) : (
        cards.map((budget) => (
          <Pressable
            key={budget.name}
            accessibilityHint="Tap to view rollover breakdown. Long press to edit limit, rename category, or delete"
            accessibilityLabel={budget.name}
            accessibilityRole="button"
            delayLongPress={350}
            onLongPress={() => openBudgetActions(budget)}
            onPress={() => setSelectedRolloverBudget(budget)}
          >
            <BudgetCard {...budget} currencySymbol={currencySymbol} />
          </Pressable>
        ))
      )}

      {cards.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.tiny }}>
            Tip: press and hold a budget card to edit or delete.
          </Text>
          <PrimaryButton disabled={busy} onPress={beginAddBudget}>
            {busy ? "Saving…" : "Add Budget"}
          </PrimaryButton>
          <Pressable
            accessibilityLabel="Semester Plan"
            accessibilityRole="button"
            onPress={() => setSemesterSheetVisible(true)}
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outline,
              borderRadius: theme.radii.button,
              borderWidth: 1,
              height: theme.sizes.primaryButton,
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              🎓 Semester Plan
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: "center" }}>
          <Pressable accessibilityRole="button" onPress={() => setSemesterSheetVisible(true)}>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold }}>
              🎓 Semester Plan
            </Text>
          </Pressable>
        </View>
      )}

      {/* 08 Add Budget - Step 1: Category & Icon */}
      <BottomSheet
        onClose={closeSheet}
        testID="add-budget-step1-sheet"
        title="New budget"
        visible={sheetStep === "name"}
      >
        <TextInput
          accessibilityLabel="Budget category"
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
          Next
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
          accessibilityLabel="Monthly limit"
          autoFocus
          keyboardType="number-pad"
          onChangeText={setPendingLimitInput}
          placeholder="1500"
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

      {/* 08d Student Semester Templates Modal & Manager */}
      <BudgetTemplateModal
        onClose={() => setSemesterSheetVisible(false)}
        targetMonthYear={selectedMonthYear}
        visible={semesterSheetVisible}
      />

      {/* 08c Budget Rollover Sheet - Frame 299:2788 */}
      {selectedRolloverBudget && rolloverData ? (
        <BottomSheet
          onClose={() => setSelectedRolloverBudget(null)}
          testID="budget-rollover-sheet"
          title={`${selectedRolloverBudget.name} · Budget Rollover`}
          visible={selectedRolloverBudget !== null}
        >
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}>
            {/* Frame 299:2788 Equation Card */}
            <View
              style={{
                backgroundColor: theme.colors.tint,
                borderColor: theme.colors.primary,
                borderRadius: theme.radii.card,
                borderWidth: 1,
                gap: theme.spacing.xs,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                {rolloverData.formulaDescription}
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.cardHeader }}>
                {formatRolloverEquation(
                  rolloverData.priorCarryMinor,
                  rolloverData.planMinor,
                  rolloverData.actualSpentMinor,
                  rolloverData.nextCarryMinor,
                  currencySymbol
                )}
              </Text>
              <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.chip, padding: theme.spacing.xs, marginTop: theme.spacing.xxs }}>
                <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny, fontFamily: theme.fonts.medium }}>
                  {rolloverData.safeToSpendGuarantee}
                </Text>
              </View>
            </View>

            {/* Detailed Breakdown */}
            <View style={{ backgroundColor: theme.colors.bg, borderRadius: theme.radii.row, padding: theme.spacing.md, gap: theme.spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                  Prior Carry ({rolloverData.priorMonthYear})
                </Text>
                <Text style={{ color: rolloverData.priorCarryMinor >= 0 ? theme.colors.income : theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                  {formatMinor(rolloverData.priorCarryMinor, { currencySymbol })}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                  This Month Plan ({selectedMonthYear})
                </Text>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                  {formatMinor(rolloverData.planMinor, { currencySymbol })}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                  Actual Spent
                </Text>
                <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                  -{formatMinor(rolloverData.actualSpentMinor, { currencySymbol })}
                </Text>
              </View>
              <View style={{ borderTopColor: theme.colors.outline, borderTopWidth: theme.spacing.hairline, paddingTop: theme.spacing.xs, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                  Next Carry-forward
                </Text>
                <Text style={{ color: rolloverData.nextCarryMinor >= 0 ? theme.colors.income : theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                  {formatMinor(rolloverData.nextCarryMinor, { currencySymbol })}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedRolloverBudget(null)}
              style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
            >
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium }}>Close</Text>
            </Pressable>
          </View>
        </BottomSheet>
      ) : null}
    </ScreenContainer>
  );
}
