import { useMemo, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { BottomSheet } from "../components/BottomSheet";
import { AppText as Text } from "../components/AppText";
import { Chip } from "../components/Chip";
import { PrimaryButton } from "../components/Buttons";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import { accountChipLabel, computeAccountBalances } from "../domain/services/financeView";
import { formatMinor, minorToWholePesos, parseWholePesosToMinor } from "../domain/services/money";
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
  const archiveAccount = useFinanceStore((state) => state.archiveAccount);
  const unarchiveAccount = useFinanceStore((state) => state.unarchiveAccount);
  const transactions = useFinanceStore((state) => state.transactions);
  const transfers = useFinanceStore((state) => state.transfers);
  const addTransaction = useFinanceStore((state) => state.addTransaction);

  const [renameId, setRenameId] = useState(null);
  const [balanceId, setBalanceId] = useState(null);
  const [createStep, setCreateStep] = useState(null); // name | type
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("CASH");
  const [busy, setBusy] = useState(false);
  const [selectedDetailAccountId, setSelectedDetailAccountId] = useState(null);
  const [statementBalanceInput, setStatementBalanceInput] = useState("");
  const [statementDate, setStatementDate] = useState(() => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  const [clearedTxIds, setClearedTxIds] = useState(new Set());
  const [lastReconciled, setLastReconciled] = useState({});

  const active = accounts.filter((account) => !account.isArchived);
  const archived = accounts.filter((account) => account.isArchived);

  const calculatedAccounts = useMemo(
    () => computeAccountBalances(accounts, transactions, transfers),
    [accounts, transactions, transfers],
  );
  const selectedDetailAccount = accounts.find((a) => a.id === selectedDetailAccountId);
  const detailAccountCalculated = calculatedAccounts.find((a) => a.id === selectedDetailAccountId);

  const accountTransactions = useMemo(() => {
    if (!selectedDetailAccountId) return [];
    return transactions
      .filter((t) => t.accountId === selectedDetailAccountId)
      .sort((a, b) => b.dateEpochMillis - a.dateEpochMillis);
  }, [transactions, selectedDetailAccountId]);

  const accountTransfers = useMemo(() => {
    if (!selectedDetailAccountId) return [];
    return transfers
      .filter(
        (t) => t.fromAccountId === selectedDetailAccountId || t.toAccountId === selectedDetailAccountId
      )
      .sort((a, b) => b.dateEpochMillis - a.dateEpochMillis);
  }, [transfers, selectedDetailAccountId]);

  const workingBalanceMinor = detailAccountCalculated?.balanceMinor ?? (selectedDetailAccount?.startingBalanceMinor ?? 0);

  const clearedBalanceMinor = useMemo(() => {
    if (!selectedDetailAccount) return 0;
    let total = selectedDetailAccount.startingBalanceMinor;
    for (const tx of accountTransactions) {
      if (clearedTxIds.has(`tx:${tx.id}`)) {
        if (tx.type === "INCOME") total += tx.amountMinor;
        else if (tx.type === "EXPENSE") total -= tx.amountMinor;
      }
    }
    for (const tr of accountTransfers) {
      if (clearedTxIds.has(`tr:${tr.id}`)) {
        if (tr.toAccountId === selectedDetailAccount.id) total += tr.amountMinor;
        if (tr.fromAccountId === selectedDetailAccount.id) total -= tr.amountMinor;
      }
    }
    return total;
  }, [selectedDetailAccount, accountTransactions, accountTransfers, clearedTxIds]);

  const diffMinor = workingBalanceMinor - clearedBalanceMinor;

  const toggleCleared = (key) => {
    setClearedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreateAdjustment = async () => {
    if (!selectedDetailAccount || diffMinor === 0 || busy) return;
    setBusy(true);
    try {
      const adjTx = await addTransaction({
        accountId: selectedDetailAccount.id,
        amountMinor: Math.abs(diffMinor),
        type: diffMinor > 0 ? "EXPENSE" : "INCOME",
        note: "Reconciliation adjustment",
        dateEpochMillis: Date.now(),
      });
      if (adjTx?.id) {
        setClearedTxIds((prev) => new Set(prev).add(`tx:${adjTx.id}`));
      }
      Alert.alert(
        "Adjustment Created",
        `Created explicit ${formatMinor(Math.abs(diffMinor), { currencySymbol })} adjustment transaction. Ledger is balanced.`
      );
    } catch (err) {
      Alert.alert("Adjustment Failed", err instanceof Error ? err.message : "Could not create adjustment.");
    } finally {
      setBusy(false);
    }
  };

  const openDetailSheet = (account) => {
    setSelectedDetailAccountId(account.id);
    setStatementBalanceInput("");
    const initialCleared = new Set();
    for (const tx of transactions) {
      if (tx.accountId === account.id) initialCleared.add(`tx:${tx.id}`);
    }
    for (const tr of transfers) {
      if (tr.fromAccountId === account.id || tr.toAccountId === account.id) {
        initialCleared.add(`tr:${tr.id}`);
      }
    }
    setClearedTxIds(initialCleared);
  };

  const parsedStatementMinor = useMemo(() => {
    try {
      return parseWholePesosToMinor(statementBalanceInput.trim(), { allowNegative: true });
    } catch {
      return null;
    }
  }, [statementBalanceInput]);

  const reconciliationMatches =
    (parsedStatementMinor !== null &&
      statementBalanceInput.trim().length > 0 &&
      parsedStatementMinor === (detailAccountCalculated?.balanceMinor ?? selectedDetailAccount?.startingBalanceMinor)) ||
    (statementBalanceInput.trim().length === 0 && diffMinor === 0);

  const handleArchive = (account) => {
    Alert.alert(
      `Archive "${account.name}"?`,
      "Hides the account from entry and balances. Its transactions stay in History and it can be restored later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => {
            void archiveAccount(account.id).catch((error) => {
              Alert.alert("Archive failed", error instanceof Error ? error.message : "Could not archive.");
            });
          },
        },
      ],
    );
  };

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
      const originalMinor = accounts.find((account) => account.id === balanceId)?.startingBalanceMinor;
      // A card account can legitimately open in debt; unchanged legacy centavos stay exact.
      const amountMinor = originalMinor != null && value.trim() === String(minorToWholePesos(originalMinor))
        ? originalMinor
        : parseWholePesosToMinor(value.trim(), { allowNegative: true });
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
          actionLabel="+ Add account"
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
                  accessibilityLabel="Details & Reconcile"
                  accessibilityRole="button"
                  hitSlop={theme.spacing.sm}
                  onPress={() => openDetailSheet(account)}
                  style={{ justifyContent: "center", minHeight: 44 }}
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                    Details & Reconcile
                  </Text>
                </Pressable>
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
                  onPress={() => handleArchive(account)}
                  style={{ justifyContent: "center", minHeight: 44 }}
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                    Archive
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
        <PrimaryButton disabled={busy} onPress={() => setCreateStep("name")}>
          + Add account
        </PrimaryButton>
      ) : null}

      {archived.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
            ARCHIVED
          </Text>
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.lg }}>
            {archived.map((account) => (
              <View key={account.id} style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.md }}>
                <Text style={{ color: theme.colors.sub, flex: 1, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                  {accountChipLabel(account.type)} · {account.name}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={theme.spacing.sm}
                  onPress={() => {
                    void unarchiveAccount(account.id).catch((error) => {
                      Alert.alert("Restore failed", error instanceof Error ? error.message : "Could not restore.");
                    });
                  }}
                  style={{ justifyContent: "center", minHeight: 44 }}
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                    Restore
                  </Text>
                </Pressable>
              </View>
            ))}
          </SectionCard>
        </View>
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
          <PrimaryButton disabled={busy} onPress={() => void handleCreate()}>
            {busy ? "Creating…" : "Create account"}
          </PrimaryButton>
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
           return String(minorToWholePesos(account.startingBalanceMinor));
        })()}
         keyboardType="numbers-and-punctuation"
         message="Starting balance is added to your total balance. Use a leading minus for card debt, e.g. -1500."
        onCancel={() => setBalanceId(null)}
        onConfirm={(value) => void handleBalance(value)}
         placeholder="0"
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

      {selectedDetailAccount ? (
        <BottomSheet
          onClose={() => setSelectedDetailAccountId(null)}
          title={`${selectedDetailAccount.name} · Details & Reconcile`}
          visible={selectedDetailAccountId !== null}
        >
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            {/* Frame 299:2785: Working vs Cleared banner */}
            <View
              style={{
                backgroundColor: theme.colors.tint,
                borderColor: theme.colors.primary,
                borderRadius: theme.radii.row,
                borderWidth: 1,
                gap: theme.spacing.xxs,
                padding: theme.spacing.md,
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.body,
                }}
              >
                {`Working: ${formatMinor(workingBalanceMinor, { currencySymbol, showCents: false })} • Cleared: ${formatMinor(clearedBalanceMinor, { currencySymbol, showCents: false })} • Diff: ${formatMinor(diffMinor, { currencySymbol, showCents: false })}`}
              </Text>
              <Text
                style={{
                  color: theme.colors.sub,
                  fontFamily: theme.fonts.regular,
                  fontSize: theme.typeScale.tiny,
                }}
              >
                Mark transactions cleared. Explicit adjustment only.
              </Text>
            </View>

            <View style={{ backgroundColor: theme.colors.bg, borderRadius: theme.radii.row, padding: theme.spacing.md }}>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small, fontFamily: theme.fonts.bold }}>
                Working Balance
              </Text>
              <Text style={{ color: theme.colors.text, fontSize: 24, fontFamily: theme.fonts.bold }}>
                {formatMinor(detailAccountCalculated?.balanceMinor ?? selectedDetailAccount.startingBalanceMinor, { currencySymbol })}
              </Text>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                Starting balance {formatMinor(selectedDetailAccount.startingBalanceMinor, { currencySymbol })} + transactions & transfers
              </Text>
            </View>

            {/* Checklist of transactions for clearing */}
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                Transactions Checklist
              </Text>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                Mark transactions cleared. Explicit adjustment only.
              </Text>
              {accountTransactions.length === 0 && accountTransfers.length === 0 ? (
                <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small, fontStyle: "italic", paddingVertical: theme.spacing.sm }}>
                  No transactions recorded for this account yet.
                </Text>
              ) : (
                accountTransactions.map((tx) => {
                  const isCleared = clearedTxIds.has(`tx:${tx.id}`);
                  return (
                    <Pressable
                      key={`tx:${tx.id}`}
                      accessibilityLabel={`${tx.note || "Transaction"} ${isCleared ? "cleared" : "pending"}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isCleared }}
                      onPress={() => toggleCleared(`tx:${tx.id}`)}
                      style={{
                        alignItems: "center",
                        backgroundColor: isCleared ? theme.colors.bg : theme.colors.surface,
                        borderColor: isCleared ? theme.colors.primary : theme.colors.outline,
                        borderRadius: theme.radii.row,
                        borderWidth: 1,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        minHeight: 44,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flex: 1 }}>
                        <Text style={{ color: isCleared ? theme.colors.primary : theme.colors.sub, fontFamily: theme.fonts.bold }}>
                          {isCleared ? "☑ Cleared" : "☐ Pending"}
                        </Text>
                        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }} numberOfLines={1}>
                          {tx.note || (tx.type === "INCOME" ? "Income" : "Expense")}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: tx.type === "INCOME" ? theme.colors.income : theme.colors.text,
                          fontFamily: theme.fonts.bold,
                          fontSize: theme.typeScale.small,
                        }}
                      >
                        {tx.type === "INCOME" ? "+" : "-"}{formatMinor(tx.amountMinor, { currencySymbol })}
                      </Text>
                    </Pressable>
                  );
                })
              )}
              {accountTransfers.map((tr) => {
                const isCleared = clearedTxIds.has(`tr:${tr.id}`);
                const isOutbound = tr.fromAccountId === selectedDetailAccount.id;
                return (
                  <Pressable
                    key={`tr:${tr.id}`}
                    accessibilityLabel={`Transfer ${tr.note || ""} ${isCleared ? "cleared" : "pending"}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isCleared }}
                    onPress={() => toggleCleared(`tr:${tr.id}`)}
                    style={{
                      alignItems: "center",
                      backgroundColor: isCleared ? theme.colors.bg : theme.colors.surface,
                      borderColor: isCleared ? theme.colors.primary : theme.colors.outline,
                      borderRadius: theme.radii.row,
                      borderWidth: 1,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      minHeight: 44,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flex: 1 }}>
                      <Text style={{ color: isCleared ? theme.colors.primary : theme.colors.sub, fontFamily: theme.fonts.bold }}>
                        {isCleared ? "☑ Cleared" : "☐ Pending"}
                      </Text>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }} numberOfLines={1}>
                        Transfer: {tr.note || (isOutbound ? "Outbound" : "Inbound")}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: isOutbound ? theme.colors.expense : theme.colors.income,
                        fontFamily: theme.fonts.bold,
                        fontSize: theme.typeScale.small,
                      }}
                    >
                      {isOutbound ? "-" : "+"}{formatMinor(tr.amountMinor, { currencySymbol })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Explicit adjustment only when diff !== 0 */}
            {diffMinor !== 0 ? (
              <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
                <View style={{ backgroundColor: theme.colors.amberBg, borderRadius: theme.radii.chip, padding: theme.spacing.md }}>
                  <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                    Ledger discrepancy: {formatMinor(Math.abs(diffMinor), { currencySymbol })} difference between working and cleared totals.
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Create adjustment transaction"
                  accessibilityRole="button"
                  onPress={() => void handleCreateAdjustment()}
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary,
                    borderRadius: theme.radii.button,
                    borderWidth: 1,
                    height: theme.sizes.primaryButton,
                    justifyContent: "center",
                    minHeight: 44,
                  }}
                >
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                    + Create Adjustment Transaction
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                Reconciliation Check
              </Text>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                Compare your actual bank / e-wallet statement to MoneyMap's working balance.
              </Text>
              <TextInput
                accessibilityLabel="Statement balance"
                 keyboardType="numbers-and-punctuation"
                onChangeText={setStatementBalanceInput}
                 placeholder="0"
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
                value={statementBalanceInput}
              />
            </View>

            {reconciliationMatches ? (
              <View style={{ gap: theme.spacing.sm }}>
                <View style={{ backgroundColor: theme.colors.tint, borderRadius: theme.radii.chip, padding: theme.spacing.md }}>
                  <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold }}>
                    ✅ Statement matches working balance!
                  </Text>
                </View>
                <PrimaryButton
                  accessibilityLabel="Finish & Save Reconciliation"
                  onPress={() => {
                    setLastReconciled((prev) => ({ ...prev, [selectedDetailAccount.id]: new Date().toISOString() }));
                    setSelectedDetailAccountId(null);
                    Alert.alert("Reconciled", `${selectedDetailAccount.name} balance successfully reconciled.`);
                  }}
                >
                  Finish & Save Reconciliation
                </PrimaryButton>
              </View>
             ) : statementBalanceInput.trim().length > 0 && parsedStatementMinor !== null ? (
              <View style={{ backgroundColor: theme.colors.amberBg, borderRadius: theme.radii.chip, padding: theme.spacing.md }}>
                <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                  Discrepancy: Difference of {formatMinor(Math.abs((detailAccountCalculated?.balanceMinor ?? 0) - (parsedStatementMinor ?? 0)), { currencySymbol })}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedDetailAccountId(null)}
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
