import { useState } from "react";
import { Alert, Pressable, View, ScrollView } from "react-native";
import { AppText as Text } from "../components/AppText";
import { PrimaryButton, DashedButton } from "../components/Buttons";
import { ScreenContainer } from "../components/ScreenContainer";
import { SectionCard } from "../components/SectionCard";
import { useUiStore } from "../store/uiStore";
import { useTheme } from "../theme/tokens";

// UI fidelity pass for FR-11: Data import for migration
// Flow: pick file -> preview rows -> map columns -> validate -> bulk insert
export function ImportScreen({ navigation }) {
    const theme = useTheme(useUiStore((state) => state.themePreference));
    const [step, setStep] = useState("PICK"); // PICK | PREVIEW | MAP | VALIDATE

    // Mock state for the UI flow
    const [fileName, setFileName] = useState("");
    const [isInserting, setIsInserting] = useState(false);

    const handlePickFile = () => {
        // In a real implementation, use expo-document-picker and papaparse here.
        setFileName("export_2023.csv");
        setStep("PREVIEW");
    };

    const handleBulkInsert = () => {
        setIsInserting(true);
        setTimeout(() => {
            setIsInserting(false);
            Alert.alert("Success", "Successfully imported 142 transactions.", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        }, 1000);
    };

    return (
        <ScreenContainer contentContainerStyle={{ gap: theme.spacing.xl }} testID="import-screen">
            <View style={{ alignItems: "center", flexDirection: "row", gap: theme.spacing.lg }}>
                <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => {
                    if (step === "PICK") navigation.goBack();
                    else if (step === "PREVIEW") setStep("PICK");
                    else if (step === "MAP") setStep("PREVIEW");
                    else if (step === "VALIDATE") setStep("MAP");
                }}>
                    <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.lockTitle }}>←</Text>
                </Pressable>
                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.subScreenTitle }}>
                    Import CSV/Excel
                </Text>
            </View>

            {step === "PICK" && (
                <View style={{ gap: theme.spacing.lg, flex: 1, justifyContent: "center" }}>
                    <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.regular, fontSize: theme.typeScale.body, textAlign: "center" }}>
                        Select a CSV or Excel file containing your previous transaction history.
                    </Text>
                    <PrimaryButton onPress={handlePickFile}>
                        Choose File
                    </PrimaryButton>
                </View>
            )}

            {step === "PREVIEW" && (
                <View style={{ gap: theme.spacing.lg, flex: 1 }}>
                    <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium, fontSize: theme.typeScale.body }}>
                        File: {fileName}
                    </Text>
                    <SectionCard style={{ flex: 1 }}>
                        <ScrollView horizontal>
                            <View style={{ gap: theme.spacing.md }}>
                                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.colors.outline, paddingBottom: theme.spacing.xs }}>
                                    {["Date", "Description", "Amount"].map(h => (
                                        <Text key={h} style={{ width: 120, color: theme.colors.text, fontFamily: theme.fonts.bold }}>{h}</Text>
                                    ))}
                                </View>
                                {[
                                    ["2023-10-01", "Coffee Shop", "-4.50"],
                                    ["2023-10-02", "Salary", "3000.00"],
                                    ["2023-10-05", "Grocery Store", "-45.20"]
                                ].map((row, i) => (
                                    <View key={i} style={{ flexDirection: "row" }}>
                                        {row.map((cell, j) => (
                                            <Text key={j} style={{ width: 120, color: theme.colors.sub, fontFamily: theme.fonts.regular }}>{cell}</Text>
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
            )}

            {step === "MAP" && (
                <View style={{ gap: theme.spacing.lg, flex: 1 }}>
                    <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                        Map your columns to MoneyMap fields
                    </Text>
                    <SectionCard style={{ gap: theme.spacing.md }}>
                        {[
                            { field: "Date", mapped: "Date (Column 1)" },
                            { field: "Amount", mapped: "Amount (Column 3)" },
                            { field: "Category", mapped: "Unmapped" },
                            { field: "Note", mapped: "Description (Column 2)" }
                        ].map(col => (
                            <View key={col.field} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.medium }}>{col.field}</Text>
                                <View style={{ backgroundColor: theme.colors.track, padding: theme.spacing.sm, borderRadius: theme.radii.chip }}>
                                    <Text style={{ color: col.mapped === "Unmapped" ? theme.colors.warning : theme.colors.sub, fontFamily: theme.fonts.regular }}>
                                        {col.mapped}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </SectionCard>
                    <PrimaryButton onPress={() => setStep("VALIDATE")}>
                        Next: Validate
                    </PrimaryButton>
                </View>
            )}

            {step === "VALIDATE" && (
                <View style={{ gap: theme.spacing.lg, flex: 1 }}>
                    <SectionCard style={{ gap: theme.spacing.md, backgroundColor: theme.colors.tint }}>
                        <Text style={{ color: theme.colors.primary, fontFamily: theme.fonts.bold, fontSize: theme.typeScale.body }}>
                            Ready to import
                        </Text>
                        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular }}>
                            Found 142 valid transactions and 0 errors. Categories will be automatically created if they do not exist.
                        </Text>
                    </SectionCard>
                    <View style={{ flex: 1 }} />
                    <PrimaryButton disabled={isInserting} onPress={handleBulkInsert}>
                        {isInserting ? "Inserting..." : "Confirm & Import"}
                    </PrimaryButton>
                </View>
            )}
        </ScreenContainer>
    );
}
