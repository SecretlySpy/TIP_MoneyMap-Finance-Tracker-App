# Design Prototype

Updated: 2026-10-07

## UI interlock prompt for benchmark-driven additions (2026-10-07)

The schema/repository layer may support account transfers without a new visual surface. No transfer,
reconciliation, rollover, subscription-review, or reporting screen/component should be implemented until a
design produced from the prompt below has exact frame/node IDs and has been reviewed against the current
MoneyMap component system.

> Extend the existing **MoneyMap — Finance Tracker** Figma file on a new page named
> **MoneyMap — Strategy 100726**. Preserve the existing visual identity, Roboto typography, semantic light/dark
> tokens, rounded cards/sheets, spacing rhythm, student-friendly offline voice, and current navigation model.
> Design paired Android phone **412×892** and tablet **834×1194** states; use responsive reflow rather than a
> desktop redesign. Do not add login, bank linking, cloud sync, household sharing, investment trading, or
> remote-finance storage.
>
> **1. Account transfer flow.** Extend Add Transaction with a clearly distinct Transfer mode that never reads as
> income or expense. Include From account, To account, swap action, amount, local-noon date picker, optional
> note, current-balance context, post-transfer balance preview, and Save. Design default, focused, partially
> complete, loading, saved, retry-safe saved, database-error, fewer-than-two-active-accounts, archived-account,
> same-account, invalid/zero amount, and safe-integer/range error states. Negative destination/source balances
> are allowed and must be explained rather than blocked. Show transfer rows in History with directional copy
> (for example, “Cash → Student Card”), neutral styling, account filters, detail, edit, and deliberate delete
> confirmation. Transfers must be excluded from income, spending, budget, and cash-flow totals.
>
> **2. Account balance and reconciliation flow.** Add an account-detail entry point from Manage Accounts. Show
> opening balance, cleared balance, working balance, inflows, outflows, inbound/outbound transfers, and last
> reconciled date. Design a reconciliation sheet with statement date/balance, a transaction checklist,
> cleared/uncleared states, live difference, “balanced” success, discrepancy explanation, cancel/resume, and an
> optional adjustment transaction that requires explicit confirmation and names its effect. Include empty
> account, negative card balance/debt, stale statement, unmatched imported row, and interrupted-save states.
>
> **3. Budget rollover and semester funds.** Add a per-category rollover control and a semester-plan setup flow.
> Show the formula `prior carry + this month plan − actual = next carry`, including positive and negative carry,
> first-month starting balance, toggle-off consequences, copy-last-month, and reset. Provide templates for
> tuition, books/supplies, transport, food, mobile load/data, rent/boarding, and emergency buffer. Show how
> rollovers interact with Safe-to-Spend and savings goals without double counting. Include 24-month boundary,
> overspent, no-prior-budget, and edited-past-month states.
>
> **4. Recurring-charge review center.** Design a local-only review queue for likely recurring transactions.
> Each candidate needs merchant/note, account, usual amount/range, cadence, confidence explanation in plain
> language, last/next expected date, confirm, dismiss, edit, and reminder controls. Include price-change warning,
> missed expected charge, duplicate candidate, insufficient-history, all-reviewed empty, and offline states.
> Detection must never create or modify a ledger row without user confirmation.
>
> **5. Reports and student debt views.** Design cash-flow and net-worth trend views with month/semester range,
> category/account filters, accessible chart alternatives, exact totals, empty/partial data, and an explanatory
> “Transfers excluded” note. Add a lightweight debt-payoff scenario for credit cards, BNPL, or student loans;
> label projections as estimates and keep them separate from recorded ledger facts.
>
> **Shared requirements.** Reuse or extend `ScreenContainer`, `SectionCard`, `BottomSheet`, `CalendarPickerSheet`,
> `MonthChip`, `TransactionRow`, `Chip`, `Toggle`, `ProgressBar`, `EmptyState`, and existing semantic tokens before
> inventing components. Define every new component and variant with exact names, dimensions, padding, typography,
> colors/tokens, icons, elevation, pressed/disabled/focus/error states, and phone/tablet behavior. Include loading,
> empty, success, offline, validation, retry, and destructive-confirmation states. Maintain at least **44 dp** touch
> targets, logical TalkBack order, explicit accessibility labels/hints, non-color status cues, large-text reflow,
> keyboard-safe sheets/forms, visible focus, reduced-motion behavior, and WCAG AA text contrast. Use realistic
> Philippine peso student data without exposing personal data or inventing claims.
>
> **Handoff output.** Return a frame inventory, stable page/frame/node IDs, component/variant inventory, token
> mapping, interaction/prototype links, copy deck, redlines, responsive annotations, accessibility annotations,
> data dependencies, and a state-to-acceptance matrix. Clearly label observed reuse versus proposed design.
> Do not claim implementation or parity; this artifact is the prerequisite design reference for coding.

## Source of truth and evidence boundary

[MoneyMap Figma — Update 092726, page `75:172`](https://www.figma.com/design/JeEeOG1jZ0B72pA8gf7fMk/MoneyMap---Finance-Tracker?node-id=75-172)

The supplied development plan records **52 mobile screens/states and 52 matching tablet screens/states**. These are state references, not 104 separate route components. The older 22-frame inventory remains useful as route-oriented historical context, but it is not the current design count.

Live Figma access required reauthentication during the 2026-10-03 implementation pass. Therefore, the current frame contents and visual diffs were not independently inspected. The mappings in this document are grounded in the supplied 52-state inventory, current source files, and automated tests. They demonstrate implementation traceability; they do **not** establish per-frame pixel parity.

Native phone and tablet visual/device acceptance is **UNVERIFIED**. In particular, safe-area behavior, keyboard overlap, focus appearance, font rendering, rotation, and device-specific biometric behavior still require checks on representative native runtimes.

## Primary journeys

```text
Splash ──> Onboarding ──> Dashboard ──> Entry ──save──> History
              │               ├──────> History / Budgets / Recurring
              │               ├──────> Savings Goals
              │               ├──────> Smart Tips (offline; online optional)
              │               └──────> Student Eats (fixed TIP QC; network search)
              └──resume/back/skip──> persisted first-run progress

Budgets ──> Add Budget Sheet (Step 1: Category) ──> Set Limit Sheet (Step 2: Limit)
Recurring ──> Add Recurring Bill Sheet (EmojiGrid + interval + lead time chips)
Savings Goals ──> Add Savings Goal Sheet (EmojiGrid + target + deadline)
Settings ──> Import ──map columns──> Resolve Accounts ──confirm──> History
         ├─> Restore backup ──> Undo last restore
         ├─> App Lock (optional setup with 4-digit PIN + cancel)
         └─> Replay Splash
```

## Current 52-state traceability

This matrix traces each feature group from the supplied plan to current implementation and automated behavioral evidence. It is a six-group mapping, not an individual 104-frame inventory: exact node IDs, interactions, and matching screenshots were inaccessible without Figma authentication. A group marked “mapped” has code and tests representing its behavior, not independently verified Figma parity.

| Feature group | States per device | Current screens/components | Automated evidence | Status and remaining visual evidence |
| --- | ---: | --- | --- | --- |
| Onboarding/recovery | 18 | `OnboardingScreen`, `PasteImportScreen`; `ScreenContainer`; `src/services/onboarding.js`; persisted onboarding state in `uiStore` | `onboarding.test.js`, `onboardingScreen.test.jsx`, `uiStoreOnboarding.test.js`, `splashOnboarding.test.jsx`, `dataTransfer.test.js` | Behavior mapped for draft resume, back/skip, account reuse, failed-write retention, stable first-expense provenance, restore, and undo. Native focus/loading/error/success layouts on phone/tablet are **UNVERIFIED**. |
| Daily finance/history | 14 | `DashboardScreen`, `EntryScreen`, `HistoryScreen`, `TransactionDetailScreen`, `EditTransactionScreen`; `CalendarPickerSheet`, `MonthChip`, `TransactionRow`, `SafeToSpendCard` | `dashboardNavigation.test.jsx`, `historySearch.test.jsx`, `transactionEdit.test.js`, `financeView.test.js`, `monthChipCalendar.test.jsx`, `repositories.test.js`, `storeIntegration.test.js` | Real-data CRUD, search/filter behavior, explicit calendar selection, and recurring-origin date protection are mapped. Long-list, keyboard, and tablet visual comparisons are **UNVERIFIED**. |
| Budgets/bills/goals | 7 | `BudgetsScreen`, `RecurringScreen`, `GoalsScreen`; `BudgetCard`, `GoalCard`, `BottomSheet`, `CalendarPickerSheet`, `EmojiGrid` | `goals.test.js`, `recurringCatchUp.test.js`, `remindersScheduling.test.js`, `emojiAndDueDate.test.js`, `monthChipCalendar.test.jsx`, `qaStoreFlows.test.jsx` | Monthly data behavior, recurrence, reminders, goals, and calendar navigation are mapped. Bottom-sheet and card parity on native phone/tablet is **UNVERIFIED**. |
| Accounts/import | 7 | `ManageAccountsScreen`, `ImportScreen`, `PasteImportScreen`; import parser/review and account-resolution services | `importParser.test.js`, `importAccounts.test.js`, `importReview.test.jsx`, `pasteImport.test.jsx`, `dataTransfer.test.js`, `repositories.test.js`, `releaseBlockers.test.js` | Account lifecycle plus preview, mapping, invalid-row confirmation, edited-row skip, atomic failure, and retry outcomes are mapped. Native file-picker and wide-tablet preview acceptance are **UNVERIFIED**. |
| Tips/settings/categories | 4 | `SmartTipsScreen`, `StudentEatsScreen`, `SettingsScreen`, `ManageCategoriesScreen`; `SectionCard`, `Toggle`, `EmojiGrid` | `tips.test.js`, `smartTipsClient.test.js`, `eatsRanking.test.js`, `placesClient.test.js`, `preferences.test.js`, `responsiveAccessibility.test.jsx` | Offline tips, optional remote clients, persisted preferences, settings rows, and category management are mapped. Provider-backed and native tablet visual acceptance is **UNVERIFIED**. |
| Splash/app lock | 2 | `SplashScreen`, `AppLockScreen`; root-shell selection in `RootNavigator` and `routes.js` | `appLock.test.js`, `splashOnboarding.test.jsx`, `rootNavigationMode.test.js`, `preferences.test.js` | Splash, fail-closed preference loading, mutually exclusive locked/unlocked shells, PIN flow, and supported biometric fallback paths are mapped. Native biometric/device acceptance is **UNVERIFIED**. |
| **Total** | **52** | Six grouped implementation surfaces for each form factor | Group-level behavioral and static tests | **Six groups accounted for; individual mobile/tablet frames and per-frame parity remain UNVERIFIED.** |

## Route-oriented implementation inventory

The following compact inventory supersedes the older “complete screen parity” claim. It identifies reusable routes and stateful surfaces currently present in code:

1. `SplashScreen` and `OnboardingScreen`: first-run entry, resumable setup, back/skip, account creation or reuse, optional first expense, and optional lock setup.
2. `AppLockScreen`: four-digit PIN setup/unlock, cancel during setup, biometric affordance, and failure messaging.
3. `DashboardScreen`: safe-to-spend summary, quick actions, month summary, recent transactions, and expense/income entry actions.
4. `EntryScreen`: expense/income selection, category and account selection, decimal amount, note, explicit transaction date, and save-to-history behavior.
5. `HistoryScreen`, `TransactionDetailScreen`, and `EditTransactionScreen`: month/calendar selection, search and filters, detail, edit, delete, and recurring-origin date rules.
6. `BudgetsScreen`: monthly overview, budget cards, recurring navigation, and the category/limit sheet flow.
7. `RecurringScreen`: persisted recurring rules, reminders, frequency and lead-time controls, and add/edit flows.
8. `GoalsScreen`: goal progress, contributions, targets, optional deadlines, and goal-management sheets.
9. `SmartTipsScreen` and `StudentEatsScreen`: offline-first insights plus explicitly optional network-backed results.
10. `SettingsScreen`, `ManageCategoriesScreen`, and `ManageAccountsScreen`: persisted preferences, security and data tools, categories, account archive/revival, and balance-bearing account records.
11. `ImportScreen` and `PasteImportScreen`: CSV/XLSX preview and mapping, account resolution, durable duplicate reconciliation, backup restore, and one-step restore undo.

## Responsive and accessibility primitives

- [`ScreenContainer.jsx`](../src/components/ScreenContainer.jsx) uses safe-area edges, a single phone/tablet breakpoint, bounded content width, and scroll behavior. Phone content is capped at 540 units; tablet content is capped at 760 units. Wider windows reuse the tablet rule rather than introducing a desktop layout.
- [`BottomSheet.jsx`](../src/components/BottomSheet.jsx) caps sheets at 640 units and 90% height, uses keyboard avoidance, provides scrollable content, respects the bottom safe-area inset, and exposes an accessible dismiss action.
- [`tokens.js`](../src/theme/tokens.js) keeps primary controls at 56 units and establishes a 44-unit minimum touch-target token for other interactive controls.
- `EmojiGrid` choices and Settings rows use the minimum touch-target token. Static coverage is in `responsiveAccessibility.test.jsx`.
- Corrected light-theme amber text and expense colors are checked at WCAG AA text contrast thresholds by `responsiveAccessibility.test.jsx`. This is a token-level calculation, not a native screenshot audit.
- Roboto remains the shared screen font, while semantic palette, spacing, radius, typography, and sizing tokens prevent individual screens from creating divergent visual constants.

## Visual acceptance still required

Before claiming mobile/tablet parity, reconnect Figma and compare representative states from every group at the intended phone and tablet sizes. Then run native checks covering safe areas, long content, large text, screen-reader labels, keyboard-open forms and sheets, visible focus, error and success states, and biometric fallback. Record screenshots or device evidence against the exact Figma node IDs used; code presence, Jest output, and static token checks alone are insufficient.
