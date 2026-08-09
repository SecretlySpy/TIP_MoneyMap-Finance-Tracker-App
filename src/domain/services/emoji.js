/** Curated student-friendly presets for budgets & bills. */
export const BUDGET_BILL_EMOJI_PRESETS = Object.freeze([
  "🍜", "🚌", "📚", "📱", "🛍️", "🎮", "🧾", "🏠", "🌐", "💧", "💡", "🎓", "💼", "💵", "📦", "☕", "🎬", "💊",
]);

/** Fixed reminder lead for recurring bills (product requirement). */
export const RECURRING_REMINDER_LEAD_DAYS = 14;

const NAME_EMOJI = {
  Food: "🍜",
  Transport: "🚌",
  School: "📚",
  "Load/Data": "📱",
  Shopping: "🛍️",
  Entertainment: "🎮",
  Fun: "🎮",
  Bills: "🧾",
  Health: "💊",
  Other: "📦",
  Allowance: "💵",
  "Part-time": "💼",
  Scholarship: "🎓",
  Gifts: "🎁",
  Income: "💼",
  Internet: "🌐",
  Rent: "🏠",
  Netflix: "📺",
  Water: "💧",
};

/**
 * @param {string} name
 */
export function categoryEmoji(name) {
  return NAME_EMOJI[name] ?? "📦";
}

/**
 * True when value looks like a short emoji / symbol (not an ionicon name).
 * @param {unknown} value
 */
export function isEmojiIcon(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 8) {
    return false;
  }
  // ionicon-style names are ascii words with dashes
  if (/^[a-z0-9-]+$/i.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * @param {{ icon?: string|null, name?: string|null }} entity
 */
export function resolveDisplayEmoji(entity = {}) {
  if (isEmojiIcon(entity.icon)) {
    return entity.icon.trim();
  }
  return categoryEmoji(entity.name ?? "Other");
}

/**
 * Parse YYYY-MM-DD to local noon epoch millis.
 * @param {string} isoDate
 * @returns {number}
 */
export function parseLocalDateToNoonEpoch(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? "").trim());
  if (match === null) {
    throw new Error("Use date format YYYY-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    throw new Error("Invalid calendar date.");
  }
  return date.getTime();
}

/**
 * @param {number} epochMillis
 * @returns {string} YYYY-MM-DD local
 */
export function formatLocalDateISO(epochMillis) {
  const d = new Date(epochMillis);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Default due date suggestion: today + lead days.
 * @param {number} [leadDays]
 * @param {Date} [now]
 */
export function defaultDueDateISO(leadDays = RECURRING_REMINDER_LEAD_DAYS, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + leadDays, 12, 0, 0, 0);
  return formatLocalDateISO(d.getTime());
}
