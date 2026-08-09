import {
  RECURRING_REMINDER_LEAD_DAYS,
  categoryEmoji,
  defaultDueDateISO,
  formatLocalDateISO,
  isEmojiIcon,
  parseLocalDateToNoonEpoch,
  resolveDisplayEmoji,
} from "../src/domain/services/emoji";
import { computeReminderFireEpochMillis } from "../src/services/reminders";

describe("emoji helpers", () => {
  it("detects emoji icons vs ionicon names", () => {
    expect(isEmojiIcon("🍜")).toBe(true);
    expect(isEmojiIcon("restaurant")).toBe(false);
    expect(isEmojiIcon("pricetag")).toBe(false);
  });

  it("prefers custom icon over name map", () => {
    expect(resolveDisplayEmoji({ icon: "🌐", name: "Food" })).toBe("🌐");
    expect(resolveDisplayEmoji({ icon: "restaurant", name: "Food" })).toBe("🍜");
    expect(categoryEmoji("Transport")).toBe("🚌");
  });
});

describe("due date + 14-day reminder", () => {
  it("parses local YYYY-MM-DD to noon", () => {
    const epoch = parseLocalDateToNoonEpoch("2026-08-30");
    const d = new Date(epoch);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(30);
    expect(d.getHours()).toBe(12);
    expect(formatLocalDateISO(epoch)).toBe("2026-08-30");
  });

  it("fires exactly 14 days before due at 09:00 local", () => {
    expect(RECURRING_REMINDER_LEAD_DAYS).toBe(14);
    const due = parseLocalDateToNoonEpoch("2026-08-30");
    const fire = computeReminderFireEpochMillis(due, RECURRING_REMINDER_LEAD_DAYS);
    const fireDate = new Date(fire);
    expect(fireDate.getFullYear()).toBe(2026);
    expect(fireDate.getMonth()).toBe(7);
    expect(fireDate.getDate()).toBe(16);
    expect(fireDate.getHours()).toBe(9);
  });

  it("defaultDueDateISO is lead days ahead", () => {
    const now = new Date(2026, 7, 1, 15, 0, 0, 0);
    expect(defaultDueDateISO(14, now)).toBe("2026-08-15");
  });
});
