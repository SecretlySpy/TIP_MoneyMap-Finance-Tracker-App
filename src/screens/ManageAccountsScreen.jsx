import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { DashedButton } from "../components/Buttons";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import { accountChipLabel } from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

const ACCOUNT_TYPES = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "EWALLET", label: "E-wallet" },
];

export function ManageAccountsScreen({ navigation }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const accounts = useFinanceStore((state) => state.accounts);
  const updateAccount = useFinanceStore((state) => state.updateAccount);
  const createAccount = useFinanceStore((state) => state.createAccount);
  const deleteAccount = useFinanceStore((state) => state.deleteAccount);

  const [renameId, setRenameId] = useState(null);
  const [balanceId, setBalanceId] = useState(null);
  const [createStep, setCreateStep] = useState(null); // name | type
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("CASH");
  const [busy, setBusy] = useState(false);

  const active = accounts.filter((account) => !account.isArchived);

  const handleRename = async (name) => {
    if (renameId === null || name.trim().length === 0) {
      setRenameId(null);
      return;
    }
    try {
      await updateAccount({ id: renameId, name: name.trim() });
      setRenameId(null);
    } catch (error) {
      Alert.alert("Rename failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const handleBalance = async (value) => {
    if (balanceId === null) return;
    try {
      const amountMinor = parseDecimalToMinor(value.replace(/[₱$,\s]/g, "") || "0");
      await updateAccount({ id: balanceId, startingBalanceMinor: amountMinor });
      setBalanceId(null);
    } catch (error) {
      Alert.alert("Balance update failed", error instanceof Error ? error.message : "Enter a valid amount.");
    }
  };

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createAccount({
        name: draftName.trim() || accountChipLabel(draftType).replace(/^\S+\s/, ""),
        type: draftType,
        startingBalanceMinor: 0,
      });
      setCreateStep(null);
      setDraftName("");
      setDraftType("CASH");
    } catch (error) {
      Alert.alert("Create failed", error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (account) => {
    Alert.alert(`Delete “${account.name}”?`, "Permanently removes this account. Blocked if it still has transactions or bills.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteAccount(account.id).catch((error) => {
            Alert.alert("Delete failed", error instanceof Error ? error.message : "Could not delete.");
          });
        },
      },
    ]);
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="manage-accounts-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Manage accounts
        </Text>
      </View>

      {active.length === 0 ? (
        <EmptyState
          actionLabel="＋ Add account"
          emoji="🏦"
          message="Add Cash, Card, or E-wallet accounts with your own labels."
          onAction={() => setCreateStep("name")}
          title="No active accounts"
        />
      ) : (
        <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.lg }}>
          {active.map((account) => (
            <View
              key={account.id}
              style={{
                borderBottomColor: theme.colors.outline,
                borderBottomWidth: theme.spacing.hairline,
                gap: theme.spacing.sm,
                paddingBottom: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                  {accountChipLabel(account.type)} · {account.name}
                </Text>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                  Starting balance {formatMinor(account.startingBalanceMinor, { currencySymbol })}
                </Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={theme.spacing.sm}
                  onPress={() => setRenameId(account.id)}
                  style={{ justifyContent: "center", minHeight: 44 }}
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                    Rename
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={theme.spacing.sm}
                  onPress={() => setBalanceId(account.id)}
                  style={{ justifyContent: "center", minHeight: 44 }}
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                    Edit balance
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={theme.spacing.sm}
                  onPress={() => handleDelete(account)}
                  style={{ justifyContent: "center", minHeight: 44 }}
                >
                  <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      {active.length > 0 ? (
        <DashedButton disabled={busy} onPress={() => setCreateStep("name")}>
          ＋ Add account
        </DashedButton>
      ) : null}

      {createStep === "type" ? (
        <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            Account type for “{draftName || "New account"}”
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {ACCOUNT_TYPES.map((option) => (
              <Chip
                key={option.value}
                onPress={() => setDraftType(option.value)}
                selected={draftType === option.value}
                style={{ minHeight: 44 }}
              >
                {option.label}
              </Chip>
            ))}
          </View>
          <DashedButton disabled={busy} onPress={() => void handleCreate()}>
            {busy ? "Creating…" : "Create account"}
          </DashedButton>
          <Pressable onPress={() => setCreateStep(null)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, textAlign: "center" }}>
              Cancel
            </Text>
          </Pressable>
        </SectionCard>
      ) : null}

      <TextPromptModal
        confirmLabel="Rename"
        initialValue={active.find((account) => account.id === renameId)?.name ?? ""}
        onCancel={() => setRenameId(null)}
        onConfirm={(value) => void handleRename(value)}
        placeholder="Account name"
        title="Rename account"
        visible={renameId !== null}
      />
      <TextPromptModal
        confirmLabel="Save"
        initialValue={(() => {
          const account = active.find((item) => item.id === balanceId);
          if (account === undefined) return "0";
          return (account.startingBalanceMinor / 100).toFixed(2);
        })()}
        keyboardType="decimal-pad"
        message="Starting balance is added to your total balance."
        onCancel={() => setBalanceId(null)}
        onConfirm={(value) => void handleBalance(value)}
        placeholder="0.00"
        title="Starting balance"
        visible={balanceId !== null}
      />
      <TextPromptModal
        confirmLabel="Next"
        message="Custom label (e.g. GCash, Maya, BPI)."
        onCancel={() => {
          setCreateStep(null);
          setDraftName("");
        }}
        onConfirm={(value) => {
          const name = value.trim();
          if (!name) {
            Alert.alert("Name required", "Enter an account name.");
            return;
          }
          setDraftName(name);
          setCreateStep("type");
        }}
        placeholder="GCash"
        title="New account name"
        visible={createStep === "name"}
      />
    </ScreenContainer>
  );
}
