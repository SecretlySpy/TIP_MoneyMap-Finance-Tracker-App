/**
 * Tags Domain Service (P2 Power Tools)
 * Hashtag extraction, filtering, and tag management.
 * Pure service, local-only.
 */

const HASHTAG_REGEX = /#([a-zA-Z0-9_\u0080-\uFFFF]+)/g;

/**
 * Extracts normalized hashtags from a text note.
 * Example: "Lunch with #friends at #cafeteria" -> ["friends", "cafeteria"]
 * @param {string} text
 * @returns {string[]}
 */
export function extractTags(text) {
  if (!text || typeof text !== "string") return [];
  const matches = text.match(HASHTAG_REGEX);
  if (!matches) return [];

  const unique = new Set(
    matches.map((m) => m.slice(1).toLowerCase().trim()).filter(Boolean)
  );
  return Array.from(unique);
}

/**
 * Filters transactions that have a matching tag.
 * @param {Array<object>} transactions
 * @param {string} tag
 * @returns {Array<object>}
 */
export function filterTransactionsByTag(transactions, tag) {
  if (!Array.isArray(transactions) || !tag) return transactions || [];
  const targetTag = tag.toLowerCase().replace(/^#/, "").trim();
  if (!targetTag) return transactions;

  return transactions.filter((tx) => {
    const tags = extractTags(tx.note || "");
    return tags.includes(targetTag);
  });
}

/**
 * Collects all unique tags across a collection of transactions with frequency counts.
 * @param {Array<object>} transactions
 * @returns {Array<{ tag: string, count: number, totalMinor: number }>}
 */
export function collectTagFrequencies(transactions) {
  if (!Array.isArray(transactions)) return [];

  const stats = new Map();
  for (const tx of transactions) {
    const tags = extractTags(tx.note || "");
    for (const tag of tags) {
      const existing = stats.get(tag) || { tag, count: 0, totalMinor: 0 };
      existing.count += 1;
      existing.totalMinor += Number(tx.amountMinor) || 0;
      stats.set(tag, existing);
    }
  }

  return Array.from(stats.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}

/**
 * Formats a note by appending a tag if it isn't already present.
 * @param {string} note
 * @param {string} tag
 * @returns {string}
 */
export function appendTagToNote(note, tag) {
  const cleanTag = tag.trim().replace(/^#/, "");
  if (!cleanTag) return (note || "").trim();

  const currentTags = extractTags(note || "");
  if (currentTags.includes(cleanTag.toLowerCase())) {
    return (note || "").trim();
  }

  const trimmed = (note || "").trim();
  return trimmed ? `${trimmed} #${cleanTag}` : `#${cleanTag}`;
}
