/**
 * Budget Template Domain Service
 * Researched student budget presets for NCR (Metro Manila, Philippines)
 * and custom budget template management.
 *
 * All monetary amounts are in Philippine Peso (PHP) integer minor units (centavos).
 * ₱1.00 = 100 minor units.
 */

import { formatMinor } from "./money";

export const SEMESTER_MONTH_COUNT = 5; // Standard Philippine academic semester duration (months)

/**
 * Researched student budget presets for Metro Manila (NCR), Philippines.
 * Calibrated against LTFRB transit discounts (RA 11314 20% PUV + DOTr 50% rail),
 * PSA CPI food benchmarks, university carinderia prices, and Metro Manila dorm listings.
 */
export const DEFAULT_STUDENT_TEMPLATES = [
  {
    id: "standard-student",
    name: "Standard Student Semester",
    description: "Balanced budget for tuition, books, commute, campus meals, personal care, and emergency buffer.",
    lifestyle: "Tailored for full-time NCR college students balancing academic supplies, daily commute, campus dining, and personal necessities.",
    period: "MONTHLY",
    semesterMonths: SEMESTER_MONTH_COUNT,
    isSystem: true,
    categories: [
      { name: "Food", amountMinor: 480_000, emoji: "🍜", icon: "🍜" }, // ₱4,800
      { name: "Transport", amountMinor: 220_000, emoji: "🚌", icon: "🚌" }, // ₱2,200
      { name: "School Supplies", amountMinor: 140_000, emoji: "📚", icon: "📚" }, // ₱1,400
      { name: "Load/Data", amountMinor: 60_000, emoji: "📱", icon: "📱" }, // ₱600
      { name: "Personal Care", amountMinor: 100_000, emoji: "🧴", icon: "🧴" }, // ₱1,000
      { name: "Emergency Buffer", amountMinor: 120_000, emoji: "🛡️", icon: "🛡️" }, // ₱1,200
    ],
  },
  {
    id: "commuter-student",
    name: "Daily Commuter Plan",
    description: "Optimized for daily transit (jeepney, bus, LRT/MRT) and campus meals for students living at home.",
    lifestyle: "Designed for NCR students commuting from home via jeepney, modern PUV, bus, or LRT/MRT, purchasing lunch and merienda on campus.",
    period: "MONTHLY",
    semesterMonths: SEMESTER_MONTH_COUNT,
    isSystem: true,
    categories: [
      { name: "Food", amountMinor: 400_000, emoji: "🍜", icon: "🍜" }, // ₱4,000
      { name: "Transport", amountMinor: 200_000, emoji: "🚌", icon: "🚌" }, // ₱2,000
      { name: "School Projects", amountMinor: 120_000, emoji: "📑", icon: "📑" }, // ₱1,200
      { name: "Load/Data", amountMinor: 50_000, emoji: "📱", icon: "📱" }, // ₱500
      { name: "Emergency Buffer", amountMinor: 100_000, emoji: "🛡️", icon: "🛡️" }, // ₱1,000
    ],
  },
  {
    id: "dormer-student",
    name: "Dormer / Boarding House Plan",
    description: "Covers monthly dorm rent, utilities share, full groceries, laundry, connectivity, and academic needs.",
    lifestyle: "Designed for independent students renting a bedspace or dorm near university clusters (U-Belt, Katipunan, Intramuros, Taft Ave).",
    period: "MONTHLY",
    semesterMonths: SEMESTER_MONTH_COUNT,
    isSystem: true,
    categories: [
      { name: "Rent & Boarding", amountMinor: 650_000, emoji: "🏠", icon: "🏠" }, // ₱6,500 (bedspace + electricity/water share)
      { name: "Food & Groceries", amountMinor: 720_000, emoji: "🛒", icon: "🛒" }, // ₱7,200 (3 meals/day @ ₱240/day x 30 days)
      { name: "Laundry & Personal", amountMinor: 150_000, emoji: "🧺", icon: "🧺" }, // ₱1,500 (weekly laundromat + hygiene)
      { name: "School Supplies", amountMinor: 100_000, emoji: "📚", icon: "📚" }, // ₱1,000
      { name: "Load/Data", amountMinor: 70_000, emoji: "📱", icon: "📱" }, // ₱700
      { name: "Emergency Buffer", amountMinor: 150_000, emoji: "🛡️", icon: "🛡️" }, // ₱1,500
    ],
  },
  {
    id: "scholar-bedspacer",
    name: "Scholar / Frugal Bedspacer",
    description: "Optimized budget for state university scholars or students sharing low-cost quad-bedspaces in Metro Manila.",
    lifestyle: "For budget-conscious students sharing quad-rooms, cooking or eating at campus carinderias, and walking or short jeep rides.",
    period: "MONTHLY",
    semesterMonths: SEMESTER_MONTH_COUNT,
    isSystem: true,
    categories: [
      { name: "Rent & Boarding", amountMinor: 400_000, emoji: "🛏️", icon: "🛏️" }, // ₱4,000
      { name: "Food", amountMinor: 500_000, emoji: "🍜", icon: "🍜" }, // ₱5,000
      { name: "Transport", amountMinor: 80_000, emoji: "🚌", icon: "🚌" }, // ₱800
      { name: "School Supplies", amountMinor: 70_000, emoji: "📚", icon: "📚" }, // ₱700
      { name: "Load/Data", amountMinor: 40_000, emoji: "📱", icon: "📱" }, // ₱400
      { name: "Emergency Buffer", amountMinor: 60_000, emoji: "🛡️", icon: "🛡️" }, // ₱600
    ],
  },
];

/**
 * Calculates total minor units for a template and its semester equivalent.
 * @param {{ categories: Array<{ amountMinor?: number, limitMinor?: number }>, period?: string }} template
 * @returns {{ totalMinor: number, monthlyEquivalentMinor: number, semesterTotalMinor: number, categoryCount: number }}
 */
export function calculateTemplateTotal(template) {
  if (!template || !Array.isArray(template.categories)) {
    return {
      totalMinor: 0,
      monthlyEquivalentMinor: 0,
      semesterTotalMinor: 0,
      categoryCount: 0,
    };
  }

  const totalMinor = template.categories.reduce((acc, cat) => {
    const amount = Number(cat.amountMinor ?? cat.limitMinor ?? 0);
    return acc + (Number.isSafeInteger(amount) && amount > 0 ? amount : 0);
  }, 0);

  const isSemester = template.period === "SEMESTER";
  const monthlyEquivalentMinor = isSemester
    ? template.categories.reduce((sum, cat) => {
        const amount = Number(cat.amountMinor ?? cat.limitMinor ?? 0);
        return sum + (Number.isSafeInteger(amount) && amount > 0
          ? Math.round(amount / SEMESTER_MONTH_COUNT) : 0);
      }, 0)
    : totalMinor;
  const semesterTotalMinor = isSemester
    ? totalMinor
    : totalMinor * SEMESTER_MONTH_COUNT;

  return {
    totalMinor,
    monthlyEquivalentMinor,
    semesterTotalMinor,
    categoryCount: template.categories.length,
  };
}

/**
 * Validates a template object.
 * @param {{ name?: string, categories?: Array<any>, period?: string }} template
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateTemplate(template) {
  if (!template || typeof template !== "object") {
    return { isValid: false, error: "Template data is required." };
  }

  const name = template.name?.trim();
  if (!name || name.length < 2) {
    return { isValid: false, error: "Template name must be at least 2 characters." };
  }
  if (name.length > 64) {
    return { isValid: false, error: "Template name cannot exceed 64 characters." };
  }

  if (!Array.isArray(template.categories) || template.categories.length === 0) {
    return { isValid: false, error: "At least one category is required in the template." };
  }

  const seenCategories = new Set();
  for (let i = 0; i < template.categories.length; i++) {
    const cat = template.categories[i];
    const catName = cat?.name?.trim();
    if (!catName) {
      return { isValid: false, error: `Category #${i + 1} must have a name.` };
    }
    const lowerName = catName.toLowerCase();
    if (seenCategories.has(lowerName)) {
      return { isValid: false, error: `Duplicate category "${catName}" in template.` };
    }
    seenCategories.add(lowerName);

    const amount = Number(cat.amountMinor ?? cat.limitMinor);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return {
        isValid: false,
        error: `Category "${catName}" must have a positive budget amount.`,
      };
    }
  }

  if (template.period && template.period !== "MONTHLY" && template.period !== "SEMESTER") {
    return { isValid: false, error: "Budgeting period must be either 'MONTHLY' or 'SEMESTER'." };
  }

  return { isValid: true, error: null };
}

/**
 * Creates a unique copy of a template for user customization.
 * @param {object} template
 * @param {string} [customName]
 * @returns {object}
 */
export function cloneTemplate(template, customName) {
  const nextId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const name = customName?.trim() || `Copy of ${template.name}`;
  return {
    ...template,
    id: nextId,
    name,
    isSystem: false,
    isCustom: true,
    isModified: false,
    originalPresetId: template.isSystem ? template.id : template.originalPresetId ?? null,
    categories: template.categories.map((c) => ({
      name: c.name,
      amountMinor: Number(c.amountMinor ?? c.limitMinor ?? 0),
      emoji: c.emoji ?? c.icon ?? "📊",
      icon: c.icon ?? c.emoji ?? "📊",
    })),
    createdAtEpochMillis: Date.now(),
    updatedAtEpochMillis: Date.now(),
  };
}

/**
 * Restores a predefined system template to its original researched values.
 * @param {string} templateId
 * @returns {object | null}
 */
export function restoreSystemTemplate(templateId) {
  const original = DEFAULT_STUDENT_TEMPLATES.find((t) => t.id === templateId);
  if (!original) return null;
  return {
    ...original,
    categories: original.categories.map((c) => ({ ...c })),
  };
}

/**
 * Formats period details for display.
 * @param {string} period "MONTHLY" | "SEMESTER"
 * @param {number} totalMinor
 * @param {string} [currencySymbol="₱"]
 * @returns {{ primaryLabel: string, secondaryLabel: string }}
 */
export function formatTemplatePeriodDetails(period, totalMinor, currencySymbol = "₱") {
  const isSemester = period === "SEMESTER";
  const monthlyMinor = isSemester ? Math.round(totalMinor / SEMESTER_MONTH_COUNT) : totalMinor;
  const semesterMinor = isSemester ? totalMinor : totalMinor * SEMESTER_MONTH_COUNT;

  return {
    primaryLabel: `${formatMinor(monthlyMinor, { currencySymbol, showCents: false })} / month`,
    secondaryLabel: `Semester (5 mos): ${formatMinor(semesterMinor, { currencySymbol, showCents: false })}`,
  };
}
