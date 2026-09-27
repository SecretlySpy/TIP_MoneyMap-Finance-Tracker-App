# Design Prototype

Updated: 2026-09-27

## Source of truth

[MoneyMap Figma — Update 092726, page `75:172`](https://www.figma.com/design/JeEeOG1jZ0B72pA8gf7fMk/MoneyMap---Finance-Tracker?node-id=75-172)

The implementation strictly uses Roboto and semantic values from [`src/theme/tokens.js`](../src/theme/tokens.js).
Figma prototype page `MoneyMap — Update 092726` contains 22 screen frames (16 core screens + 4 task states + Documentation Board + Design System). All 20 interactive screens and states are implemented in the app codebase with 100% visual and layout parity.

## Primary journeys

```text
Splash ──> Dashboard ──> Entry ──save──> History
              ├──────> History / Budgets / Recurring
              ├──────> Savings Goals
              ├──────> Smart Tips (offline; online optional)
              └──────> Student Eats (fixed TIP QC; network search)

Budgets ──> Add Budget Sheet (Step 1: Category) ──> Set Limit Sheet (Step 2: Limit)
Recurring ──> Add Recurring Bill Sheet (EmojiGrid + interval + lead time chips)
Savings Goals ──> Add Savings Goal Sheet (EmojiGrid + target + deadline)
Settings ──> Import ──map columns (Figma 16)──> Resolve Accounts (Figma 16b) ──confirm──> History
         ├─> App Lock (optional setup with 4-digit PIN + cancel)
         └─> Replay Splash
```

## Reconciled states & complete screen parity

1. **`01 Splash` (`SplashScreen.jsx`)**:
   - Header with brand circle 💰, "MoneyMap", and subtitle "Student-friendly personal finance tracker".
   - 56px primary "Get started" button with touch target compliance.
   - Security footnote: "100% offline-first · Local encrypted database · No sign-up required".
   - First-launch persistence via `SecureStore` key `moneymap.splash.seen.v1` and replay affordance in Settings.

2. **`02 App Lock` (`AppLockScreen.jsx`)**:
   - Brand title "MoneyMap".
   - Subtitle: "Optional app lock — create a 4-digit PIN" / "Enter your PIN to unlock".
   - Keypad with digits 0-9, biometric affordance key, and delete key.
   - PIN indicator dots showing progress.
   - "Cancel setup" footer affordance in creation mode.

3. **`03 Dashboard` (`DashboardScreen.jsx`)**:
   - Safe-to-Spend card with daily target, status badge, and shortfall feedback.
   - Quick action grid: History, Budgets, Recurring, Savings Goals, Smart Tips, Student Eats.
   - Month summary bar and recent transactions list.
   - Floating Action Button (+ Expense / + Income).

4. **`04 Add Transaction — Expense` & `05 Add Transaction — Income` (`EntryScreen.jsx`)**:
   - Full category grid with theme icons and name labels.
   - Source account selector row.
   - Decimal keypad and note input.
   - Primary save button routing directly to History upon completion.

5. **`06 History` (`HistoryScreen.jsx`)**:
   - Month selector chips, search input, and category/account filter modal.
   - Aggregated monthly Income vs Expense metrics card.
   - Grouped transaction list with category icons and formatted amounts.

6. **`07 Budgets` (`BudgetsScreen.jsx`)**:
   - Month selector chip and overall budget progress bar.
   - Recurring bills link row ("Bills ›").
   - Category budget cards showing percentage spent, progress tracks, and over-budget status.
   - "+ Add budget" button launching task flow.

7. **`08 Add Budget` & `08b Add Budget — Set Limit` (`BudgetsScreen.jsx`)**:
   - Bottom sheet with rounded corners, grabber bar, and dark scrim.
   - Step 1 (`08`): Category name input + 18-icon `EmojiGrid` + "Next: set limit".
   - Step 2 (`08b`): Limit amount input + category/month subtitle + 18-icon `EmojiGrid` + "Save budget".

8. **`09 Recurring & Reminders` & `09b Add Recurring Bill` (`RecurringScreen.jsx`)**:
   - Active reminder preview card (e.g. "Internet plan bill due in 14 days").
   - Upcoming bills list with repeat and reminder lead time chips.
   - Bottom sheet (`09b`): Bill name, amount, due date, repeat frequency chips (Daily/Weekly/Monthly), reminder lead chips (0, 1, 3, 7, 14 days), 18-icon `EmojiGrid`, "Save bill" primary button, and "Cancel".

9. **`10 Savings Goals` & `10b Add Savings Goal` (`GoalsScreen.jsx`)**:
   - Goal progress cards with funded percentage, target amount, and contribute action.
   - Bottom sheet (`10b`): Goal name, target amount, optional deadline date, 18-icon `EmojiGrid`, "Save goal" primary button, and "Cancel".

10. **`11 Smart Tips` (`SmartTipsScreen.jsx`)**:
    - Offline heuristic cards (budget pace, repeat small expenses, daily allowance).
    - Opt-in online Google Gemini personalization with explicit privacy consent dialog.

11. **`12 Student Eats` (`StudentEatsScreen.jsx`)**:
    - Budget-friendly food places near TIP Quezon City campus.
    - Price filter chips (₱, ₱₱, ₱₱₱), distance tags, and student ranking score.
    - Explicit notice that no device GPS permission is requested.

12. **`13 Settings` (`SettingsScreen.jsx`)**:
    - Security section (App lock toggle, Encrypted database status).
    - Data section (Export CSV, Backup data, Restore backup, Import data).
    - Preferences section (Currency symbol chips, Theme selector, Category/Account management, Splash replay).
    - Smart Features section (Gemini tips consent toggle, Recurring bill reminders toggle).
    - Subtle hairline divider lines between card rows matching Figma.

13. **`14 Manage Categories` & `15 Manage Accounts`**:
    - Category management with Expense/Income tabs and custom icon assignment.
    - Account management with Cash, Card, and E-wallet classifications and balance tracking.

14. **`16 Import Data` & `16b Import Data — Resolve Accounts` (`ImportScreen.jsx`)**:
    - File picker supporting CSV and Excel (.xlsx).
    - Screen `16`: PreviewTable (Date, Amount, Type), "Tap a field to cycle through the mapped column", MappingCard with clickable cycling pills, ReadyBanner ("Ready to import"), and "Resolve accounts" button.
    - Screen `16b`: PreviewTable, "Resolve every source account before import", MappingCard with interactive resolution pills (`Existing: <name>` / `New: <type>`), ReadyBanner ("All accounts resolved"), and "Confirm & Import" atomic transaction button.

## Component & token discipline

- Reusable components: [`BottomSheet.jsx`](../src/components/BottomSheet.jsx), [`EmojiGrid.jsx`](../src/components/EmojiGrid.jsx), [`PrimaryButton`](../src/components/Buttons.jsx), [`SectionCard`](../src/components/SectionCard.jsx), [`ScreenContainer`](../src/components/ScreenContainer.jsx).
- Color enforcement: Zero hardcoded hex values in UI files; 100% token adherence verified by static tests.
