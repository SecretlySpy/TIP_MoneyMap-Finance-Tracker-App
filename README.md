# MoneyMap Finance Tracker

An Android-first, offline-first personal finance tracker for **students**, built with React Native and Expo (JavaScript).

**Live docs (GitHub Pages):** https://secretlyspy.github.io/TIP_MoneyMap-Finance-Tracker-App/

The Pages site is the polished setup guide: root [`index.html`](./index.html) (self-contained HTML, OS tabs, SVG app previews, troubleshooting). A static README mirror is also generated at [`docs/index.html`](./docs/index.html) via `npm run build:readme-page`.

## Status

| Area | State |
|---|---|
| Tasks 1–9 core product | Done |
| Task 10 recurring catch-up | Done |
| Task 11 bill reminders (local notifications) | Done |
| Task 12 CSV export + backup | Done — file-based share; backup now includes savings goals (QA 2026-08-31) |
| Task 13 CSV + Excel import | Done |
| Task 14 app lock (PIN + biometrics) | Done — with attempt lockout; **no forgot-PIN recovery** |
| Task 15 Smart Tips offline rules | Done |
| Task 16 Smart Tips online Gemini (opt-in) | Done |
| Task 17 polish | Done |
| Task 18 release prep docs | Done (EAS project ID still placeholder until `eas init`) |
| Dark-mode theme consistency | Done (`useTheme` reads `themePreference`) |
| Student Eats Near Me | Done (Overpass/Nominatim + ranking + optional AI) |
| Settings pickers + Dashboard polish | Done (theme/currency chips, empties, tips teaser) |
| Safe-to-Spend + Savings Goals | Done (pure calc + schema v2 + Goals screen); goal deadlines added |
| Entry quick chips + MoM trend | Done |

**v0.1.0** — Core complete + Student Eats + Goals / Safe-to-Spend.

### Current limits (reviewed 2026-10-03)

The current verification matrix is in [Verification and Evaluation.md](./Project%20Guidelines/Verification%20and%20Evaluation.md).
"Done" above describes implemented code, not a verified native release. Transaction backdating,
edit/delete, History search, and retry-safe imports are now implemented and covered by Jest/desktop
SQLite; live Figma and Android device acceptance remain separate.

| Gap | Impact |
|---|---|
| Native SQLCipher key/storage, PIN/biometric and notification lifecycles, phone/tablet layout and accessibility | No connected device or configured AVD on this workstation; native acceptance is **UNVERIFIED** |
| Current 52 mobile + 52 tablet state frames | Figma connector requires authentication; six feature groups are mapped to code, individual visual parity is **UNVERIFIED** |
| Dependency advisories | `npm audit --omit=dev` reported 48 advisories (33 high, 15 moderate) on its latest run. `xlsx@0.20.3` is integrity-pinned from the vendor CDN; audit coverage of this tarball is incomplete. Review compatible updates before release |
| Account transfers, budget rollover, and "delete all data" reset | Still outside the current product scope; imported rows edited since an earlier import are reported as skipped rather than overwritten |

The Jest suite covers domain, data-transfer, store, component, and static UI contracts. Native
device behavior still requires the Android verification path below.

## Quick start

1. Install **Node.js 22 LTS**, **JDK 21**, Android SDK (API 35 recommended).
2. `npm ci`
3. Copy `.env.example` → `.env` (optional `GEMINI_API_KEY` for online tips).
4. `npm test` (45 suites, 307 tests verified on 2026-10-03)
5. Start an emulator/device, then `npm run android` (dev client required — **Expo Go unsupported** because of SQLCipher).

### Android Studio run button

The shared **MoneyMap: Run on Android** configuration uses Android Studio's bundled Shell Script runner with `node` as the interpreter. It executes the project-owned `scripts/run-android.mjs` launcher directly, without Bash, `~/.moneymap-env.sh`, an optional npm plugin, or a developer-specific home path.

1. Install Node 22 LTS and confirm `node --version` works in Android Studio's built-in terminal. If Node is managed by NVM on macOS/Linux, start Android Studio from a terminal after `nvm use 22`, or otherwise expose a stable `node` executable to GUI applications.
2. Open **Run → Edit Configurations**, select **MoneyMap: Run on Android**, and verify that its interpreter is `node` and its script is `scripts/run-android.mjs`.
3. Run `npm run android:check` once. It reports the selected Android SDK, compatible JDK, and local Expo CLI without starting an emulator or build.
4. Start an Android device or AVD, select **MoneyMap: Run on Android**, and press the green Run button.

The launcher discovers standard SDK/JDK locations on Windows, macOS, and Linux. Explicit `ANDROID_SDK_ROOT`, `ANDROID_HOME`, `MONEYMAP_JAVA_HOME`, and compatible `JAVA_HOME` values take priority.

Full walkthrough (Windows / macOS / Linux): **[index.html](./index.html)** or the [live Pages site](https://secretlyspy.github.io/TIP_MoneyMap-Finance-Tracker-App/). Also see [Tech Stack Setup Guide.md](./Project%20Guidelines/Tech%20Stack%20Setup%20Guide.md) and [docs/local-environment-audit-linux.md](./docs/local-environment-audit-linux.md).

## Architecture (short)

- Screens → Zustand stores → repositories → SQLCipher
- Money is always **integer minor units** (`src/domain/services/money.js`)
- Theme tokens only (`src/theme/tokens.js`) — no hardcoded hex in screens
- Bare `useTheme()` reads `themePreference` from `uiStore` (shared components stay dark-mode correct)
- Outbound HTTPS only from `src/remote/*` (`smartTipsClient`, `placesClient`, `eatsTipsClient`)

## Smart Tips privacy

- Default **off**. First enable shows a consent sheet.
- Offline: `deriveSmartTips` from local budgets/transactions.
- Online: anonymized summary only (period, totals, category ratios, currency) to Gemini.
- Never: raw transactions, notes, account names/IDs.

## Student Eats Near Me

- Dashboard → **Student Eats**; searches use the fixed TIP Quezon City campus origin and request no location permission.
- Places via Overpass (Nominatim fallback); ranked by distance + price + rating + student heuristics.
- Mini-map is on-device relative plot (no map SDK).
- Origin: TIP Quezon City campus. The app does not read or persist device coordinates.
- Optional AI tips reuse Smart Tips consent; payload uses distance **bands** only (no lat/lon).

## Release

- Package: `com.moneymap.financetracker`
- Privacy: [docs/privacy-policy.md](./docs/privacy-policy.md)
- Play Data safety: [docs/play-data-safety.md](./docs/play-data-safety.md)
- Checklist: [docs/release-checklist.md](./docs/release-checklist.md)

Replace the all-zero EAS `projectId` after `eas init` before cloud builds.
