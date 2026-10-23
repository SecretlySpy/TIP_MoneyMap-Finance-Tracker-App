# MoneyMap Privacy Policy

**Last updated:** 2026-10-23  
**App:** MoneyMap Finance Tracker  
**Audience:** Students (personal finance, single-device)

## Summary

MoneyMap is **offline-first**. Your financial records stay on your device. Optional network use is **Smart Tips** (budget suggestions after you turn the feature on and accept consent) and an optional **Student Eats** live refresh of campus food listings. Core finance and Student Eats listings remain available offline.

## Data we store on your device

- Accounts, categories, transactions, budgets, and recurring rules in an **encrypted SQLite (SQLCipher)** database
- App preferences (theme, currency symbol, reminder toggle, Smart Tips toggle/consent)
- Optional **PIN** (stored as a salted hash) and biometric unlock via the OS
- The SQLCipher database key in the platform secure store (Android Keystore)

We do **not** operate a MoneyMap account server. There is no cloud sync of your ledger in v1.

## Permissions

| Permission | Why |
|---|---|
| Internet | Optional Smart Tips (Gemini), optional Student Eats live refresh (OpenStreetMap Overpass/Nominatim), and optional AI meal tips. Core finance features and the bundled Student Eats catalog work offline. |
| Notifications | Local bill reminders only (not push/FCM marketing). |
| Biometric / fingerprint | Optional app unlock. |
| Location | **Not requested.** Student Eats ranks meals around the fixed TIP Quezon City campus origin. Device GPS is unused. |

## Student Eats Near Me

- Opened from the Dashboard. **No location permission is requested.**
- Core place data is a bundled TIP Quezon City campus catalog stored in the app. Optional live refresh uses OpenStreetMap Overpass, with Nominatim as a last online fallback.
- Ranking (distance, price level, rating, student heuristics) runs on-device.
- Optional AI meal tips use the same Smart Tips consent gate and send only an **anonymized** list (place names, distance bands like “near/walkable”, price levels, cuisine labels, optional daily food budget minor units). **Never** latitude/longitude.
- Device coordinates are never stored. Optional last-live place results may be saved in the encrypted local database so the screen still has a previous live snapshot after restart.

## Smart Tips (optional, opt-in)

- **Default:** off.
- **Offline:** tips are computed on-device from your budgets and transactions. Nothing is sent.
- **Online (after consent, configuration, and app verification):** MoneyMap may send a **minimized summary** through a stateless Google Cloud Run proxy to **Google Gemini**:
  - budget period (e.g. `YYYY-MM`)
  - remaining / limit / spent totals (integer minor units)
  - per-category **spend ratios** and category labels
  - currency symbol
- **Never sent:** raw transaction lists, notes/memos, account names or IDs, recurring-rule identifiers, contacts, or location.

Gemini credentials are stored server-side in Secret Manager. The backend requires a valid Firebase App Check token; there is no cloud ledger sync. Users should review Gemini Free Tier data-use terms before opting in with real financial summaries. If the device is offline, secure app verification is not set up, the request fails, or the model/quota is unavailable, MoneyMap falls back to offline tips. You will not see a broken empty state caused by network errors alone.

You can turn Smart Tips off at any time in Settings. Turning it off stops further network requests for tips.

## Local notifications

Recurring bill reminders are **local** schedules on your device. They are cancelled when you disable reminders. Tapping a reminder opens the Recurring screen inside the app.

## Backups and import/export

CSV export, JSON backup/restore, and CSV/Excel import are **user-initiated** and processed on-device. Files you share leave the device only through the system share sheet you choose (email, Drive, etc.). MoneyMap does not upload those files to a MoneyMap server.

## Children

MoneyMap is aimed at students and is not directed at children under 13. Do not use the app if you are not allowed to under local law.

## Data deletion

Uninstalling the app removes local app data on typical Android configurations. Encrypted backups you exported remain under your control until you delete those files.

## Play Data safety (declarative summary)

When completing Google Play’s Data safety form, declare:

- **Financial info** collected/processed **on device** (not shared with MoneyMap as a developer backend — there is none).
- **Optional** summary processed through Cloud Run and **Google Gemini** only if Smart Tips is enabled, consented, and authenticated app verification is configured: approximate budget summary / category ratios (not full transaction history).
- **Data encrypted in transit** for that optional API call (HTTPS).
- **Data encrypted at rest** on device (SQLCipher).
- Users can stop optional sharing by disabling Smart Tips.

## Contact

For privacy questions about this open-source student project, open an issue on the project repository associated with your distribution build.

## Changes

We may update this policy as features change. Material changes to optional network use will be reflected in-app consent copy and this document.
