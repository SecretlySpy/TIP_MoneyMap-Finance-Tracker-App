import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { EmptyState } from "../components/EmptyState";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { TextPromptModal } from "../components/TextPromptModal";
import { accountChipLabel } from "../domain/services/financeView";
import { formatMinor, parseDecimalToMinor } from "../domain/services/money";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
export function ManageAccountsScreen({ navigation }) {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const currencySymbol = useUiStore((state) => state.currencySymbol);
    const accounts = useFinanceStore((state) => state.accounts);
    const updateAccount = useFinanceStore((state) => state.updateAccount);
    const [renameId, setRenameId] = useState(null);
    const [balanceId, setBalanceId] = useState(null);
    const active = accounts.filter((account) => !account.isArchived);
    const handleRename = async (name) => {
        if (renameId === null || name.trim().length === 0) {
            setRenameId(null);
            return;
        }
        try {
            await updateAccount({ id: renameId, name: name.trim() });
            setRenameId(null);
        }
        catch (error) {
            Alert.alert("Rename failed", error instanceof Error ? error.message : "Unknown error");
        }
    };
    const handleBalance = async (value) => {
        if (balanceId === null) {
            return;
        }
        try {
            const amountMinor = parseDecimalToMinor(value.replace(/[₱$,]/g, "") || "0");
            await updateAccount({ id: balanceId, startingBalanceMinor: amountMinor });
            setBalanceId(null);
        }
        catch (error) {
            Alert.alert("Balance update failed", error instanceof Error ? error.message : "Enter a valid amount.");
        }
    };
    return (<ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="manage-accounts-screen">
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
          emoji="🏦"
          message="Default Cash, Card, and E-wallet accounts appear after the first launch. Restore a backup if they are missing."
          title="No active accounts"
        />
      ) : (
      <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.lg }}>
        {active.map((account) => (<View key={account.id} style={{ gap: theme.spacing.sm, borderBottomColor: theme.colors.outline, borderBottomWidth: theme.spacing.hairline, paddingBottom: theme.spacing.md }}>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                  {accountChipLabel(account.type)} · {account.name}
                </Text>
                <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                  Starting balance {formatMinor(account.startingBalanceMinor, { currencySymbol })}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
              <Pressable accessibilityRole="button" hitSlop={theme.spacing.sm} onPress={() => setRenameId(account.id)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                  Rename
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" hitSlop={theme.spacing.sm} onPress={() => setBalanceId(account.id)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.label }}>
                  Edit starting balance
                </Text>
              </Pressable>
            </View>
          </View>))}
      </SectionCard>
      )}
      <TextPromptModal confirmLabel="Rename" initialValue={active.find((account) => account.id === renameId)?.name ?? ""} onCancel={() => setRenameId(null)} onConfirm={(value) => void handleRename(value)} placeholder="Account name" title="Rename account" visible={renameId !== null}/>
      <TextPromptModal confirmLabel="Save" initialValue={(() => {
            const account = active.find((item) => item.id === balanceId);
            if (account === undefined) {
                return "0";
            }
            return (account.startingBalanceMinor / 100).toFixed(2);
        })()} keyboardType="decimal-pad" message="Starting balance is added to your total balance." onCancel={() => setBalanceId(null)} onConfirm={(value) => void handleBalance(value)} placeholder="0.00" title="Starting balance" visible={balanceId !== null}/>
    </ScreenContainer>);
}
