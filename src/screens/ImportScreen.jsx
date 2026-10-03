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
import { formatMinor } from "../domain/services/money";
import { buildImportSourceKey, parseGridWithMappings, pickAndParseImportFile } from "../services/importFile";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

function isSameDay(epochA, epochB) {
  const dateA = new Date(epochA);
  const dateB = new Date(epochB);
  return (
    dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth()
    && dateA.getDate() === dateB.getDate()
  );
}

export function ImportScreen({ navigation }) {
  const tabNavigation = navigation.getParent();
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const importCsvRows = useFinanceStore((state) => state.importCsvRows);
  const accounts = useFinanceStore((state) => state.accounts);
  const existingTransactions = useFinanceStore((state) => state.transactions);

  // Steps: PICK -> MAP -> RESOLVE -> REVIEW -> COMPLETE | FAILED | UNCERTAIN.
  const [step, setStep] = useState("PICK");
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState("csv");
  const [grid, setGrid] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [contentFingerprint, setContentFingerprint] = useState("");
  const [mappings, setMappings] = useState(emptyImportMappings());
  const [isInserting, setIsInserting] = useState(false);
  const [accountResolutions, setAccountResolutions] = useState({});

  // Review step state
  // Store original file-row indices, not positions in the changing duplicate list.
  const [selectedDuplicateIndices, setSelectedDuplicateIndices] = useState(new Set());
  const [outcome, setOutcome] = useState({ created: 0, reconciled: 0, duplicatesSkipped: 0, invalidSkipped: 0, retainedRows: [] });
  const [outcomeError, setOutcomeError] = useState(null);

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

  // Candidate duplicate detection
  const { readyRows, duplicateRows, invalidRows } = useMemo(() => {
    if (!parsed) {
      return { readyRows: [], duplicateRows: [], invalidRows: [] };
    }

    const ready = [];
    const duplicates = [];
    const earlierRows = [];

    parsed.rows.forEach((row, index) => {
      const resolution = accountResolutions[row.accountKey];
      const targetAccountId = resolution?.kind === "existing" ? resolution.accountId : null;

      const matchedExisting = existingTransactions.find((tx) => {
        if (tx.type !== row.type) return false;
        if (tx.amountMinor !== row.amountMinor) return false;
        if (targetAccountId !== null && tx.accountId !== targetAccountId) return false;
        return isSameDay(tx.dateEpochMillis, row.dateEpochMillis);
      });
      const matchedFileRow = earlierRows.find((candidate) => {
        if (candidate.row.type !== row.type || candidate.row.amountMinor !== row.amountMinor) return false;
        if (candidate.accountResolutionKey !== row.accountKey) return false;
        return isSameDay(candidate.row.dateEpochMillis, row.dateEpochMillis);
      });

      if (matchedExisting || matchedFileRow) {
        duplicates.push({
          row,
          originalIndex: index,
          reason: matchedExisting
            ? `Matches existing ${matchedExisting.type.toLowerCase()} of ${formatMinor(matchedExisting.amountMinor, currencySymbol)} on ${formatLocalDateISO(matchedExisting.dateEpochMillis)}`
            : `Matches another row in this file on ${formatLocalDateISO(row.dateEpochMillis)}`,
        });
      } else {
        ready.push(row);
      }
      earlierRows.push({ row, accountResolutionKey: row.accountKey });
    });

    return {
      readyRows: ready,
      duplicateRows: duplicates,
      invalidRows: parsed.skipped ?? [],
    };
  }, [parsed, accountResolutions, existingTransactions, currencySymbol]);

  // Reset duplicate selections when rows change
  useEffect(() => {
    setSelectedDuplicateIndices(new Set());
  }, [parsed]);

  const toggleDuplicateSelection = (index) => {
    setSelectedDuplicateIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

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
      setContentFingerprint(picked.contentFingerprint);
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

  const cycleResolution = (sourceKey, sourceLabel) => {
    const current = accountResolutions[sourceKey];
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

  const getResolutionLabel = (sourceKey) => {
    const res = accountResolutions[sourceKey];
    if (!res) return "Unresolved";
    if (res.kind === "existing") {
      const acc = activeAccounts.find((a) => a.id === res.accountId);
      return acc ? `Existing: ${acc.name}` : `Existing account #${res.accountId}`;
    }
    const typeLabel = res.type === "EWALLET" ? "E-wallet" : res.type === "CARD" ? "Card" : "Cash";
    return `New: ${typeLabel}`;
  };

  const handleCommitImport = async () => {
    if (!parsed) return;

    // Ready rows + explicitly selected duplicate rows
    const selectedDuplicateRows = duplicateRows.filter((item) => selectedDuplicateIndices.has(item.originalIndex));
    const selectedRows = [
      ...readyRows,
      ...selectedDuplicateRows.map((item) => item.row),
    ];

    if (selectedRows.length === 0) {
      Alert.alert("Nothing to import", "Please select at least one transaction to import.");
      return;
    }

    setIsInserting(true);
    setOutcomeError(null);
    try {
      const rowsToImport = selectedRows.map((row) => ({
        ...row,
        sourceKey: buildImportSourceKey(contentFingerprint, mappings, row.sourceRowNumber),
      }));
      const summary = await importCsvRows(rowsToImport, {
        skipped: parsed.skipped,
        accountResolutions,
      });

      const created = typeof summary === "object" && summary !== null ? summary.created : Number(summary);
      const reconciled = typeof summary === "object" && summary !== null ? (summary.reconciled ?? 0) : 0;
      const duplicatesSkipped = duplicateRows.length - selectedDuplicateRows.length;
      const invalidSkipped = invalidRows.length;
      const retainedRows = typeof summary === "object" && Array.isArray(summary?.skippedRows)
        ? summary.skippedRows.slice(parsed.skipped.length)
        : [];

      setOutcome({
        created,
        reconciled,
        duplicatesSkipped,
        invalidSkipped,
        retainedRows,
      });
      setStep("COMPLETE");
    } catch (error) {
      setOutcomeError(error instanceof Error ? error.message : "Import failed unexpectedly.");
      setStep(error?.code === "IMPORT_COMMITTED_REFRESH_FAILED" ? "UNCERTAIN" : "FAILED");
    } finally {
      setIsInserting(false);
    }
  };

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

  const selectedDuplicateCount = duplicateRows.filter((item) => selectedDuplicateIndices.has(item.originalIndex)).length;
  const selectedCount = readyRows.length + selectedDuplicateCount;

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
            else if (step === "REVIEW") setStep("RESOLVE");
            else if (step === "COMPLETE") navigation.goBack();
            else if (step === "UNCERTAIN") setStep("REVIEW");
          }}
        >
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          {step === "REVIEW" ? "Review Import" : step === "COMPLETE" ? "Import Complete" : step === "UNCERTAIN" ? "Import Status" : "Import data"}
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

      {/* Step 2: MAP */}
      {step === "MAP" ? (
        <View style={{ gap: theme.spacing.lg, flex: 1 }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
            File: {fileName || "transactions.csv"} ({format.toUpperCase()})
          </Text>

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

      {/* Step 3: RESOLVE ACCOUNTS */}
      {step === "RESOLVE" ? (
        <View style={{ gap: theme.spacing.lg, flex: 1 }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
            File: {fileName || "transactions.csv"} ({format.toUpperCase()})
          </Text>

          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
            Resolve every source account before import (tap to change)
          </Text>

          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.md }}>
            {accountSources.length === 0 ? (
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body }}>
                No explicit accounts in file. Default account will be used.
              </Text>
            ) : (
              accountSources.map((source, sIdx) => {
                const pillLabel = getResolutionLabel(source.key);
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
                ? "Next: review duplicate and invalid rows before committing to your database."
                : `Resolve ${unresolvedAccounts.length} source account(s) before reviewing.`}
            </Text>
          </View>

          <PrimaryButton
            disabled={unresolvedAccounts.length > 0 || (parsed?.rows?.length ?? 0) === 0}
            onPress={() => setStep("REVIEW")}
          >
            Review import
          </PrimaryButton>
        </View>
      ) : null}

      {/* Step 4: REVIEW (Frames 19 & 19b) */}
      {step === "REVIEW" ? (
        <ScrollView contentContainerStyle={{ gap: theme.spacing.lg }}>
          {/* Summary Tiles: Ready, Duplicate, Invalid */}
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.tint,
                borderRadius: theme.radii.card,
                flex: 1,
                gap: theme.spacing.xxs,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.income, fontFamily: theme.fonts.bold, fontSize: 24 }}>
                {readyRows.length}
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Ready
              </Text>
            </View>

            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.amberBg,
                borderRadius: theme.radii.card,
                flex: 1,
                gap: theme.spacing.xxs,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.warning, fontFamily: theme.fonts.bold, fontSize: 24 }}>
                {duplicateRows.length}
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Duplicate
              </Text>
            </View>

            <View
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.avatarBg,
                borderRadius: theme.radii.card,
                flex: 1,
                gap: theme.spacing.xxs,
                padding: theme.spacing.md,
              }}
            >
              <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: 24 }}>
                {invalidRows.length}
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                Invalid
              </Text>
            </View>
          </View>

          {/* Section: Rows needing attention (Duplicates & Invalid) */}
          {(duplicateRows.length > 0 || invalidRows.length > 0) ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                Rows needing attention ({duplicateRows.length + invalidRows.length})
              </Text>

              {/* Possible duplicate rows */}
              {duplicateRows.map((item, dIdx) => {
                const isIncluded = selectedDuplicateIndices.has(item.originalIndex);
                const dateStr = formatLocalDateISO(item.row.dateEpochMillis);
                const amountFormatted = formatMinor(item.row.amountMinor, currencySymbol);

                return (
                  <SectionCard key={`dup-${dIdx}`} padding={theme.spacing.md} style={{ gap: theme.spacing.sm }}>
                    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                      <View style={{ gap: theme.spacing.xxs }}>
                        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                          {item.row.note?.trim() || item.row.categoryName}
                        </Text>
                        <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                          {dateStr} · {item.row.accountLabel}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: item.row.type === "EXPENSE" ? theme.colors.expense : theme.colors.income,
                          fontFamily: theme.fonts.bold,
                          fontSize: theme.typeScale.body,
                        }}
                      >
                        {item.row.type === "EXPENSE" ? `-${amountFormatted}` : `+${amountFormatted}`}
                      </Text>
                    </View>

                    {/* Frame 19b Badge & Reason */}
                    <View
                      style={{
                        backgroundColor: theme.colors.amberBg,
                        borderColor: theme.colors.warning,
                        borderRadius: theme.radii.small,
                        borderWidth: 1,
                        gap: theme.spacing.xxs,
                        padding: theme.spacing.sm,
                      }}
                    >
                      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.xs }}>
                        <Text style={{ fontSize: 12 }}>⚠️</Text>
                        <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                          Possible duplicate
                        </Text>
                      </View>
                      <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                        {item.reason}
                      </Text>
                    </View>

                    {/* Inclusion toggle */}
                    <Pressable
                      accessibilityLabel="Include this duplicate row anyway"
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isIncluded }}
                       onPress={() => toggleDuplicateSelection(item.originalIndex)}
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        gap: theme.spacing.sm,
                        paddingTop: theme.spacing.xs,
                      }}
                    >
                      <View
                        style={{
                          alignItems: "center",
                          backgroundColor: isIncluded ? theme.colors.primary : "transparent",
                          borderColor: isIncluded ? theme.colors.primary : theme.colors.outline,
                          borderRadius: 4,
                          borderWidth: 1.5,
                          height: 20,
                          justifyContent: "center",
                          width: 20,
                        }}
                      >
                        {isIncluded ? (
                          <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.fonts.bold, fontSize: 12 }}>✓</Text>
                        ) : null}
                      </View>
                      <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                        Include this row anyway
                      </Text>
                    </Pressable>
                  </SectionCard>
                );
              })}

              {/* Invalid rows (never selectable) */}
              {invalidRows.map((skipped, sIdx) => (
                <SectionCard key={`inv-${sIdx}`} padding={theme.spacing.md} style={{ gap: theme.spacing.xs, opacity: 0.85 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                      Row {skipped.rowNumber}
                    </Text>
                    <View
                      style={{
                        backgroundColor: theme.colors.avatarBg,
                        borderRadius: theme.radii.chip,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: theme.spacing.xxs,
                      }}
                    >
                      <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.small }}>
                        Invalid
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                    Reason: {skipped.reason}
                  </Text>
                </SectionCard>
              ))}
            </View>
          ) : null}

          {/* Section: Ready rows */}
          {readyRows.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                Ready to import ({readyRows.length})
              </Text>
              <SectionCard padding={theme.spacing.md} style={{ gap: theme.spacing.sm }}>
                {readyRows.slice(0, 5).map((row, rIdx) => {
                  const dateStr = formatLocalDateISO(row.dateEpochMillis);
                  const amountFormatted = formatMinor(row.amountMinor, currencySymbol);
                  return (
                    <View key={`ready-${rIdx}`} style={{ gap: theme.spacing.xs }}>
                      {rIdx > 0 ? <View style={{ backgroundColor: theme.colors.outline, height: 1 }} /> : null}
                      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                        <View>
                          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                            {row.note?.trim() || row.categoryName}
                          </Text>
                          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small }}>
                            {dateStr} · {row.accountLabel}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: row.type === "EXPENSE" ? theme.colors.expense : theme.colors.income,
                            fontFamily: theme.fonts.bold,
                            fontSize: theme.typeScale.body,
                          }}
                        >
                          {row.type === "EXPENSE" ? `-${amountFormatted}` : `+${amountFormatted}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                {readyRows.length > 5 ? (
                  <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.small, textAlign: "center", paddingTop: theme.spacing.xs }}>
                    + {readyRows.length - 5} more ready transaction(s)
                  </Text>
                ) : null}
              </SectionCard>
            </View>
          ) : null}

          {/* Dynamic action button reflecting selected count */}
          <PrimaryButton
            accessibilityLabel={`Import ${selectedCount} transaction${selectedCount === 1 ? "" : "s"}`}
            disabled={isInserting || selectedCount === 0}
            onPress={() => void handleCommitImport()}
            style={{ marginBottom: theme.spacing.xxl, marginTop: theme.spacing.sm }}
          >
            {isInserting
              ? "Importing…"
              : `Import ${selectedCount} transaction${selectedCount === 1 ? "" : "s"}`}
          </PrimaryButton>
        </ScrollView>
      ) : null}

      {/* Step 5: COMPLETE (Frame 19c) */}
      {step === "COMPLETE" ? (
        <View style={{ alignItems: "center", flex: 1, gap: theme.spacing.lg, justifyContent: "center", paddingVertical: theme.spacing.xl }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.tint,
              borderRadius: theme.radii.round,
              height: 64,
              justifyContent: "center",
              width: 64,
            }}
          >
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: 32 }}>✓</Text>
          </View>

          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle, textAlign: "center" }}>
            {outcome.created + outcome.reconciled > 0 ? "Import complete!" : "No new transactions"}
          </Text>

          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, textAlign: "center" }}>
            {outcome.created + outcome.reconciled > 0
              ? "Review the imported and retained transactions below."
              : "Existing transactions were kept. Review the skipped rows below."}
          </Text>

          {/* Stat card */}
          <SectionCard padding={theme.spacing.lg} style={{ gap: theme.spacing.sm, width: "100%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                Imported
              </Text>
              <Text style={{ color: theme.colors.income, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {outcome.created} transaction(s)
              </Text>
            </View>

            <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                Already committed
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {outcome.reconciled} transaction(s)
              </Text>
            </View>

            <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                Duplicates excluded
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {outcome.duplicatesSkipped} transaction(s)
              </Text>
            </View>

            <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                Invalid rows skipped
              </Text>
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                {outcome.invalidSkipped} row(s)
              </Text>
            </View>
            {outcome.retainedRows.length > 0 ? (
              <>
                <View style={{ backgroundColor: theme.colors.outline, height: 1 }} />
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                  Previously imported rows kept: {outcome.retainedRows.length}
                </Text>
                <Text accessibilityRole="alert" style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.label }}>
                  {outcome.retainedRows.slice(0, 4).map(({ rowNumber, reason }) => `Row ${rowNumber}: ${reason}`).join("\n")}
                </Text>
              </>
            ) : null}
          </SectionCard>

          <PrimaryButton
            accessibilityLabel="View imported transactions"
            onPress={() => tabNavigation?.navigate("History", { screen: "HistoryList" })}
            style={{ marginTop: theme.spacing.md }}
          >
            View imported transactions
          </PrimaryButton>
        </View>
      ) : null}

      {/* Failed writes are known rolled back; only a post-commit refresh failure is uncertain. */}
      {step === "FAILED" || step === "UNCERTAIN" ? (
        <View style={{ alignItems: "center", flex: 1, gap: theme.spacing.lg, justifyContent: "center", paddingVertical: theme.spacing.xl }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.amberBg,
              borderRadius: theme.radii.round,
              height: 64,
              justifyContent: "center",
              width: 64,
            }}
          >
            <Text style={{ fontSize: 32 }}>⚠️</Text>
          </View>

          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.screenTitle, textAlign: "center" }}>
            {step === "UNCERTAIN" ? "Import outcome pending" : "Import failed"}
          </Text>

          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, maxWidth: 320, textAlign: "center" }}>
            {step === "UNCERTAIN"
              ? "The rows may already be committed, but the ledger refresh failed. Retry the same import to reconcile them without duplicating financial effects."
              : "The import was rolled back, so no rows from this attempt were written. Review the error and try again."}
          </Text>

          {outcomeError ? (
            <SectionCard padding={theme.spacing.md} style={{ width: "100%" }}>
              <Text style={{ color: theme.colors.expense, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.small }}>
                {outcomeError}
              </Text>
            </SectionCard>
          ) : null}

          <View style={{ gap: theme.spacing.sm, width: "100%" }}>
            <PrimaryButton
              accessibilityLabel={step === "UNCERTAIN" ? "Retry same import safely" : "Return to review"}
              onPress={() => {
                if (step === "UNCERTAIN") {
                  void handleCommitImport();
                  return;
                }
                setStep("REVIEW");
              }}
            >
              {step === "UNCERTAIN" ? "Retry same import safely" : "Return to review"}
            </PrimaryButton>

            <Pressable
              accessibilityLabel="View History"
              accessibilityRole="button"
              onPress={() => tabNavigation?.navigate("History", { screen: "HistoryList" })}
              style={{
                alignItems: "center",
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
                borderRadius: theme.radii.button,
                borderWidth: 1,
                height: theme.sizes.primaryButton,
                justifyContent: "center",
                width: "100%",
              }}
            >
              <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                View History
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}
