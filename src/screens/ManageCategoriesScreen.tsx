import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText as Text } from "../components/AppText";
import { DashedButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import { categoryEmoji } from "../domain/services/financeView";
import type { TransactionType } from "../domain/types";
import type { SettingsStackParamList } from "../navigation/routes";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

type Props = NativeStackScreenProps<SettingsStackParamList, "ManageCategories">;

export function ManageCategoriesScreen({ navigation }: Props) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const categories = useFinanceStore((state) => state.categories);
  const addCategory = useFinanceStore((state) => state.addCategory);
  const [promptType, setPromptType] = useState<TransactionType | null>(null);
  const [busy, setBusy] = useState(false);

  const expense = useMemo(
    () => categories.filter((category) => category.type === "EXPENSE"),
    [categories],
  );
  const income = useMemo(
    () => categories.filter((category) => category.type === "INCOME"),
    [categories],
  );

  const handleAdd = async (name: string) => {
    if (promptType === null) {
      return;
    }
    if (name.trim().length === 0) {
      Alert.alert("Name required", "Enter a category name.");
      return;
    }
    setBusy(true);
    try {
      await addCategory({ name, type: promptType });
      setPromptType(null);
    } catch (error: unknown) {
      Alert.alert("Could not add category", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const renderGroup = (title: string, items: typeof categories) => (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
        {title}
      </Text>
      <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
        {items.map((category) => (
          <View key={`${category.type}-${category.id}`} style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
            <Text style={{ fontSize: theme.typeScale.emptyTitle }}>{categoryEmoji(category.name)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                {category.name}
              </Text>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                {category.isCustom ? "Custom" : "Default"}
              </Text>
            </View>
          </View>
        ))}
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
    </ScreenContainer>
  );
}
