import { useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { parseBackup, parsePastedTransactionsCsv } from "../services/dataTransfer";
import { buildImportSourceKey, fingerprintImportContent } from "../services/importFile";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";
const MAX_LISTED_SKIPS = 4;
/**
 * A paste is one blob the user cannot inspect row by row before committing, so invalid
 * rows are never dropped silently: the user either confirms importing the remainder or
 * the whole paste is rejected.
 * @param {{ rowNumber: number, reason: string }[]} skipped
 */
function skippedRowsSummary(skipped) {
    const listed = skipped.slice(0, MAX_LISTED_SKIPS).map((item) => `• Row ${item.rowNumber}: ${item.reason}`);
    const remaining = skipped.length - MAX_LISTED_SKIPS;
    return remaining > 0
        ? `${listed.join("\n")}\n• …and ${remaining} more invalid row(s)`
        : listed.join("\n");
}
export function PasteImportScreen({ navigation, route }) {
    const tabNavigation = navigation.getParent();
    const mode = route.params.mode;
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const importCsvRows = useFinanceStore((state) => state.importCsvRows);
    const restoreBackup = useFinanceStore((state) => state.restoreBackup);
    const undoLastRestore = useFinanceStore((state) => state.undoLastRestore);
    const refreshFinance = useFinanceStore((state) => state.refresh);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const title = mode === "backup" ? "Restore from backup" : "Import CSV";
    const helper = mode === "backup"
        ? "Paste a MoneyMap JSON backup below. This replaces local finance data."
        : "Paste CSV rows with header: date,type,amount,category,account,note";
    const retryLedgerRefresh = async () => {
        setBusy(true);
        try {
            await refreshFinance();
            Alert.alert("Ledger refreshed", "The restored data is now loaded.", [
                { text: "Done", onPress: () => navigation.goBack() },
            ]);
        }
        catch (error) {
            Alert.alert("Refresh failed", error instanceof Error ? error.message : "Unknown error");
        }
        finally {
            setBusy(false);
        }
    };
    const undoRestore = async () => {
        setBusy(true);
        try {
            await undoLastRestore();
            Alert.alert("Restore undone", "Your previous local data has been restored.");
            navigation.goBack();
        }
        catch (error) {
            if (error?.code === "RESTORE_COMMITTED_REFRESH_FAILED") {
                Alert.alert(
                    "Restore undone; refresh pending",
                    "Your previous data was restored in the database, but the screen could not refresh yet.",
                    [{ text: "Retry refresh", onPress: () => { void retryLedgerRefresh(); } }],
                );
            }
            else {
                Alert.alert("Undo failed", error instanceof Error ? error.message : "Unknown error");
            }
        }
        finally {
            setBusy(false);
        }
    };
    const showRestoreApplied = (refreshPending = false) => {
        Alert.alert(
            refreshPending ? "Restore applied; refresh pending" : "Restore complete",
            refreshPending
                ? "The backup is already in the database, but the ledger screen could not refresh. Do not apply the backup again. Retry the refresh or undo the restore."
                : "Your backup was applied. MoneyMap kept one pre-restore snapshot on this device for a single undo. Undo replaces any changes made since this restore.",
            [
                refreshPending
                    ? { text: "Retry refresh", onPress: () => { void retryLedgerRefresh(); } }
                    : { text: "Keep restored data", onPress: () => navigation.goBack() },
                { text: "Undo restore", onPress: () => { void undoRestore(); } },
            ],
        );
    };
    const runRestore = async (backup) => {
        setBusy(true);
        try {
            await restoreBackup(backup);
            showRestoreApplied(false);
        }
        catch (error) {
            if (error?.code === "RESTORE_COMMITTED_REFRESH_FAILED") {
                showRestoreApplied(true);
            }
            else {
                Alert.alert("Restore failed", error instanceof Error ? error.message : "Unknown error");
            }
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
                // Restore replaces finance tables, so confirm the exact scope before the write.
                const counts = [
                    `${backup.transactions.length} transaction${backup.transactions.length === 1 ? "" : "s"}`,
                    `${backup.budgets.length} budget${backup.budgets.length === 1 ? "" : "s"}`,
                    `${backup.recurringRules.length} bill${backup.recurringRules.length === 1 ? "" : "s"}`,
                    `${backup.goals.length} goal${backup.goals.length === 1 ? "" : "s"}`,
                ].join(", ");
                setBusy(false);
                Alert.alert(
                    "Replace all local data?",
                    `This replaces every transaction, budget, bill, category, account, and savings goal on this device with ${counts} from the backup. MoneyMap keeps one pre-restore snapshot on this device for a single undo.`,
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
            const fingerprint = await fingerprintImportContent(text);
            const { rows, skipped, dataRowCount, mappings } = parsePastedTransactionsCsv(text);
            if (rows.length === 0) {
                Alert.alert(
                    "Nothing imported",
                    `All ${dataRowCount} pasted row(s) are invalid, so nothing was written:\n${skippedRowsSummary(skipped)}`,
                );
                return;
            }
            const rowsWithSourceKeys = rows.map((row) => ({
                ...row,
                sourceKey: buildImportSourceKey(fingerprint, mappings, row.sourceRowNumber),
            }));
            const commitImport = async () => {
                setBusy(true);
                try {
                    // Skipped rows travel with the payload so the summary reports them
                    // instead of the import looking fully successful.
                    const summary = await importCsvRows(rowsWithSourceKeys, { skipped });
                    const created = typeof summary === "object" && summary !== null
                        ? summary.created
                        : Number(summary);
                    const reconciled = typeof summary === "object" && summary !== null
                        ? (summary.reconciled ?? 0)
                        : 0;
                    const retainedRows = typeof summary === "object" && Array.isArray(summary?.skippedRows)
                        ? summary.skippedRows.slice(skipped.length)
                        : [];
                    Alert.alert(
                        created + reconciled > 0 ? "Import complete" : "No new transactions",
                        `Imported ${created} and reconciled ${reconciled} transaction${created + reconciled === 1 ? "" : "s"}, and skipped ${skipped.length} invalid row(s).${retainedRows.length > 0 ? ` Kept ${retainedRows.length} previously imported row(s):\n${skippedRowsSummary(retainedRows)}` : ""}`,
                    );
                    tabNavigation?.navigate("History", { screen: "HistoryList" });
                }
                catch (error) {
                    Alert.alert("Import failed", error instanceof Error ? error.message : "Unknown error");
                }
                finally {
                    setBusy(false);
                }
            };
            if (skipped.length > 0) {
                setBusy(false);
                Alert.alert(
                    "Import the valid rows only?",
                    `${skipped.length} of ${dataRowCount} pasted row(s) are invalid and will be skipped:\n${skippedRowsSummary(skipped)}\n\nImport the remaining ${rows.length} row(s)?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: `Import ${rows.length}`, onPress: () => { void commitImport(); } },
                    ],
                );
                return;
            }
            await commitImport();
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
