# MoneyMap Finance Tracker

An Android-first, offline-first personal finance tracker for students, built with React Native and Expo.

## Current milestone

Tasks 1–9 and 12 are complete, plus partial work on later milestones. MoneyMap has the Expo development-build shell, encrypted SQLCipher database, repositories, live screens on real data, CSV export/backup/import, and PIN app lock. **Task 14 (biometrics)** is complete: `expo-local-authentication` is installed, wired through `appLock.js` / `AppLockScreen`, and gated by `appLockEnabled` + stored PIN (biometric failure falls back to PIN).
**Task 10 (recurring catch-up)** is complete: pure planner + `runRecurringCatchUp` posts due rules exactly once per period (multi-period and month-boundary safe), runs on app open after DB init, and registers an `expo-background-task` worker.
**Task 11 (bill reminders)** is complete: local `expo-notifications` schedules per active rule (lead days before `nextRun`), resyncs on toggle/CRUD/catch-up, prompts for `POST_NOTIFICATIONS` only when enabling reminders, deep-links taps to Recurring, and degrades gracefully when permission is denied.
**Task 13 (Excel import)** is complete: CSV and `.xlsx` share one grid → column-map → validate → transactional bulk-insert pipeline; bad rows are skipped and reported; missing categories/accounts are auto-created.

The approved Figma UI has also been reproduced as a fixture-driven visual integration layer: dashboard, transaction entry, history and empty history, budgets, settings, dark dashboard, app lock, recurring reminders, and Smart Tips. This does **not** mark later functional tasks complete—database writes, persistent settings, notifications, biometrics, imports, and Smart Tips networking remain governed by the strict dependency order. See [the UI fidelity implementation record](./docs/ui-fidelity-implementation.md) and [local environment audit](./docs/local-environment-audit.md).

Task 3 remains the next functional milestone: repository change subscriptions and persistent Zustand-backed settings, followed by feature-by-feature replacement of visual fixtures.

## Quick start

1. Install Node.js 22 LTS, JDK 21, and the Android SDK with an API 35 Google APIs x86_64 image.
2. Open the repository in Visual Studio Code and accept the recommended **React Native Tools** extension.
3. Run `npm ci` (or `npm install`) and `npm test`.
4. Press `Ctrl+Shift+B` or choose **Terminal → Run Build Task → MoneyMap: Run on Android emulator**.
5. The task opens the official Google Android Emulator, starts Metro, builds and installs the dev client, and opens MoneyMap. It never selects BlueStacks.
6. On the development client's first launch only, select **Continue**, then close the developer menu to reveal the Dashboard.
7. Replace the placeholder EAS project ID in `app.json` after running `eas init`.

Use **MoneyMap: Quick launch installed build** after JavaScript-only changes, **MoneyMap: Android environment status** for diagnostics, and **MoneyMap: Stop Android emulator** for a graceful shutdown. The emulator display is a native window beside VS Code; tasks and the Hermes debugger are integrated into the editor. Expo Go is not supported because SQLCipher is native.

See [Tech Stack Setup Guide.md](./Tech%20Stack%20Setup%20Guide.md) for full platform-specific instructions.
