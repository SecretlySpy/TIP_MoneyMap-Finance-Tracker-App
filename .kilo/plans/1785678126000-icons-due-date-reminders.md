# Plan: Custom icons, delete UX, custom due date, 14-day reminders

_Generated: 2026-08-09 · For: implementation agent_

## Goal

1. Let users pick a **custom emoji/icon** when creating **budgets** and **recurring bills**.
2. Ensure **delete** works for budgets and recurring bills (and is discoverable).
3. Add a **user-selectable due date** on recurring bills (create + edit).
4. Fire local notifications **exactly 14 days before** that due date.

## Current state (audit)

| Area | Today |
|---|---|
| Budget display emoji | `categoryEmoji(name)` name→emoji map; category has `icon` TEXT but UI largely ignores it for display |
| Recurring display emoji | Same map via bill name / category |
| Budget delete | `deleteBudgetByCategoryName` + long-press “Delete budget” on BudgetsScreen |
| Recurring delete | `deleteRecurringById` + long-press “Delete” on RecurringScreen |
| Due date | `next_run_epoch_millis` exists; create flow sets `today + leadDays` — **no calendar picker** |
| Reminder lead | Per-rule `reminder_lead_days` (create default **7** in RecurringScreen; schema default 3); scheduler uses `due − leadDays` @ 09:00 |

## Decisions (recommended defaults)

| Topic | Decision |
|---|---|
| Icon storage (budgets) | On create/rename category path, store chosen **emoji** in `categories.icon` (already TEXT). Display prefers `category.icon` if it is a short emoji string, else fall back to `categoryEmoji(name)`. |
| Icon storage (recurring) | **Schema v3**: add `recurring_rules.icon TEXT` nullable. Display: rule.icon → else category emoji map. |
| Icon picker UX | Shared `EmojiPickerRow` chip grid (curated student set: 🍜🚌📚📱🛍️🎮🧾🏠🌐💧💵 etc. + optional free-text single emoji). No new native emoji keyboard dependency required. |
| Delete | Keep long-press delete; **also** add visible “Delete” in the action sheet (already present) and ensure empty-state copy mentions long-press. No schema change. |
| Due date | Create + edit: user picks **calendar day** (YYYY-MM-DD via `TextPromptModal` or simple date string `YYYY-MM-DD` / platform-friendly). Map to local noon `nextRunEpochMillis`. Monthly frequency still advances after catch-up. |
| 14-day reminder | On create (and when due date changes): set `reminderLeadDays = 14`, `reminderEnabled = true`. Remove free-form lead editor **or** lock default to 14 and hide edit (product: **fixed 14 days** per request). Scheduler already implements `due − leadDays`. |

## Constraints

- Theme tokens only; integer minor units unchanged.
- Local notifications only (`notificationScheduler` / `reminders.js`); no FCM.
- Screens → store → repository → SQL.
- Migrations additive (v3 for recurring icon).
- Unit-test pure helpers (emoji resolve, due date → epoch, lead = 14 fire time).

---

## Implementation plan

### 1. Shared emoji picker + resolve helper

**New:** `src/components/EmojiPickerRow.jsx`  
**New/extend:** `src/domain/services/emoji.js` (or extend `financeView.js`)

```js
// resolveDisplayEmoji({ icon, name }) 
// - if icon is 1–4 char emoji-like → use it
// - else categoryEmoji(name)
export const BUDGET_BILL_EMOJI_PRESETS = ["🍜","🚌","📚","📱","🛍️","🎮","🧾","🏠","🌐","💧","💡","🎓","💼","💵","📦"];
```

Wire presets into Budgets + Recurring create flows after name step (or same step).

### 2. Budgets — icon on create + delete visibility

**Files:** `BudgetsScreen.jsx`, `financeStore.addCategory` / `addBudget`, `financeView.buildBudgetCards` / `categoryEmoji` usage

1. Create flow steps: **name → emoji → limit** (or name+emoji together).
2. When creating category: `addCategory({ name, type: "EXPENSE", icon: selectedEmoji })`.
3. When reusing existing category: optionally `renameCategory` is separate; optional “update icon” via category update when user picks emoji for existing name (`categoryRepo.update(id, { icon })`).
4. `buildBudgetCards`: set `emoji: resolveDisplayEmoji(category)`.
5. Delete: keep long-press Delete; if missing visual affordance, add trash action text under card or keep Alert actions (already “Delete budget”).
6. Empty CTA pattern unchanged (single Add).

### 3. Recurring — icon column, due date, 14-day lead, delete

**Schema migration v3**

```sql
ALTER TABLE recurring_rules ADD COLUMN icon TEXT;
-- SQLite: new installs get column in CREATE; existing DBs via migration execute ALTER
```

- Bump `LATEST_SCHEMA_VERSION` to **3**.
- Fresh `CREATE TABLE` for new installs should include `icon TEXT` (refactor CREATE_SCHEMA or add column only in v3 ALTER for upgrades; for new DBs that run v1 CREATE then v3 ALTER, ALTER is enough).

**Store `addRecurringBill`**

```js
{
  name, amountMinor, categoryName,
  icon,                    // emoji
  dueEpochMillis,          // from user date
  leadDays: 14,            // fixed
}
// nextRunEpochMillis = dueEpochMillis (local noon)
// reminderLeadDays = 14
// reminderEnabled = true
// note = name
// icon = emoji
```

**RecurringScreen create flow**

1. Name  
2. Emoji picker  
3. Amount  
4. **Due date** (prompt `YYYY-MM-DD` with validation, or month/day helpers)  
5. Save  

**Edit (long-press)**

- Rename, Edit amount, **Edit due date**, Delete  
- Remove “Edit reminder days” (fixed 14) **or** show read-only “Reminds 14 days before”.  
- Chip text: `Remind 14 days before` (from `bill.leadDays` which will be 14).

**Display**

- `buildRecurringBills`: `emoji: rule.icon || categoryEmoji(name)`.

**Delete**

- Already wired; ensure confirm Alert remains.

### 4. Notifications — 14 days before due

**Files:** `reminders.js`, `notificationScheduler.js`, tests `__tests__/remindersScheduling.test.js`

1. Default lead **14** everywhere new rules are created.
2. `computeReminderFireEpochMillis(due, 14)` already correct — add explicit test: due Aug 30 → fire Aug 16 09:00 local.
3. On due-date edit: `updateRecurringRule({ nextRunEpochMillis, reminderLeadDays: 14 })` then existing `syncRemindersFromStores` on refresh.
4. Backfill optional: one-time on hydrate, clamp/set lead to 14 for all active rules? **Recommend yes** for product consistency with “exactly 14 days” — or only new/edited rules. Prefer **set 14 on create + on due date change**; leave legacy rules as-is unless user edits due date.

### 5. Repository / types / backup

- `recurringRepository` map/create/update `icon`.
- `domain/types.js` JSDoc `icon?: string|null` on RecurringRule.
- Backup/restore: include `icon` if backup format lists rule fields (check `dataTransfer.js`).

### 6. Tests

| Test | Assert |
|---|---|
| `emoji` / financeView | resolveDisplayEmoji prefers custom icon |
| remindersScheduling | fire = due − 14 days @ 09:00 |
| schema | migrate to v3; column present |
| recurring repo | create with icon + nextRun; update due |

### 7. Docs

- Update `AI Documentation Notes.md` (icon field, due date UX, fixed 14-day lead).
- Brief README note under Recurring if feature list exists.

---

## Out of scope

- Full OS emoji keyboard package.
- Per-bill custom lead days (unless product reopens later).
- Changing budget table schema (icon lives on category).
- Push/FCM.

## Validation

1. `npm test` green.  
2. Create budget with custom emoji → card shows it.  
3. Create bill with emoji + due date → list shows emoji + due; chip “Remind 14 days before”.  
4. Delete budget and bill via long-press.  
5. With reminders enabled + notification permission, scheduled fire time is 14 days before due (unit test + optional log of plan).  
6. Edit due date reschedules notification (identifier includes nextRun).

## Risk register

| Risk | Mitigation |
|---|---|
| SQLite ALTER on old DBs | v3 migration only ALTER ADD COLUMN icon |
| Emoji stored in icon breaks old icon name assumptions | resolveDisplayEmoji dual-path; seed icons remain ion-style names |
| Date prompt UX weak on Android | Validate ISO date; reject past dates with clear alert (or allow past for catch-up) |
| Fixed 14 vs existing 7-day rules | Document; only force 14 on new/edit due |

## File touch list

- `src/db/schema.js` (v3)
- `src/db/repositories/recurringRepository.js`
- `src/domain/types.js`
- `src/domain/services/financeView.js` (and/or `emoji.js`)
- `src/domain/services` + `src/services/reminders.js` (tests)
- `src/components/EmojiPickerRow.jsx`
- `src/screens/BudgetsScreen.jsx`
- `src/screens/RecurringScreen.jsx`
- `src/store/financeStore.js`
- `src/services/dataTransfer.js` (if backup shape needs icon)
- `__tests__/…`
- `AI Documentation Notes.md`
