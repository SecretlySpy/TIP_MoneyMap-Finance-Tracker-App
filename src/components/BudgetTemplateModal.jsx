import React, { useState, useEffect, useMemo } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/tokens";
import { AppText as Text } from "./AppText";
import { PrimaryButton } from "./Buttons";
import { Chip } from "./Chip";
import { useFinanceStore } from "../store/financeStore";
import { useUiStore } from "../store/uiStore";
import { formatMinor, minorToWholePesos, parseWholePesosToMinor } from "../domain/services/money";
import {
  DEFAULT_STUDENT_TEMPLATES,
  calculateTemplateTotal,
  validateTemplate,
  formatTemplatePeriodDetails,
  SEMESTER_MONTH_COUNT,
} from "../domain/services/budgetTemplates";

const COMMON_STUDENT_EMOJIS = [
  "🍜", "🚌", "📚", "📱", "🏠", "🛒", "🧺", "📑", "🧴", "🛡️", "☕", "💻", "🎨", "🎮", "💊"
];

/**
 * Full Student Budget Template Manager & Modal
 * Allows researching, editing, duplicating, creating, and applying NCR student budget templates.
 */
export function BudgetTemplateModal({ visible, onClose, targetMonthYear }) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const insets = useSafeAreaInsets();

  const storeBudgetTemplates = useFinanceStore((s) => s.budgetTemplates);
  const categories = useFinanceStore((s) => s.categories);
  const currentMonthYear = useFinanceStore((s) => s.selectedMonthYear);
  const effectiveMonthYear = targetMonthYear || currentMonthYear;

  const loadBudgetTemplates = useFinanceStore((s) => s.loadBudgetTemplates);
  const saveBudgetTemplate = useFinanceStore((s) => s.saveBudgetTemplate);
  const duplicateBudgetTemplate = useFinanceStore((s) => s.duplicateBudgetTemplate);
  const deleteBudgetTemplate = useFinanceStore((s) => s.deleteBudgetTemplate);
  const restoreBudgetTemplate = useFinanceStore((s) => s.restoreBudgetTemplate);
  const applyBudgetTemplate = useFinanceStore((s) => s.applyBudgetTemplate);

  // Active filter tab: "ALL" | "PRESETS" | "CUSTOM"
  const [activeTab, setActiveTab] = useState("ALL");
  const [busy, setBusy] = useState(false);

  // Sub-modal states
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null when creating new
  const [applyReviewTemplate, setApplyReviewTemplate] = useState(null);

  // Fallback to DEFAULT_STUDENT_TEMPLATES if store not yet loaded
  const templates = useMemo(() => {
    if (storeBudgetTemplates && storeBudgetTemplates.length > 0) {
      return storeBudgetTemplates;
    }
    return DEFAULT_STUDENT_TEMPLATES;
  }, [storeBudgetTemplates]);

  useEffect(() => {
    if (visible && typeof loadBudgetTemplates === "function") {
      void loadBudgetTemplates().catch(() => {});
    }
  }, [visible, loadBudgetTemplates]);

  const filteredTemplates = useMemo(() => {
    if (activeTab === "PRESETS") {
      return templates.filter((t) => t.isSystem);
    }
    if (activeTab === "CUSTOM") {
      return templates.filter((t) => !t.isSystem);
    }
    return templates;
  }, [templates, activeTab]);

  const customCount = useMemo(
    () => templates.filter((t) => !t.isSystem).length,
    [templates]
  );

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setEditorVisible(true);
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setEditorVisible(true);
  };

  const handleDuplicate = async (template) => {
    if (busy) return;
    setBusy(true);
    try {
      await duplicateBudgetTemplate(template.id);
      Alert.alert("Template Duplicated", `Created a personalized copy of "${template.name}".`);
      setActiveTab("CUSTOM");
    } catch (err) {
      Alert.alert("Duplication Failed", err instanceof Error ? err.message : "Could not duplicate template.");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = (template) => {
    Alert.alert(
      "Reset to Default?",
      `Revert "${template.name}" back to its original researched Metro Manila allocations?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            try {
              await restoreBudgetTemplate(template.id);
              Alert.alert("Template Restored", `Reset "${template.name}" to system defaults.`);
            } catch (err) {
              Alert.alert("Restore Failed", err instanceof Error ? err.message : "Could not restore template.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (template) => {
    Alert.alert(
      "Delete Custom Template?",
      `Are you sure you want to delete "${template.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (busy) return;
            setBusy(true);
            try {
              await deleteBudgetTemplate(template.id);
              Alert.alert("Template Deleted", `Deleted "${template.name}".`);
            } catch (err) {
              Alert.alert("Delete Failed", err instanceof Error ? err.message : "Could not delete template.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      testID="budget-template-modal"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Dismiss template modal"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.scrim}
        />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.balance,
              borderTopRightRadius: theme.radii.balance,
              paddingBottom: Math.max(insets.bottom, theme.spacing.md),
            },
          ]}
        >
          {/* Grabber bar */}
          <View
            style={[
              styles.grabber,
              { backgroundColor: theme.colors.outline },
            ]}
          />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.cardHeader,
                }}
              >
                🎓 Student Semester Templates
              </Text>
              <Text
                style={{
                  color: theme.colors.sub,
                  fontFamily: theme.fonts.regular,
                  fontSize: theme.typeScale.small,
                  marginTop: 2,
                }}
              >
                Researched NCR living presets & personal budget plans
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close template modal"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                minWidth: 44,
              }}
            >
              <Text
                style={{
                  color: theme.colors.sub,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.title,
                }}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          {/* Tab Filter & Create Action */}
          <View style={styles.tabRow}>
            <View style={{ flexDirection: "row", gap: theme.spacing.xs, flex: 1 }}>
              <Chip
                onPress={() => setActiveTab("ALL")}
                selected={activeTab === "ALL"}
              >
                All ({templates.length})
              </Chip>
              <Chip
                onPress={() => setActiveTab("PRESETS")}
                selected={activeTab === "PRESETS"}
              >
                Presets
              </Chip>
              <Chip
                onPress={() => setActiveTab("CUSTOM")}
                selected={activeTab === "CUSTOM"}
              >
                Custom ({customCount})
              </Chip>
            </View>

            <Pressable
              accessibilityLabel="Create Custom Template"
              accessibilityRole="button"
              onPress={handleOpenCreate}
              style={[
                styles.createButton,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radii.chip,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.colors.onPrimary,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.small,
                }}
              >
                + New Template
              </Text>
            </Pressable>
          </View>

          {/* Template List */}
          <ScrollView
            contentContainerStyle={{
              gap: theme.spacing.md,
              paddingBottom: theme.spacing.xl,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 520 }}
          >
            {filteredTemplates.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 32 }}>📋</Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.body,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  {activeTab === "CUSTOM"
                    ? "No custom templates yet"
                    : "No templates found"}
                </Text>
                <Text
                  style={{
                    color: theme.colors.sub,
                    fontSize: theme.typeScale.small,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  {activeTab === "CUSTOM"
                    ? "Tap '+ New Template' above or duplicate any preset to build your custom student plan."
                    : "No budget templates available in this category."}
                </Text>
              </View>
            ) : (
              filteredTemplates.map((tpl) => {
                const totals = calculateTemplateTotal(tpl);
                const periodDetails = formatTemplatePeriodDetails(
                  tpl.period || "MONTHLY",
                  totals.totalMinor,
                  currencySymbol
                );

                return (
                  <View
                    key={tpl.id}
                    style={[
                      styles.templateCard,
                      {
                        backgroundColor: theme.colors.bg,
                        borderColor: tpl.isModified ? theme.colors.accent : theme.colors.outline,
                        borderRadius: theme.radii.card,
                      },
                    ]}
                  >
                    {/* Card Header & Badges */}
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontFamily: theme.fonts.bold,
                              fontSize: theme.typeScale.body,
                            }}
                          >
                            {tpl.name}
                          </Text>
                          {tpl.isSystem ? (
                            <View
                              style={[
                                styles.badge,
                                {
                                  backgroundColor: tpl.isModified
                                    ? theme.colors.tint
                                    : theme.colors.surface,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: tpl.isModified ? theme.colors.accent : theme.colors.sub,
                                  fontSize: 10,
                                  fontFamily: theme.fonts.bold,
                                }}
                              >
                                {tpl.isModified ? "CUSTOMIZED" : "NCR PRESET"}
                              </Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: theme.colors.surface },
                              ]}
                            >
                              <Text
                                style={{
                                  color: theme.colors.primary,
                                  fontSize: 10,
                                  fontFamily: theme.fonts.bold,
                                }}
                              >
                                CUSTOM
                              </Text>
                            </View>
                          )}
                        </View>

                        {tpl.lifestyle ? (
                          <Text
                            style={{
                              color: theme.colors.sub,
                              fontSize: theme.typeScale.small,
                              marginTop: 4,
                              fontStyle: "italic",
                            }}
                          >
                            {tpl.lifestyle}
                          </Text>
                        ) : tpl.description ? (
                          <Text
                            style={{
                              color: theme.colors.sub,
                              fontSize: theme.typeScale.small,
                              marginTop: 4,
                            }}
                          >
                            {tpl.description}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Amount & Period Breakdown */}
                    <View
                      style={[
                        styles.periodBox,
                        {
                          backgroundColor: theme.colors.surface,
                          borderRadius: theme.radii.chip,
                        },
                      ]}
                    >
                      <View>
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontFamily: theme.fonts.bold,
                            fontSize: theme.typeScale.cardHeader,
                          }}
                        >
                          {periodDetails.primaryLabel}
                        </Text>
                        <Text
                          style={{
                            color: theme.colors.sub,
                            fontSize: theme.typeScale.tiny,
                            marginTop: 1,
                          }}
                        >
                          {periodDetails.secondaryLabel}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: theme.colors.sub,
                          fontSize: theme.typeScale.tiny,
                          textAlign: "right",
                        }}
                      >
                        {totals.categoryCount} categories
                      </Text>
                    </View>

                    {/* Category Pills */}
                    <View style={styles.categoryPillWrap}>
                      {tpl.categories.map((c) => {
                        const amt = Number(c.amountMinor ?? c.limitMinor ?? 0);
                        const icon = c.icon ?? c.emoji ?? "📊";
                        return (
                          <View
                            key={c.name}
                            style={[
                              styles.categoryPill,
                              {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outline,
                                borderRadius: theme.radii.chip,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: theme.colors.sub,
                                fontSize: theme.typeScale.tiny,
                              }}
                            >
                              {icon} {c.name}: {formatMinor(amt, { currencySymbol, showCents: false })}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Action Bar */}
                    <View style={styles.cardActionRow}>
                      <Pressable
                        accessibilityLabel={`Apply ${tpl.name} to budget`}
                        accessibilityRole="button"
                        onPress={() => setApplyReviewTemplate(tpl)}
                        style={[
                          styles.applyButton,
                          {
                            backgroundColor: theme.colors.primary,
                            borderRadius: theme.radii.chip,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: theme.colors.onPrimary,
                            fontFamily: theme.fonts.bold,
                            fontSize: theme.typeScale.small,
                          }}
                        >
                          Apply to {effectiveMonthYear}
                        </Text>
                      </Pressable>

                      <View style={{ flexDirection: "row", gap: theme.spacing.xs }}>
                        <Pressable
                          accessibilityLabel={`Edit ${tpl.name}`}
                          accessibilityRole="button"
                          onPress={() => handleOpenEdit(tpl)}
                          style={[
                            styles.secondaryActionBtn,
                            {
                              borderColor: theme.colors.outline,
                              borderRadius: theme.radii.chip,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontFamily: theme.fonts.medium,
                              fontSize: theme.typeScale.small,
                            }}
                          >
                            Edit
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityLabel={`Duplicate ${tpl.name}`}
                          accessibilityRole="button"
                          onPress={() => void handleDuplicate(tpl)}
                          style={[
                            styles.secondaryActionBtn,
                            {
                              borderColor: theme.colors.outline,
                              borderRadius: theme.radii.chip,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: theme.colors.text,
                              fontFamily: theme.fonts.medium,
                              fontSize: theme.typeScale.small,
                            }}
                          >
                            Copy
                          </Text>
                        </Pressable>

                        {tpl.isSystem && tpl.isModified && (
                          <Pressable
                            accessibilityLabel={`Reset ${tpl.name} to defaults`}
                            accessibilityRole="button"
                            onPress={() => handleRestore(tpl)}
                            style={[
                              styles.secondaryActionBtn,
                              {
                                borderColor: theme.colors.outline,
                                borderRadius: theme.radii.chip,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: theme.colors.sub,
                                fontFamily: theme.fonts.medium,
                                fontSize: theme.typeScale.small,
                              }}
                            >
                              Reset
                            </Text>
                          </Pressable>
                        )}

                        {!tpl.isSystem && (
                          <Pressable
                            accessibilityLabel={`Delete ${tpl.name}`}
                            accessibilityRole="button"
                            onPress={() => handleDelete(tpl)}
                            style={[
                              styles.secondaryActionBtn,
                              {
                                borderColor: theme.colors.outline,
                                borderRadius: theme.radii.chip,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: theme.colors.accent,
                                fontFamily: theme.fonts.medium,
                                fontSize: theme.typeScale.small,
                              }}
                            >
                              Delete
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Template Apply Review Confirmation Sheet */}
      {applyReviewTemplate && (
        <TemplateApplyReviewSheet
          monthYear={effectiveMonthYear}
          onCancel={() => setApplyReviewTemplate(null)}
          onConfirm={async () => {
            if (busy) return;
            setBusy(true);
            try {
              const res = await applyBudgetTemplate({
                templateId: applyReviewTemplate.id,
                monthYear: effectiveMonthYear,
              });
              setApplyReviewTemplate(null);
              onClose();
              Alert.alert(
                "Template Applied",
                `Successfully applied ${res.appliedCategories.length} categories (${formatMinor(res.totalMinor, { currencySymbol, showCents: false })}) to ${effectiveMonthYear}.`
              );
            } catch (err) {
              Alert.alert(
                "Apply Failed",
                err instanceof Error ? err.message : "Could not apply template."
              );
            } finally {
              setBusy(false);
            }
          }}
          template={applyReviewTemplate}
          visible={Boolean(applyReviewTemplate)}
        />
      )}

      {/* Template Editor Sheet (Create & Edit) */}
      {editorVisible && (
        <TemplateEditorSheet
          existingCategories={categories}
          initialTemplate={editingTemplate}
          onCancel={() => {
            setEditorVisible(false);
            setEditingTemplate(null);
          }}
          onSave={async (savedData) => {
            if (busy) return;
            setBusy(true);
            try {
              await saveBudgetTemplate(savedData);
              setEditorVisible(false);
              setEditingTemplate(null);
              Alert.alert(
                "Template Saved",
                `Saved template "${savedData.name}".`
              );
            } catch (err) {
              Alert.alert(
                "Save Failed",
                err instanceof Error ? err.message : "Could not save template."
              );
            } finally {
              setBusy(false);
            }
          }}
          visible={editorVisible}
        />
      )}
    </Modal>
  );
}

/**
 * Apply Review Confirmation Sheet
 * Complies with Phase 7: Explicit user action, preview of target month, categories, and total.
 */
function TemplateApplyReviewSheet({ visible, template, monthYear, onConfirm, onCancel }) {
  const currencySymbol = useUiStore((state) => state.currencySymbol);
  const theme = useTheme();
  const totals = useMemo(() => calculateTemplateTotal(template), [template]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      testID="apply-review-sheet"
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Dismiss review sheet"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.scrim}
        />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.balance,
              borderTopRightRadius: theme.radii.balance,
              maxHeight: "85%",
              padding: theme.spacing.screen,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.cardHeader,
            }}
          >
            Confirm Budget Application
          </Text>

          <Text
            style={{
              color: theme.colors.sub,
              fontSize: theme.typeScale.small,
              marginTop: 4,
            }}
          >
            Review the category allocations before applying to your budget.
          </Text>

          {/* Target Month & Template Summary */}
          <View
            style={[
              styles.periodBox,
              {
                backgroundColor: theme.colors.bg,
                borderRadius: theme.radii.card,
                marginTop: theme.spacing.md,
              },
            ]}
          >
            <View>
              <Text
                style={{
                  color: theme.colors.sub,
                  fontSize: theme.typeScale.tiny,
                  textTransform: "uppercase",
                }}
              >
                Target Month
              </Text>
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.cardHeader,
                }}
              >
                {monthYear}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: theme.colors.sub,
                  fontSize: theme.typeScale.tiny,
                  textTransform: "uppercase",
                }}
              >
                Monthly Plan
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.cardHeader,
                }}
              >
                {formatMinor(totals.monthlyEquivalentMinor, { currencySymbol, showCents: false })}
              </Text>
            </View>
          </View>

          {/* Category Breakdown Table */}
          <Text
            style={{
              color: theme.colors.text,
              fontFamily: theme.fonts.bold,
              fontSize: theme.typeScale.small,
              marginTop: theme.spacing.md,
              marginBottom: theme.spacing.xs,
            }}
          >
            Category Allocations ({template.categories?.length || 0})
          </Text>

          <ScrollView
            contentContainerStyle={{ gap: theme.spacing.xs }}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 220 }}
          >
            {template.categories?.map((cat) => {
              const amt = Number(cat.amountMinor ?? cat.limitMinor ?? 0);
              const icon = cat.icon ?? cat.emoji ?? "📊";
              return (
                <View
                  key={cat.name}
                  style={[
                    styles.reviewRow,
                    {
                      borderColor: theme.colors.outline,
                    },
                  ]}
                >
                  <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.body }}>
                    {icon} {cat.name}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.bold,
                      fontSize: theme.typeScale.body,
                    }}
                  >
                    {formatMinor(amt, { currencySymbol, showCents: false })}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          {/* Safety Notice */}
          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: theme.colors.tint,
                borderRadius: theme.radii.chip,
                marginTop: theme.spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.sub,
                fontSize: theme.typeScale.tiny,
                lineHeight: 16,
              }}
            >
              🛡️ Safe application: Setting these limits creates or updates budget ceilings for {monthYear}. Your existing transactions and past budgets will not be altered.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <PrimaryButton onPress={onConfirm}>
              Confirm & Apply Template
            </PrimaryButton>

            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
              }}
            >
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Template Editor Sheet
 * Enables editing name, description, lifestyle, budgeting period, and adding/removing/adjusting categories.
 * Complies with Phases 4, 5, 6: Real-time recalculation, validation, touch-target discipline.
 */
function TemplateEditorSheet({
  visible,
  initialTemplate,
  existingCategories,
  onSave,
  onCancel,
}) {
  const theme = useTheme();
  const currencySymbol = useUiStore((state) => state.currencySymbol);

  const isEditing = Boolean(initialTemplate);
  const isSystem = Boolean(initialTemplate?.isSystem);

  const [name, setName] = useState(initialTemplate?.name || "");
  const [description, setDescription] = useState(
    initialTemplate?.description || initialTemplate?.lifestyle || ""
  );
  const [period, setPeriod] = useState(initialTemplate?.period || "MONTHLY");

  // Category rows: array of { id, name, amountString, emoji, icon }
  const [categoryRows, setCategoryRows] = useState(() => {
    if (initialTemplate?.categories && initialTemplate.categories.length > 0) {
      return initialTemplate.categories.map((c, i) => ({
        id: `row-${i}-${Date.now()}`,
        name: c.name || "",
        amountString: String(minorToWholePesos(Number(c.amountMinor ?? c.limitMinor ?? 0))),
        originalMinor: Number(c.amountMinor ?? c.limitMinor ?? 0),
        emoji: c.emoji ?? c.icon ?? "📊",
        icon: c.icon ?? c.emoji ?? "📊",
      }));
    }
    return [
      { id: "row-0", name: "Food", amountString: "4000", emoji: "🍜", icon: "🍜" },
      { id: "row-1", name: "Transport", amountString: "2000", emoji: "🚌", icon: "🚌" },
      { id: "row-2", name: "School Supplies", amountString: "1000", emoji: "📚", icon: "📚" },
    ];
  });

  // Adding category picker state
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📊");
  const [showAddForm, setShowAddForm] = useState(false);

  // Live total recalculation
  const liveTotals = useMemo(() => {
    let totalCents = 0;
    for (const row of categoryRows) {
      try {
        const unchanged = row.originalMinor != null && row.amountString === String(minorToWholePesos(row.originalMinor));
        const minor = unchanged ? row.originalMinor : parseWholePesosToMinor(row.amountString);
        if (minor > 0) totalCents += minor;
      } catch { /* Invalid draft amounts are reported by validation below. */ }
    }
    const isSemester = period === "SEMESTER";
    const monthlyEquivalent = isSemester
      ? Math.round(totalCents / SEMESTER_MONTH_COUNT)
      : totalCents;
    const semesterTotal = isSemester
      ? totalCents
      : totalCents * SEMESTER_MONTH_COUNT;

    return {
      totalMinor: totalCents,
      monthlyEquivalentMinor: monthlyEquivalent,
      semesterTotalMinor: semesterTotal,
      categoryCount: categoryRows.length,
    };
  }, [categoryRows, period]);

  // Validation
  const validationError = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      return "Template name must be at least 2 characters.";
    }
    if (categoryRows.length === 0) {
      return "Add at least one category.";
    }
    const seen = new Set();
    for (let i = 0; i < categoryRows.length; i++) {
      const r = categoryRows[i];
      const rName = r.name.trim();
      if (!rName) return `Category #${i + 1} must have a name.`;
      const lower = rName.toLowerCase();
      if (seen.has(lower)) return `Duplicate category "${rName}".`;
      seen.add(lower);

      let minor;
      try {
        minor = r.originalMinor != null && r.amountString === String(minorToWholePesos(r.originalMinor))
          ? r.originalMinor
          : parseWholePesosToMinor(r.amountString);
      } catch {
        return `Category "${rName}" must have a valid positive whole-peso amount.`;
      }
      if (minor <= 0) {
        return `Category "${rName}" must have a valid positive amount.`;
      }
    }
    return null;
  }, [name, categoryRows]);

  const handleRowAmountChange = (id, text) => {
    setCategoryRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, amountString: text } : r))
    );
  };

  const handleRowNameChange = (id, text) => {
    setCategoryRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: text } : r))
    );
  };

  const handleRowEmojiChange = (id, emoji) => {
    setCategoryRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, emoji, icon: emoji } : r))
    );
  };

  const handleRemoveRow = (id) => {
    setCategoryRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddCategorySubmit = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      Alert.alert("Missing Name", "Please enter or pick a category name.");
      return;
    }
    const existing = categoryRows.some(
      (r) => r.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      Alert.alert("Duplicate Category", `"${trimmed}" is already in this template.`);
      return;
    }

    setCategoryRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        name: trimmed,
        amountString: "1000",
        emoji: newCatEmoji,
        icon: newCatEmoji,
      },
    ]);
    setNewCatName("");
    setNewCatEmoji("📊");
    setShowAddForm(false);
  };

  // Quick select existing categories from store
  const availableExistingCategories = useMemo(() => {
    const existingSet = new Set(
      categoryRows.map((r) => r.name.trim().toLowerCase())
    );
    return (existingCategories || [])
      .filter((c) => c.type === "EXPENSE" && !existingSet.has(c.name.trim().toLowerCase()));
  }, [categoryRows, existingCategories]);

  const handleSave = () => {
    if (validationError) {
      Alert.alert("Validation Error", validationError);
      return;
    }

    const compiledCategories = categoryRows.map((r) => ({
      name: r.name.trim(),
      amountMinor: r.originalMinor != null && r.amountString === String(minorToWholePesos(r.originalMinor))
        ? r.originalMinor
        : parseWholePesosToMinor(r.amountString),
      emoji: r.emoji,
      icon: r.emoji,
    }));

    const compiledTemplate = {
      ...(initialTemplate || {}),
      name: name.trim(),
      description: description.trim(),
      lifestyle: description.trim(),
      period,
      categories: compiledCategories,
    };

    onSave(compiledTemplate);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
      testID="template-editor-sheet"
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Dismiss editor"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.scrim}
        />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.balance,
              borderTopRightRadius: theme.radii.balance,
              maxHeight: "92%",
              padding: theme.spacing.screen,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.cardHeader,
                }}
              >
                {isEditing ? `Edit: ${name || "Template"}` : "Create Custom Template"}
              </Text>
              {isSystem && (
                <Text
                  style={{
                    color: theme.colors.accent,
                    fontSize: theme.typeScale.tiny,
                    marginTop: 2,
                  }}
                >
                  ⚡ Customizing preset. Original researched preset remains recoverable.
                </Text>
              )}
            </View>
            <Pressable
              accessibilityLabel="Cancel editing"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onCancel}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                minWidth: 44,
              }}
            >
              <Text
                style={{
                  color: theme.colors.sub,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.title,
                }}
              >
                ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Template Name Input */}
            <View>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small, marginBottom: 4 }}>
                Template Name *
              </Text>
              <TextInput
                accessibilityLabel="Template name"
                onChangeText={setName}
                placeholder="e.g. U-Belt Bedspacer Budget"
                placeholderTextColor={theme.colors.sub}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.bg,
                    borderColor: theme.colors.outline,
                    color: theme.colors.text,
                    borderRadius: theme.radii.chip,
                  },
                ]}
                value={name}
              />
            </View>

            {/* Description / Lifestyle */}
            <View>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small, marginBottom: 4 }}>
                Description or Lifestyle Note (Optional)
              </Text>
              <TextInput
                accessibilityLabel="Template description"
                multiline
                numberOfLines={2}
                onChangeText={setDescription}
                placeholder="e.g. For commuter students taking LRT-2 and eating on campus"
                placeholderTextColor={theme.colors.sub}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.bg,
                    borderColor: theme.colors.outline,
                    color: theme.colors.text,
                    borderRadius: theme.radii.chip,
                    minHeight: 56,
                  },
                ]}
                value={description}
              />
            </View>

            {/* Budgeting Period Selection */}
            <View>
              <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small, marginBottom: 4 }}>
                Budgeting Period
              </Text>
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <Chip
                  onPress={() => setPeriod("MONTHLY")}
                  selected={period === "MONTHLY"}
                >
                  📅 Monthly (Standard)
                </Chip>
                <Chip
                  onPress={() => setPeriod("SEMESTER")}
                  selected={period === "SEMESTER"}
                >
                  🎓 Semester (5 Months)
                </Chip>
              </View>
            </View>

            {/* Real-Time Recalculation Banner */}
            <View
              style={[
                styles.periodBox,
                {
                  backgroundColor: theme.colors.bg,
                  borderColor: theme.colors.primary,
                  borderWidth: 1,
                  borderRadius: theme.radii.chip,
                },
              ]}
            >
              <View>
                <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                  {period === "MONTHLY" ? "Monthly Total (1 mo)" : "Semester Total (5 mos)"}
                </Text>
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.cardHeader,
                  }}
                >
                  {formatMinor(
                    period === "MONTHLY"
                      ? liveTotals.totalMinor
                      : liveTotals.semesterTotalMinor,
                    { currencySymbol, showCents: false }
                  )}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny }}>
                  {period === "MONTHLY" ? "Semester (5 mos)" : "Monthly Equivalent"}
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.body,
                  }}
                >
                  {formatMinor(
                    period === "MONTHLY"
                      ? liveTotals.semesterTotalMinor
                      : liveTotals.monthlyEquivalentMinor,
                    { currencySymbol, showCents: false }
                  )}
                </Text>
              </View>
            </View>

            {/* Category Allocations Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.bold,
                  fontSize: theme.typeScale.body,
                }}
              >
                Categories ({categoryRows.length})
              </Text>
              <Pressable
                accessibilityLabel="Add category to template"
                accessibilityRole="button"
                onPress={() => setShowAddForm(true)}
                style={[
                  styles.addCatBtn,
                  {
                    backgroundColor: theme.colors.tint,
                    borderRadius: theme.radii.chip,
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.small,
                  }}
                >
                  + Add Category
                </Text>
              </Pressable>
            </View>

            {/* Quick Add Category Section */}
            {showAddForm && (
              <View
                style={[
                  styles.addFormBox,
                  {
                    backgroundColor: theme.colors.bg,
                    borderColor: theme.colors.outline,
                    borderRadius: theme.radii.card,
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontFamily: theme.fonts.bold,
                    fontSize: theme.typeScale.small,
                  }}
                >
                  Add Category to Template
                </Text>

                {/* Available existing categories pills */}
                {availableExistingCategories.length > 0 && (
                  <View style={{ marginTop: theme.spacing.xs }}>
                    <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.tiny, marginBottom: 4 }}>
                      Choose existing MoneyMap category:
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {availableExistingCategories.slice(0, 8).map((cat) => (
                        <Pressable
                          key={cat.id}
                          accessibilityRole="button"
                          onPress={() => {
                            setNewCatName(cat.name);
                            setNewCatEmoji(cat.icon || "📊");
                          }}
                          style={[
                            styles.presetCatChip,
                            {
                              backgroundColor:
                                newCatName.toLowerCase() === cat.name.toLowerCase()
                                  ? theme.colors.tint
                                  : theme.colors.surface,
                              borderColor:
                                newCatName.toLowerCase() === cat.name.toLowerCase()
                                  ? theme.colors.primary
                                  : theme.colors.outline,
                            },
                          ]}
                        >
                          <Text style={{ color: theme.colors.text, fontSize: theme.typeScale.tiny }}>
                            {cat.icon} {cat.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* Custom Name & Emoji */}
                <View style={{ flexDirection: "row", gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
                  <TextInput
                    accessibilityLabel="New category name"
                    onChangeText={setNewCatName}
                    placeholder="Category name (e.g. WiFi / Laundry)"
                    placeholderTextColor={theme.colors.sub}
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outline,
                        color: theme.colors.text,
                        borderRadius: theme.radii.chip,
                      },
                    ]}
                    value={newCatName}
                  />
                  <TextInput
                    accessibilityLabel="New category emoji"
                    maxLength={2}
                    onChangeText={setNewCatEmoji}
                    style={[
                      styles.input,
                      {
                        width: 50,
                        textAlign: "center",
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.outline,
                        color: theme.colors.text,
                        borderRadius: theme.radii.chip,
                      },
                    ]}
                    value={newCatEmoji}
                  />
                </View>

                {/* Quick Emoji selection */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {COMMON_STUDENT_EMOJIS.slice(0, 8).map((em) => (
                    <Pressable
                      key={em}
                      accessibilityRole="button"
                      onPress={() => setNewCatEmoji(em)}
                      style={[
                        styles.emojiPickBtn,
                        {
                          backgroundColor:
                            newCatEmoji === em ? theme.colors.tint : theme.colors.surface,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{em}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleAddCategorySubmit}
                    style={[
                      styles.primarySmallBtn,
                      {
                        backgroundColor: theme.colors.primary,
                        borderRadius: theme.radii.chip,
                        flex: 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.onPrimary,
                        fontFamily: theme.fonts.bold,
                        fontSize: theme.typeScale.small,
                      }}
                    >
                      Add Category
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAddForm(false)}
                    style={[
                      styles.secondarySmallBtn,
                      {
                        borderColor: theme.colors.outline,
                        borderRadius: theme.radii.chip,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Editable Category Rows */}
            <View style={{ gap: theme.spacing.xs }}>
              {categoryRows.map((row, idx) => (
                <View
                  key={row.id}
                  style={[
                    styles.catRow,
                    {
                      backgroundColor: theme.colors.bg,
                      borderColor: theme.colors.outline,
                      borderRadius: theme.radii.chip,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 18, marginRight: 4 }}>{row.emoji}</Text>

                  <TextInput
                    accessibilityLabel={`Category ${idx + 1} name`}
                    onChangeText={(val) => handleRowNameChange(row.id, val)}
                    style={[
                      styles.rowNameInput,
                      { color: theme.colors.text, fontFamily: theme.fonts.medium },
                    ]}
                    value={row.name}
                  />

                  <View style={styles.amountInputWrap}>
                     <Text style={{ color: theme.colors.sub, fontSize: theme.typeScale.small }}>{currencySymbol}</Text>
                    <TextInput
                      accessibilityLabel={`Category ${idx + 1} amount`}
                      keyboardType="numeric"
                      onChangeText={(val) => handleRowAmountChange(row.id, val)}
                      style={[
                        styles.rowAmountInput,
                        { color: theme.colors.text, fontFamily: theme.fonts.bold },
                      ]}
                      value={row.amountString}
                    />
                  </View>

                  <Pressable
                    accessibilityLabel={`Remove ${row.name}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => handleRemoveRow(row.id)}
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 36,
                      minWidth: 36,
                    }}
                  >
                    <Text style={{ color: theme.colors.accent, fontSize: 16 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Validation Error banner */}
            {validationError && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.accent,
                    borderRadius: theme.radii.chip,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.accent, fontSize: theme.typeScale.tiny }}>
                  ⚠️ {validationError}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Save / Cancel Footer */}
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <PrimaryButton
              disabled={Boolean(validationError)}
              onPress={handleSave}
            >
              {isEditing ? "Save Template Changes" : "Save Custom Template"}
            </PrimaryButton>

            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
              }}
            >
              <Text style={{ color: theme.colors.sub, fontFamily: theme.fonts.medium }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheetContainer: {
    alignSelf: "center",
    maxHeight: "90%",
    maxWidth: 540,
    paddingHorizontal: 16,
    paddingTop: 12,
    width: "100%",
  },
  grabber: {
    alignSelf: "center",
    borderRadius: 2,
    height: 4,
    marginBottom: 8,
    width: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  createButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 12,
  },
  templateCard: {
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  periodBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryPillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  applyButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  secondaryActionBtn: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  reviewRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  noticeBox: {
    padding: 10,
  },
  input: {
    borderWidth: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  addCatBtn: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 10,
  },
  addFormBox: {
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  presetCatChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emojiPickBtn: {
    alignItems: "center",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  primarySmallBtn: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  secondarySmallBtn: {
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 12,
  },
  catRow: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rowNameInput: {
    flex: 1,
    fontSize: 14,
    minHeight: 36,
    paddingVertical: 0,
  },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rowAmountInput: {
    fontSize: 14,
    minHeight: 36,
    minWidth: 60,
    paddingVertical: 0,
    textAlign: "right",
  },
  errorBanner: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
