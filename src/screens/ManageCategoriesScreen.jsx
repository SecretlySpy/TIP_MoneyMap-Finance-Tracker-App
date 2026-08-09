import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { DashedButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import { categoryEmoji } from "../domain/services/financeView";
import { useFinanceStore } from "../store/financeStore";
import { useTheme } from "../theme/tokens";

export function ManageCategoriesScreen({ navigation }) {
  const theme = useTheme();
  const categories = useFinanceStore((state) => state.categories);
  const addCategory = useFinanceStore((state) => state.addCategory);
  const renameCategory = useFinanceStore((state) => state.renameCategory);
  const deleteCategory = useFinanceStore((state) => state.deleteCategory);

  const [promptType, setPromptType] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [busy, setBusy] = useState(false);

  const expense = useMemo(
    () => categories.filter((category) => category.type === "EXPENSE"),
    [categories],
  );
  const income = useMemo(
    () => categories.filter((category) => category.type === "INCOME"),
    [categories],
  );

  const handleAdd = async (name) => {
    if (promptType === null) return;
    if (name.trim().length === 0) {
      Alert.alert("Name required", "Enter a category name.");
      return;
    }
    setBusy(true);
    try {
      await addCategory({ name, type: promptType });
      setPromptType(null);
    } catch (error) {
      Alert.alert("Could not add category", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (name) => {
    if (renameId === null) return;
    setBusy(true);
    try {
      await renameCategory(renameId, name);
      setRenameId(null);
    } catch (error) {
      Alert.alert("Rename failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (category) => {
    Alert.alert(category.name, "Delete this category? Blocked if used by transactions, budgets, or bills.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteCategory(category.id).catch((error) => {
            Alert.alert("Cannot delete", error instanceof Error ? error.message : "Unknown error");
          });
        },
      },
    ]);
  };

  const renderGroup = (title, items) => (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
        {title}
      </Text>
      <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
        {items.length === 0 ? (
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
            No {title.toLowerCase()} categories yet. Add one below.
          </Text>
        ) : (
          items.map((category) => (
            <View
              key={`${category.type}-${category.id}`}
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: theme.spacing.md,
                minHeight: 44,
              }}
            >
              <Text style={{ fontSize: theme.typeScale.emptyTitle }}>{categoryEmoji(category.name)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                  {category.name}
                </Text>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                  {category.isCustom ? "Custom" : "Default"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                hitSlop={theme.spacing.sm}
                onPress={() => setRenameId(category.id)}
                style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: theme.spacing.sm }}
              >
                <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                  Rename
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                hitSlop={theme.spacing.sm}
                onPress={() => handleDelete(category)}
                style={{ justifyContent: "center", minHeight: 44, paddingHorizontal: theme.spacing.sm }}
              >
                <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                  Delete
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </SectionCard>
    </View>
  );

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="manage-categories-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Manage categories
        </Text>
      </View>
      {renderGroup("EXPENSE", expense)}
      {renderGroup("INCOME", income)}
      <DashedButton disabled={busy} onPress={() => setPromptType("EXPENSE")}>
        ＋ Add expense category
      </DashedButton>
      <DashedButton disabled={busy} onPress={() => setPromptType("INCOME")}>
        ＋ Add income category
      </DashedButton>
      <TextPromptModal
        confirmLabel="Add"
        message="Custom categories stay on this device only."
        onCancel={() => setPromptType(null)}
        onConfirm={(value) => void handleAdd(value)}
        placeholder="Category name"
        title={promptType === "INCOME" ? "New income category" : "New expense category"}
        visible={promptType !== null}
      />
      <TextPromptModal
        confirmLabel="Rename"
        initialValue={categories.find((c) => c.id === renameId)?.name ?? ""}
        message="Used as the label on budgets, history, and entry."
        onCancel={() => setRenameId(null)}
        onConfirm={(value) => void handleRename(value)}
        placeholder="Category name"
        title="Rename category"
        visible={renameId !== null}
      />
    </ScreenContainer>
  );
}
