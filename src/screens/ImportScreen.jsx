import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { IMPORT_FIELDS, emptyImportMappings } from "../domain/services/importParser";
import { parseGridWithMappings, pickAndParseImportFile } from "../services/importFile";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

// FR-11: pick CSV/XLSX → preview → map columns → validate → transactional bulk insert
export function ImportScreen({ navigation }) {
  const theme = useTheme(useUiStore((state) => state.themePreference));
  const importCsvRows = useFinanceStore((state) => state.importCsvRows);

  const [step, setStep] = useState("PICK");
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState("csv");
  const [grid, setGrid] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState(emptyImportMappings());
  const [isInserting, setIsInserting] = useState(false);

  const parsed = useMemo(
    () => (grid.length > 0 ? parseGridWithMappings(grid, mappings) : null),
    [grid, mappings],
  );
  const previewRows = useMemo(() => {
    if (grid.length === 0) {
      return [];
    }
    const data = grid.slice(1);
    return data.slice(0, 5);
  }, [grid]);

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
      setStep("PREVIEW");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to pick file.");
    }
  };

  const handleMapColumn = (field) => {
    setMappings((prev) => {
      const current = prev[field];
      const next = current + 1 >= headers.length ? -1 : current + 1;
      return { ...prev, [field]: next };
    });
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
      const summary = await importCsvRows(parsed.rows, { skipped: parsed.skipped });
      const created = typeof summary === "object" && summary !== null ? summary.created : Number(summary);
      const skippedCount = typeof summary === "object" && summary !== null ? summary.skipped : parsed.skipped.length;
      const message = skippedCount > 0
        ? `Imported ${created} transaction(s). Skipped ${skippedCount} malformed row(s).`
        : `Successfully imported ${created} transaction(s).`;
      Alert.alert("Import complete", message, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Import Error", error instanceof Error ? error.message : "Failed to import rows.");
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="import-screen">
      <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => {
            if (step === "PICK") navigation.goBack();
            else if (step === "PREVIEW") setStep("PICK");
            else if (step === "MAP") setStep("PREVIEW");
            else if (step === "VALIDATE") setStep("MAP");
          }}
        >
          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
        </Pressable>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
          Import data
        </Text>
      </View>

      {step === "PICK" ? (
        <View style={{ gap: theme.spacing.lg, flex: 1, justifyContent: "center" }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, textAlign: "center" }}>
            Select a CSV or Excel (.xlsx) file containing your previous transaction history.
          </Text>
          <PrimaryButton onPress={() => void handlePickFile()}>
            Choose File
          </PrimaryButton>
        </View>
      ) : null}

      {step === "PREVIEW" ? (
        <View style={{ gap: theme.spacing.lg, flex: 1 }}>
          <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
            File: {fileName} ({format.toUpperCase()})
          </Text>
          <SectionCard style={{ flex: 1 }}>
            <ScrollView horizontal>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.colors.outline, paddingBottom: theme.spacing.xs }}>
                  {headers.map((header, idx) => (
                    <Text key={`h-${idx}`} style={{ width: 120, color: theme.colors.text, fontFamily: theme.fonts.bold }}>{header}</Text>
                  ))}
                </View>
                {previewRows.map((row, i) => (
                  <View key={`r-${i}`} style={{ flexDirection: "row" }}>
                    {(Array.isArray(row) ? row : []).map((cell, j) => (
                      <Text key={`c-${i}-${j}`} numberOfLines={1} style={{ width: 120, color: theme.colors.sub, fontFamily: theme.fonts.regular }}>
                        {String(cell ?? "")}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </SectionCard>
          <PrimaryButton onPress={() => setStep("MAP")}>
            Next: Map Columns
          </PrimaryButton>
        </View>
      ) : null}

      {step === "MAP" ? (
        <View style={{ gap: theme.spacing.lg, flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
            Tap fields to cycle mapped columns
          </Text>
          <SectionCard style={{ gap: theme.spacing.md }}>
            {IMPORT_FIELDS.map((field) => {
              const mappingIndex = mappings[field];
              const mappingLabel = mappingIndex >= 0 ? `${headers[mappingIndex]}` : "Unmapped";
              return (
                <View key={field} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium }}>{field}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleMapColumn(field)}
                    style={{ backgroundColor: theme.colors.track, padding: theme.spacing.sm, borderRadius: theme.radii.chip }}
                  >
                    <Text style={{ color: mappingIndex < 0 ? theme.colors.warning : theme.colors.sub, fontFamily: theme.fonts.regular }}>
                      {mappingLabel}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </SectionCard>
          <PrimaryButton onPress={() => setStep("VALIDATE")}>
            Next: Validate
          </PrimaryButton>
        </View>
      ) : null}

      {step === "VALIDATE" && parsed !== null ? (
        <View style={{ gap: theme.spacing.lg, flex: 1 }}>
          <SectionCard style={{ gap: theme.spacing.md, backgroundColor: theme.colors.tint }}>
            <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
              Ready to import
            </Text>
            <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular }}>
              {mappings.Amount < 0
                ? "Amount column is unmapped. No transactions will be imported."
                : `${parsed.rows.length} valid row(s) ready. Unknown categories and accounts will be auto-created.`}
            </Text>
            {parsed.skipped.length > 0 ? (
              <Text style={{ color: theme.colors.amberText, fontFamily: theme.fonts.regular }}>
                {parsed.skipped.length} row(s) will be skipped (e.g. row {parsed.skipped[0].rowNumber}: {parsed.skipped[0].reason}).
              </Text>
            ) : null}
          </SectionCard>
          <View style={{ flex: 1 }} />
          <PrimaryButton disabled={isInserting || mappings.Amount < 0 || parsed.rows.length === 0} onPress={() => void handleBulkInsert()}>
            {isInserting ? "Inserting..." : "Confirm & Import"}
          </PrimaryButton>
        </View>
      ) : null}
    </ScreenContainer>
  );
}
