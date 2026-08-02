# MoneyMap release checklist (Task 18)

## Before EAS production build

1. **Package ID** — set in `app.json` / `app.config.js`  
   Current: `com.moneymap.financetracker` (replace `com.example.*`).
2. **EAS project** — run `npx eas-cli login` then `npx eas-cli init` and commit the real `extra.eas.projectId` (not all zeros).
3. **Secrets** — `eas secret:create --name GEMINI_API_KEY --value … --scope project` (optional Smart Tips). Never commit keys.
4. **Icon / splash** — `assets/splash-icon.png` referenced as icon + adaptive icon; regenerate with `npm run asset:splash` if branding changes.
5. **Privacy** — publish `docs/privacy-policy.md`; complete Play Data safety using `docs/play-data-safety.md`.
6. **Version** — bump `expo.version` and `android.versionCode`.

## Build commands

```bash
npm ci
npm test
npx expo-doctor
# Development APK
eas build --profile development --platform android
# Store AAB
eas build --profile production --platform android
```

## Verify install

1. Install APK/AAB on a clean device/emulator (API 26+).
2. Cold start &lt; ~2s on mid-range hardware after first open.
3. With Smart Tips **off**, confirm no outbound Gemini traffic (airplane mode still shows offline tips when enabled with consent).
4. Enable reminders → grant notifications → create recurring bill → confirm schedule.
5. Import sample CSV and XLSX; bad rows reported.
6. App lock PIN + biometric fallback.
7. Backup → wipe app data → restore.

## Out of scope (do not ship)

Bank sync, cloud ledger sync, multi-user, ads, analytics, FCM marketing push, TypeScript migration.
