import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { DashedButton } from "../components/Buttons";
import { EmptyState } from "../components/EmptyState";
import { GoalCard } from "../components/GoalCard";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import { sortGoalsForDisplay } from "../domain/services/goals";
import { parseDecimalToMinor } from "../domain/services/money";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

export function GoalsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const goals = useFinanceStore((state) => state.goals);
  const addGoal = useFinanceStore((state) => state.addGoal);
  const contributeToGoal = useFinanceStore((state) => state.contributeToGoal);
  const renameGoal = useFinanceStore((state) => state.renameGoal);
  const updateGoal = useFinanceStore((state) => state.updateGoal);
  const deleteGoal = useFinanceStore((state) => state.deleteGoal);

  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState("name");
  const [draftName, setDraftName] = useState("");
  const [contributeId, setContributeId] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [busy, setBusy] = useState(false);

  const displayGoals = useMemo(() => sortGoalsForDisplay(goals ?? []), [goals]);

  const beginCreate = () => {
    setCreateStep("name");
    setDraftName("");
    setShowCreate(true);
  };

  const handleCreateName = (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Give your goal a short name (e.g. New laptop).");
      return;
    }
    setDraftName(trimmed);
    setCreateStep("target");
  };

  const handleCreateTarget = async (value) => {
    if (busy) return;
    setBusy(true);
    try {
      const targetMinor = parseDecimalToMinor(value.replace(/[₱$,\s]/g, "") || "0");
      if (targetMinor <= 0) throw new Error("Enter a positive target amount.");
      await addGoal({ name: draftName, targetMinor });
      setShowCreate(false);
      setCreateStep("name");
      setDraftName("");
    } catch (error) {
      Alert.alert("Could not create goal", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleContribute = async (value) => {
    if (contributeId === null || busy) return;
    setBusy(true);
    try {
      const amountMinor = parseDecimalToMinor(value.replace(/[₱$,\s]/g, "") || "0");
      if (amountMinor <= 0) throw new Error("Enter a positive amount.");
      await contributeToGoal(contributeId, amountMinor);
      setContributeId(null);
    } catch (error) {
      Alert.alert("Contribute failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (value) => {
    if (renameId === null || busy) return;
    setBusy(true);
    try {
      await renameGoal(renameId, value);
      setRenameId(null);
    } catch (error) {
      Alert.alert("Rename failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleTarget = async (value) => {
    if (targetId === null || busy) return;
    setBusy(true);
    try {
      const targetMinor = parseDecimalToMinor(value.replace(/[₱$,\s]/g, "") || "0");
      if (targetMinor <= 0) throw new Error("Enter a positive target.");
      await updateGoal(targetId, { targetMinor });
      setTargetId(null);
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const openGoalMenu = (goal) => {
    Alert.alert(goal.name, "Manage this savings goal.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Rename",
        onPress: () => setRenameId(goal.id),
      },
      {
        text: "Edit target",
        onPress: () => setTargetId(goal.id),
      },
      {
        text: "Contribute",
        onPress: () => setContributeId(goal.id),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete goal?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                void deleteGoal(goal.id).catch((error) => {
                  Alert.alert("Delete failed", error instanceof Error ? error.message : "Unknown error");
                });
              },
            },
          ]);
        },
      },
    ]);
  };

  const targetGoal = (goals ?? []).find((g) => g.id === targetId);
  const renameGoalRow = (goals ?? []).find((g) => g.id === renameId);

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="goals-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Savings goals
        </Text>
      </View>

      {displayGoals.length === 0 ? (
        <EmptyState
          actionLabel="＋ Create a goal"
          emoji="🎯"
          message="Name your goal and set a target — progress stays on this device."
          onAction={beginCreate}
          title="No goals yet"
        />
      ) : (
        displayGoals.map((goal) => (
          <Pressable
            key={goal.id}
            accessibilityHint="Long press for rename, edit target, contribute, or delete"
            accessibilityRole="button"
            onLongPress={() => openGoalMenu(goal)}
          >
            <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
              <GoalCard
                currencySymbol={currencySymbol}
                currentMinor={goal.currentMinor}
                deadlineEpochMillis={goal.deadlineEpochMillis}
                isComplete={goal.isComplete}
                isOverdue={goal.isOverdue}
                name={goal.name}
                onContribute={() => setContributeId(goal.id)}
                progressPercent={goal.progressPercent}
                targetMinor={goal.targetMinor}
              />
            </SectionCard>
          </Pressable>
        ))
      )}

      {displayGoals.length > 0 ? (
        <DashedButton disabled={busy} onPress={beginCreate}>
          ＋ Add goal
        </DashedButton>
      ) : null}

      <TextPromptModal
        confirmLabel="Next"
        message="What are you saving for?"
        onCancel={() => {
          setShowCreate(false);
          setCreateStep("name");
          setDraftName("");
        }}
        onConfirm={handleCreateName}
        placeholder="New laptop"
        title="Goal name"
        visible={showCreate && createStep === "name"}
      />
      <TextPromptModal
        confirmLabel="Create"
        initialValue="5000.00"
        keyboardType="decimal-pad"
        message={`Target amount for “${draftName}”`}
        onCancel={() => {
          setShowCreate(false);
          setCreateStep("name");
          setDraftName("");
        }}
        onConfirm={(value) => void handleCreateTarget(value)}
        placeholder="5000.00"
        title="Target amount"
        visible={showCreate && createStep === "target"}
      />
      <TextPromptModal
        confirmLabel="Add"
        initialValue="100.00"
        keyboardType="decimal-pad"
        message="How much are you setting aside now?"
        onCancel={() => setContributeId(null)}
        onConfirm={(value) => void handleContribute(value)}
        placeholder="100.00"
        title="Contribute"
        visible={contributeId !== null}
      />
      <TextPromptModal
        confirmLabel="Rename"
        initialValue={renameGoalRow?.name ?? ""}
        onCancel={() => setRenameId(null)}
        onConfirm={(value) => void handleRename(value)}
        placeholder="Goal name"
        title="Rename goal"
        visible={renameId !== null}
      />
      <TextPromptModal
        confirmLabel="Save"
        initialValue={targetGoal ? (targetGoal.targetMinor / 100).toFixed(2) : "5000.00"}
        keyboardType="decimal-pad"
        onCancel={() => setTargetId(null)}
        onConfirm={(value) => void handleTarget(value)}
        placeholder="5000.00"
        title="Edit target"
        visible={targetId !== null}
      />
    </ScreenContainer>
  );
}
