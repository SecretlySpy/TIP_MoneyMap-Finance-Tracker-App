# Plan: Entity CRUD + custom naming (Budgets, Recurring, Accounts, Categories, Goals)

_Generated: 2026-08-09 · For: implementation agent_

## Goal

1. Remove the **duplicate Add control** on Budgets (and apply the same empty-list pattern elsewhere).
2. **Custom naming** when creating budgets = pick existing expense category **or type a new category name**, then set limit.
3. Same custom-name / rename UX on Recurring, Manage Accounts, Manage Categories, Savings Goals.
4. **Full CRUD** on those menus (today several only support Create, or Create + partial update).

## Decisions (confirmed)

| Topic | Decision |
|---|---|
| Budget “name” | No new budget nickname column. Label = **category name**. Create flow: choose/create category → set limit. |
| Delete when referenced | **Block delete** if transactions / budgets / recurring rules still reference the category or account. Soft-archive accounts where already supported. |
| Empty + Add CTA | When list empty: **only** `EmptyState` primary action. When list non-empty: **only** bottom `DashedButton`. Never both. |

## Current state (audit)

| Screen | Create | Read | Update | Delete | Gaps |
|---|---|---|---|---|---|
| **Budgets** | Yes (auto next unused category + limit) | Yes | Limit via long-press (routes through `addBudget`) | Long-press delete | Duplicate Add when empty (`EmptyState` + `DashedButton`); no user-chosen category/name |
| **Recurring** | Yes (name + amount; category forced to Bills) | Yes | No | Long-press delete | No rename/edit amount/lead/category |
| **Manage Accounts** | No | Yes | Rename + starting balance | No | No create; no archive/delete |
| **Manage Categories** | Yes (expense/income) | Yes | No | No | No rename/delete |
| **Goals** | Yes (name + target) | Yes | Contribute | Archive only | No rename; no edit target; no hard delete |

Store already has pieces: `addBudget`, `updateBudgetLimit`, `deleteBudgetByCategoryName`, `addRecurringBill`, `deleteRecurringById`, `updateAccount`, `addCategory`, `addGoal`, `contributeToGoal`, `archiveGoal`. Missing: category update/delete, account create/archive, recurring update, goal rename/update/delete.

## Constraints

- Theme tokens only; integer minor units; screens → store → repository → SQL.
- Keep FK `RESTRICT`; do not cascade-delete history.
- Confirm destructive actions with `Alert`.
- Reuse `TextPromptModal`, `EmptyState`, `DashedButton`, long-press or explicit action rows (44px targets).
- Unit-test new pure helpers and repository delete-guards.

---

## Implementation order

### 1. Budgets — duplicate CTA + custom naming + CRUD polish

**Files:** `src/screens/BudgetsScreen.jsx`, `src/store/financeStore.js` (if needed)

1. **Duplicate button**
   - Render `DashedButton` only when `cards.length > 0`.
   - Empty list: only `EmptyState` → `beginAddBudget`.

2. **Create flow (custom name)**
   - Step A: modal “Budget category” — free-text name (placeholder e.g. Food / School).
   - Resolve category: if expense category with that name exists, use it; else `addCategory({ name, type: "EXPENSE" })` then use it.
   - If that category already has a budget for `selectedMonthYear`, alert and abort (unique constraint).
   - Step B: limit modal (existing).
   - Call `addBudget({ categoryName, limitMinor, monthYear })`.

3. **Update / Delete** (already partially present)
   - Keep long-press: Edit limit / Delete.
   - Ensure edit path uses `updateBudgetLimit` (or equivalent) and does not create a second row.
   - Optional: add explicit “Rename category” action that calls category rename (shared with Manage Categories) so budget label updates.

4. **Optional UX:** category picker chip list of unused expense categories + “Custom…” to type a name (recommended if free-text alone feels sparse).

### 2. Store / repository APIs (shared foundation)

**Files:** `financeStore.js`, `categoryRepository.js`, `accountRepository.js`, `recurringRepository.js`, `goalRepository.js` (extend as needed)

Add thin store methods (all refresh after write):

| Method | Behavior |
|---|---|
| `renameCategory(id, name)` | Trim; reject blank/duplicate same type; `categoryRepo.update` |
| `deleteCategory(id)` | If any tx / budget / recurring references id → throw user-facing error; else delete |
| `createAccount({ name, type, startingBalanceMinor })` | Create; reject if type policy violated (see Accounts) |
| `archiveAccount(id)` | `isArchived: true` (prefer over hard delete) |
| `updateRecurringRule(id, patch)` | amountMinor, note (display name), reminderLeadDays, categoryId, isActive |
| `renameGoal(id, name)` / `updateGoal(id, { targetMinor, deadline… })` / `deleteGoal(id)` | Hard delete OK for goals (no FKs from txs) |

**Delete-in-use helper** (pure, unit-tested):

```js
// e.g. src/domain/services/entityGuards.js
canDeleteCategory(categoryId, { transactions, budgets, recurringRules })
canArchiveAccount(accountId, { transactions, recurringRules }) // optional warn if still referenced
```

### 3. Recurring & Reminders — full CRUD + naming

**File:** `src/screens/RecurringScreen.jsx`

- **Create:** keep name step + amount; optionally pick category (default Bills).
- **Update:** long-press or row actions → Rename (writes `note`), Edit amount, Edit lead days (simple numeric modal), Toggle active if desired.
- **Delete:** keep confirm + `deleteRecurringById`.
- Empty: only `EmptyState` CTA; hide `DashedButton` when `bills.length === 0`.

Wire `updateRecurringRule` in store → `RecurringRepository.update` (already exists for catch-up fields).

### 4. Manage Accounts — create + rename + update + archive

**File:** `src/screens/ManageAccountsScreen.jsx`

- Keep Rename + Edit starting balance.
- **Create:** dashed “Add account” → name + type chips (CASH/CARD/EWALLET). Policy recommendation: allow multiple names per type OR one active per type — **recommend allow multiple** with distinct names (matches rename already existing).
- **Delete:** “Archive” with confirm; block only if product requires ≥1 active account (recommend: allow archive all but Entry must handle empty chips — if no accounts, show alert on Entry save). Safer: require at least one non-archived account.
- Empty CTA pattern for zero active accounts.

### 5. Manage Categories — rename + delete + create

**File:** `src/screens/ManageCategoriesScreen.jsx`

- Per row actions: Rename | Delete (44px).
- Rename → `renameCategory`.
- Delete → `deleteCategory` with in-use guard message listing why (e.g. “Used by 12 transactions”).
- Keep add expense/income buttons; when group empty, optional inline empty text only (no duplicate dashed if group empty but other group full — keep both dashed add buttons at bottom as today).

### 6. Savings Goals — rename + update target + delete

**File:** `src/screens/GoalsScreen.jsx`

- Row/menu: Rename, Edit target, Contribute (existing), Delete (hard) or keep Archive + add Delete.
- Recommend: **Rename**, **Edit target**, **Contribute**, **Delete** (confirm). Archive optional secondary.
- Empty: only EmptyState CTA; DashedButton when list non-empty.

### 7. Shared UX patterns

- Prefer **long-press → action sheet** on list cards (already Budgets/Recurring) **or** explicit text actions (Accounts style). Consistency recommendation:
  - Dense cards (Budget/Bill/Goal): long-press Alert with actions.
  - Manage lists: visible Rename / Edit / Delete links.
- All money via `parseDecimalToMinor` / `formatMinor`.
- Theme via bare `useTheme()`.

### 8. Tests

| Test | Assert |
|---|---|
| `entityGuards.test.js` | cannot delete category with tx/budget/rule; can when unused |
| `goals.test.js` extend | rename + delete repository |
| `repositories` / category | rename uniqueness; delete blocked |
| Manual / optional RNTL | Budgets empty shows one Add control |

### 9. Docs

- Update `AI Documentation Notes.md` for new store methods and screen behaviors.
- Touch README only if user-facing feature list needs “full manage CRUD”.

---

## Out of scope

- Changing budget schema to independent nickname column.
- Cascade-delete of transactions.
- Multi-user / cloud sync.
- Redesign of Figma layout beyond action affordances.

## Validation

1. `npm test` green (guards + repo + existing suites).
2. Manual: Budgets empty → single Add; create named custom category budget; edit limit; delete.
3. Recurring: create named bill; rename; edit amount; delete.
4. Categories: rename; delete unused; delete used → blocked.
5. Accounts: create; rename; edit balance; archive (with ≥1 active rule if adopted).
6. Goals: create; rename; edit target; contribute; delete.
7. No hardcoded hex in touched screens; money remains integer minor units.

## Risk register

| Risk | Mitigation |
|---|---|
| Creating budget with new category races unique budget | Check existing budget for category+month before insert |
| Deleting category used only by archived goals | Goals don’t FK categories — N/A |
| Entry breaks if all accounts archived | Enforce ≥1 active account on archive |
| Edit budget limit accidentally creates duplicate | Use update-by-id path, not create |

## File touch list (expected)

- `src/screens/BudgetsScreen.jsx`
- `src/screens/RecurringScreen.jsx`
- `src/screens/ManageAccountsScreen.jsx`
- `src/screens/ManageCategoriesScreen.jsx`
- `src/screens/GoalsScreen.jsx`
- `src/store/financeStore.js`
- `src/db/repositories/categoryRepository.js` (if update missing)
- `src/db/repositories/accountRepository.js` (create/archive already partial)
- `src/db/repositories/recurringRepository.js` (update already exists)
- `src/db/repositories/goalRepository.js`
- `src/domain/services/entityGuards.js` (new)
- `__tests__/entityGuards.test.js` (new)
- `AI Documentation Notes.md`
