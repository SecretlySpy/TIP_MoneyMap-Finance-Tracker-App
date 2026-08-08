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
  const archiveGoal = useFinanceStore((state) => state.archiveGoal);

  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState("name");
  const [draftName, setDraftName] = useState("");
  const [contributeId, setContributeId] = useState(null);
  const [busy, setBusy] = useState(false);

  const displayGoals = useMemo(() => sortGoalsForDisplay(goals ?? []), [goals]);

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
      if (targetMinor <= 0) {
        throw new Error("Enter a positive target amount.");
      }
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
      if (amountMinor <= 0) {
        throw new Error("Enter a positive amount.");
      }
      await contributeToGoal(contributeId, amountMinor);
      setContributeId(null);
    } catch (error) {
      Alert.alert("Contribute failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

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
          message="Save for tuition, gadgets, or emergency cash — progress stays on this device."
          onAction={() => {
            setCreateStep("name");
            setShowCreate(true);
          }}
          title="No goals yet"
        />
      ) : (
        displayGoals.map((goal) => (
          <SectionCard key={goal.id} padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                Alert.alert(goal.name, "Archive this goal?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Archive",
                    style: "destructive",
                    onPress: () => {
                      void archiveGoal(goal.id).catch((error) => {
                        Alert.alert("Archive failed", error instanceof Error ? error.message : "Unknown error");
                      });
                    },
                  },
                ]);
              }}
            >
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Archive goal
              </Text>
            </Pressable>
          </SectionCard>
        ))
      )}

      {displayGoals.length > 0 ? (
        <DashedButton
          disabled={busy}
          onPress={() => {
            setCreateStep("name");
            setShowCreate(true);
          }}
        >
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
    </ScreenContainer>
  );
}
