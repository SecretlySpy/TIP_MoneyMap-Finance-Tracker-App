import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { formatLocalDateISO } from "../domain/services/emoji";
import {
  buildAutomaticAccountResolutions,
  listImportAccountSources,
  unresolvedImportAccountSources,
} from "../domain/services/importAccounts";
import { IMPORT_FIELDS, emptyImportMappings } from "../domain/services/importParser";
import { parseGridWithMappings, pickAndParseImportFile } from "../services/importFile";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

// FR-11: pick CSV/XLSX → preview & map columns (Figma 16) → resolve accounts (Figma 16b) → transactional bulk insert
export function ImportScreen({ navigation }) {
  const tabNavigation = navigation.getParent();
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const importCsvRows = useFinanceStore((state) => state.importCsvRows);
  const accounts = useFinanceStore((state) => state.accounts);

  const [step, setStep] = useState("PICK"); // "PICK" | "MAP" (16) | "RESOLVE" (16b)
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState("csv");
  const [grid, setGrid] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState(emptyImportMappings());
  const [isInserting, setIsInserting] = useState(false);
  const [accountResolutions, setAccountResolutions] = useState({});

  const parsed = useMemo(
    () => (grid.length > 0 ? parseGridWithMappings(grid, mappings) : null),
    [grid, mappings],
  );

  const accountSources = useMemo(
    () => listImportAccountSources(parsed?.rows ?? []),
    [parsed],
  );

  const unresolvedAccounts = useMemo(
    () => unresolvedImportAccountSources(parsed?.rows ?? [], accountResolutions),
    [accountResolutions, parsed],
  );

  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived),
    [accounts],
  );

  useEffect(() => {
    setAccountResolutions(buildAutomaticAccountResolutions(parsed?.rows ?? [], accounts));
  }, [accounts, parsed]);

  const handlePickFile = async () => {
    try {
      const picked = await pickAndParseImportFile();
      if (picked === null) {
        return;
      }
      setFileName(picked.fileName);
      setFormat(picked.format);
      setGrid(picked.grid);
      setHeaders(picked.headers);
      setMappings(picked.mappings);
      setStep("MAP");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to pick file.");
    }
  };

  const handleCycleColumn = (field) => {
    setMappings((prev) => {
      const current = prev[field];
      const next = current + 1 >= headers.length ? -1 : current + 1;
      return { ...prev, [field]: next };
    });
  };

  // Build cycle options for a given source account resolution
  const cycleResolution = (sourceKey, sourceLabel) => {
    const current = accountResolutions[sourceKey];
    // List all options: existing accounts first, then new account types
    const options = [
      ...activeAccounts.map((a) => ({
        kind: "existing",
        accountId: a.id,
        label: `Existing: ${a.name}`,
      })),
      { kind: "create", name: sourceLabel, type: "EWALLET", label: "New: E-wallet" },
      { kind: "create", name: sourceLabel, type: "CARD", label: "New: Card" },
      { kind: "create", name: sourceLabel, type: "CASH", label: "New: Cash" },
    ];

    let currentIndex = -1;
    if (current?.kind === "existing") {
      currentIndex = options.findIndex((o) => o.kind === "existing" && o.accountId === current.accountId);
    } else if (current?.kind === "create") {
      currentIndex = options.findIndex((o) => o.kind === "create" && o.type === current.type);
    }

    const nextIndex = (currentIndex + 1) % options.length;
    const nextOption = options[nextIndex];
    if (nextOption) {
      setAccountResolutions((prev) => ({
        ...prev,
        [sourceKey]: nextOption.kind === "existing"
          ? { kind: "existing", accountId: nextOption.accountId }
          : { kind: "create", name: nextOption.name, type: nextOption.type },
      }));
    }
  };

  const getResolutionLabel = (sourceKey, sourceLabel) => {
    const res = accountResolutions[sourceKey];
    if (!res) return "Unresolved";
    if (res.kind === "existing") {
      const acc = activeAccounts.find((a) => a.id === res.accountId);
      return acc ? `Existing: ${acc.name}` : `Existing account #${res.accountId}`;
    }
    const typeLabel = res.type === "EWALLET" ? "E-wallet" : res.type === "CARD" ? "Card" : "Cash";
    return `New: ${typeLabel}`;
  };

  const handleBulkInsert = async () => {
    if (parsed === null) {
      return;
    }
    setIsInserting(true);
    try {
      if (parsed.rows.length === 0) {
        Alert.alert(
          "No Data",
          parsed.skipped.length > 0
            ? `No valid transactions. ${parsed.skipped.length} row(s) skipped.`
            : "No valid transactions found to import.",
        );
        return;
      }
      if (unresolvedAccounts.length > 0) {
        Alert.alert(
          "Resolve accounts",
          `Choose where transactions from “${unresolvedAccounts[0].label}” should be imported.`,
        );
        return;
      }
      const summary = await importCsvRows(parsed.rows, {
        skipped: parsed.skipped,
        accountResolutions,
      });
      const created = typeof summary === "object" && summary !== null ? summary.created : Number(summary);
      const skippedCount = typeof summary === "object" && summary !== null ? summary.skipped : parsed.skipped.length;
      const message = skippedCount > 0
        ? `Imported ${created} transaction(s). Skipped ${skippedCount} malformed row(s).`
        : `Successfully imported ${created} transaction(s).`;
      Alert.alert("Import complete", message, [
        { text: "View history", onPress: () => tabNavigation?.navigate("History", { screen: "HistoryList" }) },
      ]);
    } catch (error) {
      Alert.alert("Import Error", error instanceof Error ? error.message : "Failed to import rows.");
    } finally {
      setIsInserting(false);
    }
  };

  // Preview table rows derived from parsed rows or raw grid
  const previewData = useMemo(() => {
    if (parsed?.rows && parsed.rows.length > 0) {
      return parsed.rows.slice(0, 3).map((r) => ({
        date: formatLocalDateISO(r.dateEpochMillis),
        amount: (r.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        type: r.type,
      }));
    }
    if (grid.length > 1) {
      return grid.slice(1, 4).map((row) => ({
        date: String(row[mappings.Date >= 0 ? mappings.Date : 0] ?? "—"),
        amount: String(row[mappings.Amount >= 0 ? mappings.Amount : 1] ?? "—"),
        type: String(row[mappings.Type >= 0 ? mappings.Type : 2] ?? "EXPENSE"),
      }));
    }
    return [
      { date: "2026-09-01", amount: "15,000.00", type: "INCOME" },
      { date: "2026-09-02", amount: "120.00", type: "EXPENSE" },
      { date: "2026-09-02", amount: "40.00", type: "EXPENSE" },
    ];
  }, [grid, mappings, parsed]);

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="import-screen">
      {/* Top Header */}
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (step === "PICK") navigation.goBack();
            else if (step === "MAP") setStep("PICK");
            else if (step === "RESOLVE") setStep("MAP");
          }}
        >
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Import data
        </Text>
      </View>

      {/* Step 1: PICK FILE */}
      {step === "PICK" ? (
        <View style={{ gap: theme.spacing.xl, flex: 1, justifyContent: "center" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, textAlign: "center" }}>
            Select a CSV or Excel (.xlsx) file containing your previous transaction history.
          </Text>
          <PrimaryButton onPress={() => void handlePickFile()}>
            Choose File
          </PrimaryButton>
        </View>
      ) : null}

      {/* Step 2: Figma 16 Import Data (PreviewTable + MappingCard + ReadyBanner + "Resolve accounts") */}
      {step === "MAP" ? (
        <View style={{ gap: theme.spacing.lg, flex: 1 }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
            File: {fileName || "demo-transactions.csv"} ({format.toUpperCase()})
          </Text>

          {/* PreviewTable */}
          <SectionCard padding={theme.spacing.md} style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: theme.spacing.xs }}>
              <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>Date</Text>
              <Text style={{ flex: 1, textAlign: "right", color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>Amount</Text>
              <Text style={{ flex: 1, textAlign: "right", color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>Type</Text>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.outline }} />
            {previewData.map((row, idx) => (
              <View key={`preview-${idx}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.xxs }}>
                <Text style={{ flex: 1, color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>{row.date}</Text>
                <Text style={{ flex: 1, textAlign: "right", color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>{row.amount}</Text>
                <Text style={{ flex: 1, textAlign: "right", color: row.type === "INCOME" ? theme.colors.income : theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>{row.type}</Text>
              </View>
            ))}
          </SectionCard>

          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
            Tap a field to cycle through the mapped column
          </Text>

          {/* MappingCard */}
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
            {IMPORT_FIELDS.map((field, fIdx) => {
              const mappingIndex = mappings[field];
              const mappingLabel = mappingIndex >= 0 ? `${headers[mappingIndex] ?? field}` : "Unmapped";
              return (
                <View key={field} style={{ gap: theme.spacing.md }}>
                  {fIdx > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.outline }} /> : null}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                      {field}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleCycleColumn(field)}
                      style={{
                        backgroundColor: mappingIndex < 0 ? theme.colors.track : theme.colors.tint,
                        borderRadius: theme.radii.chip,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.xs,
                      }}
                    >
                      <Text style={{
                        color: mappingIndex < 0 ? theme.colors.amberText : theme.colors.primary,
                        fontFamily: theme.fonts.medium,
                        fontSize: theme.typeScale.small,
                      }}>
                        {mappingLabel}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </SectionCard>

          {/* ReadyBanner */}
          <View
            style={{
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radii.card,
              padding: theme.spacing.lg,
              gap: theme.spacing.xxs,
            }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              Ready to import
            </Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
              {parsed?.rows?.length ?? 0} valid rows ready. Map each source account to an existing account or create a named account.
            </Text>
            {parsed?.skipped && parsed.skipped.length > 0 ? (
              <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                {parsed.skipped.length} row(s) skipped due to formatting.
              </Text>
            ) : null}
          </View>

          <PrimaryButton
            disabled={mappings.Amount < 0 || (parsed?.rows?.length ?? 0) === 0}
            onPress={() => setStep("RESOLVE")}
          >
            Resolve accounts
          </PrimaryButton>
        </View>
      ) : null}

      {/* Step 3: Figma 16b Import Data — Resolve Accounts (PreviewTable + Account MappingCard + ReadyBanner + "Confirm & Import") */}
      {step === "RESOLVE" ? (
        <View style={{ gap: theme.spacing.lg, flex: 1 }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
            File: {fileName || "demo-transactions.csv"} ({format.toUpperCase()})
          </Text>

          {/* PreviewTable */}
          <SectionCard padding={theme.spacing.md} style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: theme.spacing.xs }}>
              <Text style={{ flex: 1, color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>Date</Text>
              <Text style={{ flex: 1, textAlign: "right", color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>Amount</Text>
              <Text style={{ flex: 1, textAlign: "right", color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>Type</Text>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.outline }} />
            {previewData.map((row, idx) => (
              <View key={`resolve-preview-${idx}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.xxs }}>
                <Text style={{ flex: 1, color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>{row.date}</Text>
                <Text style={{ flex: 1, textAlign: "right", color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>{row.amount}</Text>
                <Text style={{ flex: 1, textAlign: "right", color: row.type === "INCOME" ? theme.colors.income : theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>{row.type}</Text>
              </View>
            ))}
          </SectionCard>

          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
            Resolve every source account before import (tap to change)
          </Text>

          {/* Account Resolution MappingCard */}
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
            {accountSources.length === 0 ? (
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
                No explicit accounts in file. Default account will be used.
              </Text>
            ) : (
              accountSources.map((source, sIdx) => {
                const pillLabel = getResolutionLabel(source.key, source.label);
                return (
                  <View key={source.key} style={{ gap: theme.spacing.md }}>
                    {sIdx > 0 ? <View style={{ height: 1, backgroundColor: theme.colors.outline }} /> : null}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                        {source.label}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => cycleResolution(source.key, source.label)}
                        style={{
                          backgroundColor: theme.colors.tint,
                          borderRadius: theme.radii.chip,
                          paddingHorizontal: theme.spacing.md,
                          paddingVertical: theme.spacing.xs,
                        }}
                      >
                        <Text style={{
                          color: theme.colors.primary,
                          fontFamily: theme.fonts.medium,
                          fontSize: theme.typeScale.small,
                        }}>
                          {pillLabel}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </SectionCard>

          {/* ReadyBanner */}
          <View
            style={{
              backgroundColor: unresolvedAccounts.length === 0 ? theme.colors.tint : theme.colors.amberBg,
              borderRadius: theme.radii.card,
              padding: theme.spacing.lg,
              gap: theme.spacing.xxs,
            }}
          >
            <Text style={{
              color: unresolvedAccounts.length === 0 ? theme.colors.primary : theme.colors.amberText,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.body,
            }}>
              {unresolvedAccounts.length === 0 ? "All accounts resolved" : "Resolve remaining accounts"}
            </Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
              {unresolvedAccounts.length === 0
                ? `${parsed?.rows?.length ?? 0} valid rows will import atomically. Re-importing the same file may create duplicates.`
                : `Resolve ${unresolvedAccounts.length} source account(s) before confirming.`}
            </Text>
          </View>

          <PrimaryButton
            disabled={isInserting || unresolvedAccounts.length > 0 || (parsed?.rows?.length ?? 0) === 0}
            onPress={() => void handleBulkInsert()}
          >
            {isInserting ? "Inserting…" : "Confirm & Import"}
          </PrimaryButton>
        </View>
      ) : null}
    </ScreenContainer>
  );
}
