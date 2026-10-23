import {
  DEFAULT_STUDENT_TEMPLATES,
  SEMESTER_MONTH_COUNT,
  calculateTemplateTotal,
  validateTemplate,
  cloneTemplate,
  restoreSystemTemplate,
  formatTemplatePeriodDetails,
} from "../src/domain/services/budgetTemplates";
import {
  loadBudgetTemplatesStorage,
  saveBudgetTemplatesStorage,
  getActiveBudgetTemplates,
  saveBudgetTemplate,
  duplicateBudgetTemplate,
  deleteBudgetTemplate,
  restoreBudgetTemplate,
  clearBudgetTemplatesStorage,
} from "../src/services/budgetTemplatesStorage";

describe("Student Budget Templates - Research & Domain Calculations", () => {
  it("provides 4 research-backed NCR student budget presets", () => {
    expect(DEFAULT_STUDENT_TEMPLATES.length).toBe(4);

    const ids = DEFAULT_STUDENT_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("standard-student");
    expect(ids).toContain("commuter-student");
    expect(ids).toContain("dormer-student");
    expect(ids).toContain("scholar-bedspacer");
  });

  it("accurately calculates monthly and 5-month semester totals for Standard Student", () => {
    const standard = DEFAULT_STUDENT_TEMPLATES.find((t) => t.id === "standard-student");
    expect(standard).toBeDefined();

    const totals = calculateTemplateTotal(standard);
    // ₱4,800 + ₱2,200 + ₱1,400 + ₱600 + ₱1,000 + ₱1,200 = ₱11,200 (1,120,000 centavos)
    expect(totals.totalMinor).toBe(1_120_000);
    expect(totals.monthlyEquivalentMinor).toBe(1_120_000);
    expect(totals.semesterTotalMinor).toBe(1_120_000 * SEMESTER_MONTH_COUNT); // ₱56,000
    expect(totals.categoryCount).toBe(6);
  });

  it("accurately calculates monthly and semester totals for Daily Commuter Plan", () => {
    const commuter = DEFAULT_STUDENT_TEMPLATES.find((t) => t.id === "commuter-student");
    expect(commuter).toBeDefined();

    const totals = calculateTemplateTotal(commuter);
    // ₱4,000 + ₱2,000 + ₱1,200 + ₱500 + ₱1,000 = ₱8,700 (870,000 centavos)
    expect(totals.totalMinor).toBe(870_000);
    expect(totals.monthlyEquivalentMinor).toBe(870_000);
    expect(totals.semesterTotalMinor).toBe(870_000 * SEMESTER_MONTH_COUNT); // ₱43,500
  });

  it("accurately calculates monthly and semester totals for Dormer / Boarding House Plan", () => {
    const dormer = DEFAULT_STUDENT_TEMPLATES.find((t) => t.id === "dormer-student");
    expect(dormer).toBeDefined();

    const totals = calculateTemplateTotal(dormer);
    // ₱6,500 + ₱7,200 + ₱1,500 + ₱1,000 + ₱700 + ₱1,500 = ₱18,400 (1,840,000 centavos)
    expect(totals.totalMinor).toBe(1_840_000);
    expect(totals.monthlyEquivalentMinor).toBe(1_840_000);
    expect(totals.semesterTotalMinor).toBe(1_840_000 * SEMESTER_MONTH_COUNT); // ₱92,000
  });

  it("accurately handles SEMESTER period conversion", () => {
    const semesterPlan = {
      name: "Graduation Term Plan",
      period: "SEMESTER",
      categories: [
        { name: "Thesis & Printing", amountMinor: 250_000 }, // ₱2,500
        { name: "Graduation Fees", amountMinor: 500_000 },   // ₱5,000
      ],
    };

    const totals = calculateTemplateTotal(semesterPlan);
    expect(totals.totalMinor).toBe(750_000); // ₱7,500 semester total
    expect(totals.semesterTotalMinor).toBe(750_000);
    expect(totals.monthlyEquivalentMinor).toBe(Math.round(750_000 / 5)); // ₱1,500/mo
  });

  it("formats display details cleanly with currency symbol", () => {
    const details = formatTemplatePeriodDetails("MONTHLY", 1_120_000, "₱");
    expect(details.primaryLabel).toBe("₱11,200 / month");
    expect(details.secondaryLabel).toBe("Semester (5 mos): ₱56,000");
  });
});

describe("Student Budget Templates - Validation", () => {
  it("validates a healthy template successfully", () => {
    const result = validateTemplate({
      name: "QC Commuter",
      period: "MONTHLY",
      categories: [
        { name: "Food", amountMinor: 400_000 },
        { name: "Jeepney", amountMinor: 150_000 },
      ],
    });
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("rejects templates with missing or short names", () => {
    const emptyName = validateTemplate({ name: "", categories: [{ name: "Food", amountMinor: 100_000 }] });
    expect(emptyName.isValid).toBe(false);
    expect(emptyName.error).toContain("at least 2 characters");

    const singleChar = validateTemplate({ name: "A", categories: [{ name: "Food", amountMinor: 100_000 }] });
    expect(singleChar.isValid).toBe(false);
  });

  it("rejects templates without categories", () => {
    const noCats = validateTemplate({ name: "Empty Budget", categories: [] });
    expect(noCats.isValid).toBe(false);
    expect(noCats.error).toContain("At least one category is required");
  });

  it("rejects duplicate category names within the same template", () => {
    const duplicates = validateTemplate({
      name: "Dupe Test",
      categories: [
        { name: "Food", amountMinor: 200_000 },
        { name: "food", amountMinor: 100_000 },
      ],
    });
    expect(duplicates.isValid).toBe(false);
    expect(duplicates.error).toContain('Duplicate category "food"');
  });

  it("rejects non-positive or invalid category amounts", () => {
    const zeroAmount = validateTemplate({
      name: "Zero Budget",
      categories: [{ name: "Food", amountMinor: 0 }],
    });
    expect(zeroAmount.isValid).toBe(false);
    expect(zeroAmount.error).toContain("positive budget amount");

    const negativeAmount = validateTemplate({
      name: "Negative Budget",
      categories: [{ name: "Food", amountMinor: -50_000 }],
    });
    expect(negativeAmount.isValid).toBe(false);
  });
});

describe("Student Budget Templates - Storage & System Preset Protection", () => {
  beforeEach(async () => {
    await clearBudgetTemplatesStorage();
  });

  it("loads pristine presets by default when no user modifications exist", async () => {
    const templates = await getActiveBudgetTemplates();
    expect(templates.length).toBe(4);
    expect(templates.every((t) => t.isSystem && !t.isModified)).toBe(true);
  });

  it("protects system presets by saving modifications as user overrides", async () => {
    const standard = DEFAULT_STUDENT_TEMPLATES.find((t) => t.id === "standard-student");
    expect(standard).toBeDefined();

    // User increases Food budget to ₱6,000
    const customizedStandard = {
      ...standard,
      categories: standard.categories.map((c) =>
        c.name === "Food" ? { ...c, amountMinor: 600_000 } : c
      ),
    };

    const saveRes = await saveBudgetTemplate(customizedStandard);
    expect(saveRes.success).toBe(true);
    expect(saveRes.template.isSystem).toBe(true);
    expect(saveRes.template.isModified).toBe(true);

    // Verify active templates now has modified Standard Student
    const active = await getActiveBudgetTemplates();
    const updated = active.find((t) => t.id === "standard-student");
    expect(updated.isModified).toBe(true);
    const updatedFood = updated.categories.find((c) => c.name === "Food");
    expect(updatedFood.amountMinor).toBe(600_000);

    // Verify original immutable DEFAULT_STUDENT_TEMPLATES in memory was NOT mutated
    const originalPreset = DEFAULT_STUDENT_TEMPLATES.find((t) => t.id === "standard-student");
    const originalFood = originalPreset.categories.find((c) => c.name === "Food");
    expect(originalFood.amountMinor).toBe(480_000);
  });

  it("reverts modified system preset back to research defaults on restore", async () => {
    // Modify preset
    const standard = DEFAULT_STUDENT_TEMPLATES.find((t) => t.id === "standard-student");
    await saveBudgetTemplate({
      ...standard,
      categories: [{ name: "Food", amountMinor: 999_000 }],
    });

    let active = await getActiveBudgetTemplates();
    expect(active.find((t) => t.id === "standard-student").isModified).toBe(true);

    // Restore
    await restoreBudgetTemplate("standard-student");

    active = await getActiveBudgetTemplates();
    const restored = active.find((t) => t.id === "standard-student");
    expect(restored.isModified).toBe(false);
    expect(restored.categories.find((c) => c.name === "Food").amountMinor).toBe(480_000);
  });

  it("creates, saves, duplicates, and deletes custom user templates", async () => {
    // 1. Create custom template
    const newTemplate = {
      name: "Taft Avenue Bedspacer",
      description: "Shared condo bedspace along Taft Avenue near DLSU/CSB",
      period: "MONTHLY",
      categories: [
        { name: "Rent & Dues", amountMinor: 600_000, emoji: "🏢" },
        { name: "Food", amountMinor: 550_000, emoji: "🍲" },
        { name: "LRT Beep Card", amountMinor: 100_000, emoji: "💳" },
      ],
    };

    const saveRes = await saveBudgetTemplate(newTemplate);
    expect(saveRes.success).toBe(true);
    expect(saveRes.template.isCustom).toBe(true);
    expect(saveRes.template.id).toMatch(/^custom-/);

    let active = await getActiveBudgetTemplates();
    expect(active.length).toBe(5); // 4 presets + 1 custom
    const foundCustom = active.find((t) => t.name === "Taft Avenue Bedspacer");
    expect(foundCustom).toBeDefined();

    // 2. Duplicate custom template
    const duplicated = await duplicateBudgetTemplate(foundCustom.id, "Copy of Taft Bedspacer");
    expect(duplicated).toBeDefined();
    expect(duplicated.name).toBe("Copy of Taft Bedspacer");

    active = await getActiveBudgetTemplates();
    expect(active.length).toBe(6);

    // 3. Delete duplicated template
    const deleteRes = await deleteBudgetTemplate(duplicated.id);
    expect(deleteRes).toBe(true);

    active = await getActiveBudgetTemplates();
    expect(active.length).toBe(5);
    expect(active.some((t) => t.id === duplicated.id)).toBe(false);

    // 4. Attempting to delete a system preset is safely rejected
    const delPresetRes = await deleteBudgetTemplate("standard-student");
    expect(delPresetRes).toBe(false);
  });
});
