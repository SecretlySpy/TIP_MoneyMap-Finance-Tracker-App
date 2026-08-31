import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { parseBackup, parseTransactionsCsv } from "../services/dataTransfer";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
export function PasteImportScreen({ navigation, route }) {
    const mode = route.params.mode;
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const importCsvRows = useFinanceStore((state) => state.importCsvRows);
    const restoreBackup = useFinanceStore((state) => state.restoreBackup);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const title = mode === "backup" ? "Restore from backup" : "Import CSV";
    const helper = mode === "backup"
        ? "Paste a MoneyMap JSON backup below. This replaces local finance data."
        : "Paste CSV rows with header: date,type,amount,category,account,note";
    const runRestore = async (backup) => {
        setBusy(true);
        try {
            await restoreBackup(backup);
            Alert.alert("Restore complete", "Your backup was applied on this device.");
            navigation.goBack();
        }
        catch (error) {
            Alert.alert("Restore failed", error instanceof Error ? error.message : "Unknown error");
        }
        finally {
            setBusy(false);
        }
    };
    const handleImport = async () => {
        if (text.trim().length === 0) {
            Alert.alert("Nothing to import", "Paste data first.");
            return;
        }
        setBusy(true);
        try {
            if (mode === "backup") {
                const backup = parseBackup(text);
                // Restore is destructive and irreversible: confirm before deleting local data.
                const counts = [
                    `${backup.transactions.length} transaction${backup.transactions.length === 1 ? "" : "s"}`,
                    `${backup.budgets.length} budget${backup.budgets.length === 1 ? "" : "s"}`,
                    `${backup.recurringRules.length} bill${backup.recurringRules.length === 1 ? "" : "s"}`,
                    `${backup.goals.length} goal${backup.goals.length === 1 ? "" : "s"}`,
                ].join(", ");
                setBusy(false);
                Alert.alert(
                    "Replace all local data?",
                    `This permanently deletes every transaction, budget, bill, category, account, and savings goal on this device, then restores ${counts} from the backup. This cannot be undone.`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Replace",
                            style: "destructive",
                            onPress: () => { void runRestore(backup); },
                        },
                    ],
                );
                return;
            }
            const rows = parseTransactionsCsv(text);
            const summary = await importCsvRows(rows);
            const created = typeof summary === "object" && summary !== null
                ? summary.created
                : Number(summary);
            Alert.alert("Import complete", `Imported ${created} transaction${created === 1 ? "" : "s"}.`);
            navigation.goBack();
        }
        catch (error) {
            Alert.alert("Import failed", error instanceof Error ? error.message : "Unknown error");
        }
        finally {
            setBusy(false);
        }
    };
    return (<ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="paste-import-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => navigation.goBack()}>
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          {title}
        </Text>
      </View>
      <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
        {helper}
      </Text>
      <TextInput accessibilityLabel={mode === "backup" ? "Backup JSON" : "CSV text"} multiline onChangeText={setText} placeholder={mode === "backup" ? "{ ...backup json... }" : "2026-08-01,EXPENSE,150.00,Food,CASH,"} placeholderTextColor={theme.colors.sub} style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outline,
            borderRadius: theme.radii.row,
            borderWidth: theme.spacing.hairline,
            color: theme.colors.text,
            fontFamily: theme.fonts.regular,
            fontSize: theme.typeScale.label,
            minHeight: 220,
            padding: theme.spacing.lg,
            textAlignVertical: "top",
        }} value={text}/>
      <PrimaryButton disabled={busy} onPress={() => void handleImport()}>
        {busy ? "Importing…" : mode === "backup" ? "Restore backup" : "Import CSV"}
      </PrimaryButton>
    </ScreenContainer>);
}
