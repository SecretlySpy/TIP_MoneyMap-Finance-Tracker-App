# MoneyMap Privacy Policy

**Last updated:** 2026-10-26  
**App:** MoneyMap Finance Tracker  
**Audience:** Students (personal finance, single-device)

## Summary

MoneyMap is **offline-first** for all core financial tracking, transactions, accounts, budgets, and reports. Your personal financial ledger always stays encrypted on your device.

Optional network features are unified under **Online Personalization** (which includes AI-powered Smart Tips and nearby Student Eats eatery discovery via Google Maps Platform). When Online Personalization is disabled, no AI or place discovery requests are made, and recommendations are hidden.

## Data we store on your device

- Accounts, categories, transactions, budgets, goals, and recurring rules in an **encrypted SQLite (SQLCipher)** database.
- App preferences (theme, currency symbol, reminder toggle, Online Personalization toggle/consent).
- Optional **PIN** (stored as a salted hash) and biometric unlock via the OS.
- The SQLCipher database key in the platform secure store (Android Keystore).

We do **not** operate a MoneyMap account server. There is no cloud sync of your raw financial ledger.

## Permissions

| Permission | Why |
|---|---|
| Internet | Optional Online Personalization: AI Smart Tips (Gemini via Cloud Run proxy) and Student Eats eatery discovery (Google Places via Cloud Run proxy + Google Maps tiles). Core finance functions remain 100% offline. |
| Location (`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`) | **Optional.** Used strictly in the foreground when the user explicitly requests nearby eatery discovery around their current location. If permission is denied or undetermined, discovery automatically defaults to the fixed TIP Quezon City campus origin. Location coordinates are never continuously tracked, never persisted, and never sent to Gemini. |
| Notifications | Local bill reminders only (not push/FCM marketing). |
| Biometric / fingerprint | Optional app unlock. |

## Student Eats Near Me

- Opened from the Dashboard.
- **Location:** If location permission is granted, searches around the user's current coordinates. If permission is denied or withheld, searches around the fixed TIP Quezon City campus reference origin.
- **Provider:** Real-time restaurant discovery is powered by the Google Places API (New) and rendered on native Google Maps.
- **Attribution & Compliance:** Follows Google Maps Platform Terms of Service: places content uses temporary in-memory session caching (10 minutes) and is never persisted into offline databases.
- **AI Recommendations:** Optional Gemini meal recommendations use the unified Online Personalization consent and send only an **anonymized** summary (place names, Place IDs, distance bands like “near/walkable”, price levels, primary types, and optional daily food budget minor units). **Never** latitude/longitude or raw financial records. Recommendations are strictly grounded in verified Google Places.

## Smart Tips (Online Personalization)

- **Default:** Off.
- **Online-Only:** When Online Personalization is enabled and consented, Smart Tips retrieves structured, grounded financial tips from Google Gemini via the secure Cloud Run AI proxy. No locally fabricated advice or offline recommendation cards are substituted.
- **Data Minimization:** MoneyMap sends only a **minimized, anonymized summary**:
  - budget period (e.g. `YYYY-MM`)
  - remaining / limit / spent totals (integer minor units, e.g. centavos)
  - per-category **spend ratios** and category labels
  - currency symbol
- **Never sent:** Raw transaction histories, notes/memos, account names, account IDs, recurring-rule identifiers, contacts, or location coordinates.

Gemini credentials are kept securely server-side in Google Secret Manager. The backend requires a valid Firebase App Check token. If the device is offline or the proxy is unavailable, an informative unavailable/retry state is displayed. Core budgets, accounts, balances, and ledger calculations remain fully operational offline.

You can disable Online Personalization at any time in Settings. Disabling it immediately clears and hides online recommendations and halts all optional AI/Places requests.

## Local notifications

Recurring bill reminders are **local** schedules on your device. They are cancelled when you disable reminders.

## Backups and import/export

CSV export, JSON backup/restore, and CSV/Excel import are **user-initiated** and processed on-device. Files leave the device only through the Android system share sheet you choose.

## Play Data safety (declarative summary)

When completing Google Play’s Data safety form, declare:

- **Financial info:** Processed on-device. Optional anonymized summary (ratios and budget totals, not full transaction history) transmitted via HTTPS only when Online Personalization is enabled and consented.
- **Location:** Optional approximate or precise location used for live nearby eatery search; not stored or shared with AI models.
- **Data encrypted in transit:** HTTPS with Firebase App Check.
- **Data encrypted at rest:** SQLCipher AES-256 on device.
- Users can disable optional online features at any time in Settings.
