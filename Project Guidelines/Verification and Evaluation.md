# Verification and Evaluation

## Current implementation evidence (2026-10-03)

Executed on Windows with Node `v24.16.0` (the documented baseline is Node 22 LTS), npm `11.13.0`,
JDK 21, and the local desktop SQLite test driver:

| Check | Observation | Limit |
|---|---|---|
| `npm test -- --watch=false --runInBand` | **45/45 suites, 307/307 tests pass**; includes v4-to-v7 upgrades, archived-account preservation, onboard expense correction, source-key import reconciliation after edit, truthful file/paste outcomes, paste invalid/partial paths, restore one-shot undo and injected mid-transaction rollback | Native providers mocked; Jest is not device verification |
| `npx expo export --platform android --output-dir .expo/export-android-2026-10-03-final` | PASS; 1 Hermes Android bundle (5.69 MB), 20 asset entries | No Gradle APK or installed-device smoke test |
| `npm run android:check` and `npx expo-doctor` | PASS; local SDK/JDK 21 present, Expo Doctor 18/18; launcher warns Node 24 vs Node 22 baseline | Native build and device runtime unverified |
| `npm run test:stress -- docs/qa/2026-10-03/stress-final.json` | PASS; 1,829 operations/zero errors, 10,000 transactions, 100 budgets/rules, dashboard p95 **8.43 ms**, 32-writer p99 **2,621.75 ms**, integrity `ok` | File-backed desktop SQLite, not native SQLCipher or UI latency; full data in [stress-final.json](../docs/qa/2026-10-03/stress-final.json) |
| `npm audit --omit=dev` | **FAIL**; latest run reported 48 production-graph advisories (33 high, 15 moderate); an earlier run in the same session reported 46 | Advisory feed changes; `xlsx@0.20.3` is installed from an integrity-pinned vendor URL not comprehensively assessed by npm audit. No forced upgrades applied |
| `npm run emulator` | No connected ADB device or configured AVD on this workstation | Real phone/tablet, SQLCipher open/reopen, biometrics, notifications, accessibility and visual parity remain UNVERIFIED |
| `kilo mcp list` | Remote Figma requires authentication; desktop Figma endpoint is unavailable | Supplied 52-state-per-device inventory used as a group map, not independent per-frame inspection |

Requirement-to-check coverage: FR-09/10 use `monthChipCalendar.test.jsx`, `transactionEdit.test.js`,
`qaStoreFlows.test.jsx`; FR-11 uses `onboarding.test.js`, `onboardingScreen.test.jsx`,
`uiStoreOnboarding.test.js`, `splashOnboarding.test.jsx`, `rootNavigationMode.test.js`; FR-12 and
NFR-06 use `schema.test.js`, `repositories.test.js`, `importParser.test.js`, `importReview.test.jsx`,
`pasteImport.test.jsx`, `dataTransfer.test.js`, `qaPersistence.test.js`, and `qaStoreFlows.test.jsx`.
FR-13/NFR-07 have group-level source/static/component coverage in [Design Prototype](./Design%20Prototype.md),
not 104 verified frame comparisons. Production dependency remediation is a separate reviewed release gate;
do not use `npm audit fix --force` to downgrade Expo or arbitrarily replace the native stack.

## Historical QA evidence (2026-09-28)

See [QA Verification Report 2026-09-28](./QA%20Verification%20Report%202026-09-28.md) for evidence from that run: **32 suites / 199 tests passed without exclusions**, Expo Doctor **18/18**, Android JS export passed, and **1,829 local stress operations had zero errors**. The workload started with 10,000 rows, 100 budgets/rules, and reached 32 actual SQLite writers. Dashboard p95 was **15.19 ms**; writer p99 at concurrency 32 was **2,517.33 ms**. These were desktop SQLite observations, not native SQLCipher/device acceptance.

Native build/device E2E remains **UNVERIFIED** after Kotlin daemon failures and an isolated emulator system ANR. The production audit remains **24 advisories (18 moderate, 6 high)**. Older counts and parity assertions below are historical evidence and must not be used as current device acceptance. Machine-readable evidence is in [`docs/qa/2026-09-28/`](../docs/qa/2026-09-28/).

Updated: 2026-09-27

## Requirement-to-check matrix

| Requirement | Evidence | Result |
|---|---|---|
| Safe-to-Spend formula, shortfall, double-count prevention | `__tests__/safeToSpend.test.js`, `__tests__/e2eVerification.test.js` | Passed |
| Source-account preservation and explicit resolution | `__tests__/importAccounts.test.js`, `__tests__/importParser.test.js` | Passed |
| Atomic import and named account flow (Figma 16 & 16b) | `__tests__/e2eVerification.test.js`, `ImportScreen.jsx` | Passed |
| Named accounts and History filters | component/static UI tests | Passed |
| Optional lock and separate database key copy | `__tests__/appLock.test.js`, `AppLockScreen.jsx` | Passed |
| Fixed TIP QC with no location permission | Expo public config, generated manifest inspection, source review | Passed |
| 14-day new reminder default & notification scheduling | `__tests__/remindersScheduling.test.js`, `__tests__/emojiAndDueDate.test.js` | Passed |
| Figma parity for all 22 frames (`MoneyMap — Update 092726`) | `__tests__/uiFidelityStatic.test.js`, full screen inspection | Passed |
| End-to-end functionality across all backend pipelines | `__tests__/e2eVerification.test.js` (11 integration checks) | Passed |

## Executed test suites (all passing)

| Test suite | Tests | Domain / Feature covered | Result |
|---|---|---|---|
| `__tests__/e2eVerification.test.js` | 11 | End-to-end integration: money precision, budget calculations, recurring reminders, savings goals, CSV/XLSX import and account resolution, offline tips, student eats ranking | Passed |
| `__tests__/uiFidelityStatic.test.js` | 2 | Static token enforcement: zero hex literals across all 37 UI files; remote fetch isolation | Passed |
| `__tests__/uiComponents.test.jsx` | 14 | Reusable UI components: Buttons, Chips, Toggles, ProgressBar, SafeToSpendCard, TransactionRow | Passed |
| `__tests__/safeToSpend.test.js` | 8 | Safe-to-Spend state transitions, commitment deductions, headroom calculations | Passed |
| `__tests__/financeView.test.js` | 12 | Dashboard totals, budget cards, spending by category, history grouping, recurring bill formatting | Passed |
| `__tests__/goals.test.js` | 6 | Savings goals progress, completion calculation, contribution overflow, deadline sorting | Passed |
| `__tests__/importParser.test.js` | 10 | CSV & XLSX parsing, column auto-mapping detection, malformed row skips | Passed |
| `__tests__/importAccounts.test.js` | 5 | Source account extraction, automatic resolution, unresolved account identification | Passed |
| `__tests__/repositories.test.js` | 15 | SQLCipher repository CRUD: Accounts, Categories, Transactions, Budgets, RecurringRules, Goals | Passed |
| `__tests__/schema.test.js` | 4 | Database table creation, column integrity, initial migration execution | Passed |
| `__tests__/keyManager.test.js` | 4 | SecureStore key generation, retrieval, and separate encryption verifier storage | Passed |
| `__tests__/appLock.test.js` | 8 | PIN verification, lockout cooldown calculation, free attempts thresholds | Passed |
| `__tests__/remindersScheduling.test.js` | 6 | Expo Notifications scheduling for recurring bills, lead time calculation | Passed |
| `__tests__/recurringCatchUp.test.js` | 6 | Catch-up planning for past due recurring rules, anchor day advancement | Passed |
| `__tests__/dataTransfer.test.js` | 6 | CSV export serialization, JSON backup creation, and atomic restore verification | Passed |
| `__tests__/smartTipsClient.test.js` | 4 | Google Gemini API request sanitization, privacy anonymization, error handling | Passed |
| `__tests__/tips.test.js` | 8 | Offline heuristic rules: daily allowance, food pace, small repeats, period comparison | Passed |
| `__tests__/placesClient.test.js` | 5 | Overpass API querying with Nominatim fallback for student food spots | Passed |
| `__tests__/eatsRanking.test.js` | 6 | Haversine distance, price level inference, student heuristic scoring, ranking | Passed |
| `__tests__/preferences.test.js` | 5 | User preference store persistence, currency symbol selection, theme preference | Passed |
| `__tests__/theme.test.js` | 4 | Color token consistency, light/dark mode contrast compliance | Passed |
| `__tests__/qaRegressions.test.js` | 10 | QA audit regressions: "Other" category double-count, safe-to-spend floor, lockout cooldown | Passed |
| `__tests__/money.test.js` | 5 | Minor unit currency conversion, decimal formatting, input normalization | Passed |
| `__tests__/entityGuards.test.js` | 8 | Type guards and validation asserts for domain entities | Passed |
| `__tests__/emojiAndDueDate.test.js` | 6 | Budget & bill emoji presets, default due date calculation | Passed |
| `__tests__/androidSecureScreenPlugin.test.js` | 1 | Expo config plugin: FLAG_SECURE on Android | Passed |
| `__tests__/androidOpenSslPackagingPlugin.test.js` | 1 | Expo config plugin: OpenSSL packaging options for SQLCipher | Passed |

**Total Test Coverage**: 27 test suites passed, 165 total tests passed, 0 failures, 0 snapshots.

## Figma prototype audit & parity verification

- **Source File**: `JeEeOG1jZ0B72pA8gf7fMk`, page `MoneyMap — Update 092726` (Node ID `75:172`).
- **All 22 Canvas Frames Verified**:
  - `01 Splash`: Implemented with brand icon, subtitle, 56px CTA button, security footnote, and first-launch state persistence (`SplashScreen.jsx`).
  - `02 App Lock`: Implemented with "MoneyMap" branding, 4-digit PIN indicator dots, numeric keypad, and "Cancel setup" button (`AppLockScreen.jsx`).
  - `03 Dashboard`: Safe-to-Spend, quick action tiles, budget overview, recent transactions, FAB (`DashboardScreen.jsx`).
  - `04 Add Transaction — Expense` & `05 Add Transaction — Income`: Category grid, account selector, keypad, note input (`EntryScreen.jsx`).
  - `06 History`: Month selector, search, filters, income/expense breakdown, transaction cards (`HistoryScreen.jsx`).
  - `07 Budgets`: Overall budget progress bar, Bills row link, category cards (`BudgetsScreen.jsx`).
  - `08 Add Budget` & `08b Add Budget — Set Limit`: 2-step bottom sheet modal with grabber bar, category input, 18-icon `EmojiGrid`, limit amount input (`BudgetsScreen.jsx`).
  - `09 Recurring & Reminders` & `09b Add Recurring Bill`: Active reminder card, bills list, bottom sheet modal with name, amount, due date, frequency/reminder chips, and `EmojiGrid` (`RecurringScreen.jsx`).
  - `10 Savings Goals` & `10b Add Savings Goal`: Goal cards with progress bars and contribute dialog, bottom sheet modal with name, target, deadline, and `EmojiGrid` (`GoalsScreen.jsx`).
  - `11 Smart Tips`: Offline heuristics + opt-in Gemini tips (`SmartTipsScreen.jsx`).
  - `12 Student Eats`: Near TIP Quezon City food spots, price filters, distance, ranking (`StudentEatsScreen.jsx`).
  - `13 Settings`: Security, Data, Preferences, Smart Features sections with row dividers and Splash replay (`SettingsScreen.jsx`).
  - `14 Manage Categories` & `15 Manage Accounts`: Complete custom category and account management.
  - `16 Import Data` & `16b Import Data — Resolve Accounts`: PreviewTable (Date, Amount, Type), mapping card with cycling pills, ReadyBanner, and account resolution flow with atomic transaction confirmation (`ImportScreen.jsx`).
- **Design Tokens**: All screens strictly consume `src/theme/tokens.js`. No raw `#hex` values exist in any UI component or screen file.

## Repository cleanup audit (2026-09-28)

Scope: root config/entry/docs, `AI Skills/`, `Project Guidelines/`, `docs/` and screenshot evidence, `src/`, `assets/`, `plugins/`, `scripts/`, `__tests__/`, local IDE/agent metadata, and ignored generated directories. There were 277 tracked paths at inspection. The two root documentation deletions and their untracked copies under `Project Guidelines/` existed before this cleanup; preserve those copies when staging future work. No application logic, database schema, migration, asset, package, or endpoint was modified by this cleanup.

| Check | Executed observation | Status / limit |
|---|---|---|
| `git status --short --untracked-files=all`, `git ls-files`, `.gitignore` and targeted reference scans | Traced root documentation relocations, protected uncommitted edits, published README/root-page links and the import-free deprecated `src/screens/fixtures.js` stub | PASS for scoped inventory; no blanket deletion of ignored or user-owned state |
| `npm ls --depth=0` | All installed direct dependencies resolved without missing/invalid package reports | PASS for local dependency graph, not a security audit |
| `npm test -- --watch=false` | 27 suites / 167 tests passed; one test in the pre-existing untracked `__tests__/storeIntegration.test.js` failed because `TestSqliteDatabase.transaction` attempted nested `BEGIN IMMEDIATE` | FAIL at baseline, before any cleanup edit; the unrelated test and data paths were not changed |
| `npm test -- --watch=false --testPathIgnorePatterns=storeIntegration.test.js` | 27 suites / 165 tests passed after the documentation-only cleanup | PASS for tracked tests, explicitly excluding the baseline failure |
| `npx expo export --platform android` | Metro bundled 1,556 modules and produced an Android Hermes bundle with referenced assets | PASS for static import and bundling, not a native device/Gradle smoke test |
| `npm run build:readme-page` | Regenerated `docs/index.html` from the repaired `README.md`; resulting diff contains only the two expected URL/text updates | PASS for generated documentation mirror |
| `git diff --check` | Flagged trailing whitespace in already-modified `AGENTS.md`, `AIO.md`, and `Project-Operating-Directives.md` revision lines; none in cleanup edits | FAIL for whole worktree (pre-existing), PASS for cleanup-specific whitespace by diff inspection |

Potential deletion: `src/screens/fixtures.js` is an empty deprecated export and has no active imports in scoped text search, but file removal failed in the patch tool, so it remains. Generated `coverage/`, `dist/`, `.expo/`, `android/`, and `node_modules/` are ignored and were not deleted; `.kilo/worktrees/` is managed session state, not a disposable repository duplicate. The root `.nojekyll` and `docs/.nojekyll` have different possible GitHub Pages publication roots, and the screenshot ZIP is linked from the setup guide. No further relocation is justified without a concrete reference/ownership check.

## Android Studio launcher verification (2026-10-01)

| Check | Executed observation | Status / limit |
|---|---|---|
| `node --check scripts/run-android.mjs` | Cross-platform launcher parsed without syntax errors | PASS |
| `npm run test:android-launcher` | 3/3 tests passed for Gradle path decoding plus Windows, macOS, and Linux SDK/JDK candidate generation | PASS for path-resolution logic; not three physical hosts |
| `npm run android:check` | Located the Windows Android SDK, JDK 21 MoneyMap toolchain, and project-local Expo CLI; warned that the active Node runtime is 24 instead of the documented Node 22 baseline | PASS for non-destructive Windows preflight |
| `.idea/runConfigurations/*.xml` parse and command audit | All three shared configurations use the bundled `ShConfigurationType`, `node` interpreter, and project-relative scripts; no `/bin/bash`, NVM initialization, username, or `.moneymap-env.sh` reference remains | PASS for structure and current-workstation inspection; physical macOS/Linux IDE launch remains unverified |
| `npm test -- --watch=false` | 37/37 suites and 232/232 tests passed after the run-configuration and comment changes | PASS for automated JavaScript regression coverage |
| `npm run build:readme-page` | Regenerated `docs/index.html` from the updated Android Studio setup instructions | PASS |

The native Gradle build and device launch remain **UNVERIFIED** in this launcher preflight. Run the shared Android configuration with Node 22, a started device/AVD, and the target host's Android Studio installation before treating native execution as accepted.
