/**
 * Budget Template Persistence Service
 * Stores user-created templates and modifications to system presets.
 * Primary persistence in database `app_metadata` with fallback to SecureStore.
 */

import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_STUDENT_TEMPLATES,
  cloneTemplate,
  validateTemplate,
  restoreSystemTemplate,
} from "../domain/services/budgetTemplates";

export const BUDGET_TEMPLATES_STORAGE_KEY = "moneymap.budget_templates.v1";
export const BUDGET_TEMPLATES_STORAGE_VERSION = 1;

let memoryCache = null;

function emptyStore() {
  return {
    version: BUDGET_TEMPLATES_STORAGE_VERSION,
    customTemplates: [],
    systemOverrides: {},
  };
}

function parseStore(raw) {
  if (!raw || typeof raw !== "string") {
    return emptyStore();
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== BUDGET_TEMPLATES_STORAGE_VERSION) {
      return emptyStore();
    }
    const customTemplates = Array.isArray(parsed.customTemplates) ? parsed.customTemplates : [];
    const systemOverrides = parsed.systemOverrides && typeof parsed.systemOverrides === "object"
      ? parsed.systemOverrides
      : {};
    return {
      version: BUDGET_TEMPLATES_STORAGE_VERSION,
      customTemplates,
      systemOverrides,
    };
  } catch {
    return emptyStore();
  }
}

async function resolveDatabase(options = {}) {
  if (options.database) {
    return options.database;
  }
  try {
    const { initializeDatabase } = await import("../db/client");
    return await initializeDatabase();
  } catch {
    return null;
  }
}

/**
 * Loads the raw templates storage data.
 * @param {{ database?: any }} [options]
 * @returns {Promise<{ version: number, customTemplates: Array<any>, systemOverrides: Record<string, any> }>}
 */
export async function loadBudgetTemplatesStorage(options = {}) {
  const database = await resolveDatabase(options);
  if (database) {
    try {
      const result = await database.execute(
        "SELECT value FROM app_metadata WHERE key = ?",
        [BUDGET_TEMPLATES_STORAGE_KEY]
      );
      if (result?.rows?.[0]?.value) {
        const store = parseStore(result.rows[0].value);
        memoryCache = store;
        return store;
      }
    } catch {
      // Fall through to SecureStore/memory
    }
  }

  try {
    const stored = await SecureStore.getItemAsync(BUDGET_TEMPLATES_STORAGE_KEY);
    if (stored) {
      const store = parseStore(stored);
      memoryCache = store;
      return store;
    }
  } catch {
    // Fall through to memoryCache
  }

  return memoryCache ?? emptyStore();
}

/**
 * Persists templates storage data to database app_metadata and SecureStore.
 * @param {{ version: number, customTemplates: Array<any>, systemOverrides: Record<string, any> }} store
 * @param {{ database?: any }} [options]
 * @returns {Promise<boolean>}
 */
export async function saveBudgetTemplatesStorage(store, options = {}) {
  const validStore = {
    version: BUDGET_TEMPLATES_STORAGE_VERSION,
    customTemplates: Array.isArray(store?.customTemplates) ? store.customTemplates : [],
    systemOverrides: store?.systemOverrides && typeof store.systemOverrides === "object"
      ? store.systemOverrides
      : {},
  };

  memoryCache = validStore;
  const payload = JSON.stringify(validStore);
  let saved = false;

  const database = await resolveDatabase(options);
  if (database) {
    try {
      await database.execute(
        `INSERT INTO app_metadata (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [BUDGET_TEMPLATES_STORAGE_KEY, payload]
      );
      saved = true;
    } catch {
      // Best-effort database write
    }
  }

  try {
    await SecureStore.setItemAsync(BUDGET_TEMPLATES_STORAGE_KEY, payload);
    saved = true;
  } catch {
    // Best-effort SecureStore write
  }

  return saved;
}

/**
 * Retrieves the full list of active templates:
 * Default system templates (with any active user overrides applied) + custom user templates.
 * @param {{ database?: any }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function getActiveBudgetTemplates(options = {}) {
  const store = await loadBudgetTemplatesStorage(options);
  const overrides = store.systemOverrides ?? {};

  const systemTemplates = DEFAULT_STUDENT_TEMPLATES.map((preset) => {
    const override = overrides[preset.id];
    if (override) {
      return {
        ...preset,
        ...override,
        id: preset.id,
        isSystem: true,
        isModified: true,
        originalPresetId: preset.id,
      };
    }
    return {
      ...preset,
      isSystem: true,
      isModified: false,
    };
  });

  const customTemplates = (store.customTemplates ?? []).map((t) => ({
    ...t,
    isSystem: false,
    isCustom: true,
  }));

  return [...systemTemplates, ...customTemplates];
}

/**
 * Saves a new or modified template.
 * System presets are protected: customizations save as an override without mutating the base template.
 * @param {object} template
 * @param {{ database?: any }} [options]
 * @returns {Promise<{ success: boolean, template: object, error?: string }>}
 */
export async function saveBudgetTemplate(template, options = {}) {
  const validation = validateTemplate(template);
  if (!validation.isValid) {
    return { success: false, template, error: validation.error };
  }

  const store = await loadBudgetTemplatesStorage(options);
  const isSystem = Boolean(
    template.isSystem || DEFAULT_STUDENT_TEMPLATES.some((p) => p.id === template.id)
  );

  const cleanCategories = template.categories.map((c) => ({
    name: c.name.trim(),
    amountMinor: Number(c.amountMinor ?? c.limitMinor ?? 0),
    emoji: c.emoji ?? c.icon ?? "📊",
    icon: c.icon ?? c.emoji ?? "📊",
  }));

  let savedTemplate;

  if (isSystem) {
    // Save as user override
    const override = {
      name: template.name.trim(),
      description: template.description?.trim() || "",
      lifestyle: template.lifestyle?.trim() || "",
      period: template.period || "MONTHLY",
      categories: cleanCategories,
      isModified: true,
      updatedAtEpochMillis: Date.now(),
    };
    store.systemOverrides[template.id] = override;
    savedTemplate = {
      ...template,
      ...override,
      id: template.id,
      isSystem: true,
      isModified: true,
    };
  } else {
    // Custom user template
    const templateId = template.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    savedTemplate = {
      ...template,
      id: templateId,
      name: template.name.trim(),
      description: template.description?.trim() || "",
      lifestyle: template.lifestyle?.trim() || "",
      period: template.period || "MONTHLY",
      categories: cleanCategories,
      isSystem: false,
      isCustom: true,
      createdAtEpochMillis: template.createdAtEpochMillis || Date.now(),
      updatedAtEpochMillis: Date.now(),
    };

    const existingIndex = store.customTemplates.findIndex((t) => t.id === templateId);
    if (existingIndex >= 0) {
      store.customTemplates[existingIndex] = savedTemplate;
    } else {
      store.customTemplates.unshift(savedTemplate);
    }
  }

  await saveBudgetTemplatesStorage(store, options);
  return { success: true, template: savedTemplate };
}

/**
 * Duplicates any template as a new user-created custom template.
 * @param {string} templateId
 * @param {string} [customName]
 * @param {{ database?: any }} [options]
 * @returns {Promise<object | null>}
 */
export async function duplicateBudgetTemplate(templateId, customName, options = {}) {
  const activeList = await getActiveBudgetTemplates(options);
  const target = activeList.find((t) => t.id === templateId);
  if (!target) return null;

  const cloned = cloneTemplate(target, customName);
  const saveResult = await saveBudgetTemplate(cloned, options);
  return saveResult.success ? saveResult.template : null;
}

/**
 * Deletes a user-created template.
 * Built-in system presets cannot be deleted (only restored).
 * @param {string} templateId
 * @param {{ database?: any }} [options]
 * @returns {Promise<boolean>}
 */
export async function deleteBudgetTemplate(templateId, options = {}) {
  const isSystem = DEFAULT_STUDENT_TEMPLATES.some((p) => p.id === templateId);
  if (isSystem) {
    return false; // System presets cannot be deleted
  }

  const store = await loadBudgetTemplatesStorage(options);
  const initialCount = store.customTemplates.length;
  store.customTemplates = store.customTemplates.filter((t) => t.id !== templateId);

  if (store.customTemplates.length !== initialCount) {
    await saveBudgetTemplatesStorage(store, options);
    return true;
  }
  return false;
}

/**
 * Restores a modified system preset to its immutable original defaults.
 * @param {string} templateId
 * @param {{ database?: any }} [options]
 * @returns {Promise<object | null>}
 */
export async function restoreBudgetTemplate(templateId, options = {}) {
  const store = await loadBudgetTemplatesStorage(options);
  if (store.systemOverrides[templateId]) {
    delete store.systemOverrides[templateId];
    await saveBudgetTemplatesStorage(store, options);
  }
  return restoreSystemTemplate(templateId);
}

/**
 * Clears all custom templates and overrides (e.g. during account/data reset).
 * @param {{ database?: any }} [options]
 */
export async function clearBudgetTemplatesStorage(options = {}) {
  memoryCache = emptyStore();
  const database = await resolveDatabase(options);
  if (database) {
    try {
      await database.execute("DELETE FROM app_metadata WHERE key = ?", [
        BUDGET_TEMPLATES_STORAGE_KEY,
      ]);
    } catch {
      // Ignore
    }
  }
  try {
    await SecureStore.deleteItemAsync(BUDGET_TEMPLATES_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
