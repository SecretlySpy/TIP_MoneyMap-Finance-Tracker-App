# Decisions and Handover

## Android Studio run-configuration handover (2026-10-01)

The three checked-in Android Studio actions now use the bundled Shell Script runner with `node` as their interpreter instead of a Bash command that sourced `/home/kakashi70-0/.moneymap-env.sh`. The Android action executes the commented `scripts/run-android.mjs` launcher, which discovers supported Android SDK and JDK locations for Windows, macOS, and Linux without changing the user's shell profile. This does not require Android Studio's optional JavaScript/npm plugin. The safe `npm run android:check` preflight and 3 platform-resolution tests pass on the current Windows checkout. A real Gradle/device launch and physical macOS/Linux IDE execution remain **UNVERIFIED**; run them under the documented Node 22/JDK 21 baseline before native acceptance.

## QA handover (2026-09-28)

Current source is based on `21d0efb`, with uncommitted QA fixes and evidence. **199 tests / 32 suites pass**, Expo Doctor is **18/18**, Android JS export passes, and **1,829 synthetic stress operations have zero errors**. Confirmed corrections cover transaction composition, concurrent goal/recurring writes, partial recurring failure, corrupt/unsafe restore, places fallback deadline, Smart Tips payload validation, aggregation cost, and five compatible SDK patch versions. The schema and existing IDs remain unchanged.

Current owner/evidence: [QA Verification Report](./QA%20Verification%20Report%202026-09-28.md) and [`docs/qa/2026-09-28/`](../docs/qa/2026-09-28/). Reproduce with `npm test`, `npm run test:stress`, Expo Doctor, and Android export. Native build/device checks remain **UNVERIFIED**: Kotlin daemon failures, missing SDK build tools, old APK package mismatch and emulator system ANR. QA helpers were stopped; no production data was touched. Production audit still has 24 advisories, including vulnerable `xlsx`; a maintained parser decision and fresh native verification are the next release requirements. Preserve these notes and the GitHub sensitive-information rule; no staging/push was performed.

Updated: 2026-09-27  
Baseline: `main` / `origin/main` at `fe14d83bb5aeb4c5b4ecb499a6c79c1b3f34139d`

## Approved decisions

| ID | Decision | Trade-off |
|---|---|---|
| D-01 | Safe to Spend = budget headroom − unposted in-month recurring expenses − monthly deadline-goal contribution; floor display at zero and show shortfall | Conservative without reserving an entire goal target |
| D-02 | Preserve import account labels; require existing or named-new resolution; commit atomically | Adds one step, prevents silent Cash coercion |
| D-03 | App Lock is optional; PIN gates access only; SQLCipher key remains separate | No forgot-PIN recovery was added |
| D-04 | Student Eats uses fixed TIP QC; no GPS/package/permission | Results are campus-relative, not user-relative |
| D-05 | Successful save/import opens History; failures stay in context | Clear confirmation without hiding errors |
| D-06 | New recurring reminders default to 14 days; existing values remain | No migration rewrite |
| D-07 | Approved Figma sample values/categories are canonical | Keeps implementation and prototype comparable |
| D-08 | Implement reusable `BottomSheet.jsx` and `EmojiGrid.jsx` to match Figma 08b, 09b, 10b, 16b sheets | Replaces fragmented multi-prompt alert dialogs with accessible, modern modal sheets |
| D-09 | Add onboarding `SplashScreen.jsx` gated on first launch via SecureStore, replayable via Settings | Matches Figma 01 Splash without blocking returning users |
| D-10 | Align Import flow into two dedicated views: 16 (PreviewTable + Column Mapping) and 16b (PreviewTable + Account Resolution) | Matches Figma 16 & 16b interactive UX with 100% visual parity |

## Delivered

- **Figma Parity Across All 22 Frames (`MoneyMap — Update 092726`)**:
  - `01 Splash`: New `SplashScreen.jsx` with brand mark, subtitle, 56px CTA, security note, first-launch persistence, and Settings replay route.
  - `02 App Lock`: Reconciled `AppLockScreen.jsx` with "MoneyMap" branding, 4-digit PIN indicator dots, and "Cancel setup" action.
  - `08 Add Budget` & `08b Add Budget — Set Limit`: 2-step `BottomSheet` modal in `BudgetsScreen.jsx` with category name input, 18-icon `EmojiGrid`, and limit input.
  - `09b Add Recurring Bill`: `BottomSheet` modal in `RecurringScreen.jsx` with bill name, amount, due date, frequency/reminder chips, and 18-icon `EmojiGrid`.
  - `10b Add Savings Goal`: `BottomSheet` modal in `GoalsScreen.jsx` with goal name, target amount, deadline date, and 18-icon `EmojiGrid`.
  - `16 Import Data` & `16b Import Data — Resolve Accounts`: Refactored `ImportScreen.jsx` with PreviewTable (Date, Amount, Type), interactive MappingCard with column cycling pills, ReadyBanner, and account resolution flow with atomic transaction confirmation.
  - `13 Settings`: Added subtle hairline divider lines between card rows matching Figma.
- **Component Library**:
  - `src/components/BottomSheet.jsx`: Native modal bottom sheet with transparent scrim, top grabber bar (44x5px, radius 999), surface background, top-rounded corners, and keyboard avoidance.
  - `src/components/EmojiGrid.jsx`: 3x6 grid rendering the exact 18 curated emoji presets from Figma (`🍜, 🚌, 📚, 📱, 🛍️, 🎮, 🧾, 🏠, 🌐, 💧, 💡, 🎓, 💼, 💵, 📦, ☕, 🎬, 💊`) with selection highlights.
- **Backend & Algorithmic Integrity**:
  - Added `__tests__/e2eVerification.test.js` covering all 7 core backend features and integration pipelines.
  - All 27 test suites passed (165/165 tests, 0 failures).
  - Static token enforcement passes with zero hardcoded hex literals across all 37 UI files.

## Risks and open work

| ID | Risk | Likelihood | Impact | Early signal | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-01 | `xlsx@0.18.5` advisories affect user-supplied files | Med | High | Crafted workbook/parser advisory | Evaluate a maintained replacement in a separate dependency change | Unassigned | Open |
| R-02 | Repeat imports duplicate transactions | Med | Med | Same rows appear twice | Keep warning in ReadyBanner; design a stable import fingerprint | Unassigned | Accepted |
| R-03 | Native behavior differs from static/Jest evidence | Med | High | APK/device failure | Re-run under Node 22/JDK 21 and execute device matrix | Unassigned | Open |
| R-04 | Expo patch drift persists | Low | Med | Expo Doctor 17/18 | Review and update the five packages together, then rerun all checks | Unassigned | Open |
| R-05 | Campus-relative Student Eats surprises remote users | Med | Low | “Near me” interpreted literally | Keep explicit TIP QC origin copy | Unassigned | Accepted |

## Resume instructions

1. Preserve the user's pre-existing `.vscode/settings.json` change.
2. Review `git diff` and the decisions above.
3. Run `npm test` (all 27 test suites pass).
4. Run `npx expo export --platform android` to verify compilation bundle.
