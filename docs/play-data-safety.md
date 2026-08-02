# Google Play Data safety — MoneyMap checklist

Use this when filling Play Console. Match the live app behavior.

## Data collection

| Data type | Collected? | Shared? | Purpose | Notes |
|---|---|---|---|---|
| Financial info (transactions, budgets) | Yes (on device) | No (to developer) | App functionality | SQLCipher on device only |
| Financial summary for tips | Only if Smart Tips on + consent | Yes → Google Gemini | App functionality | Anonymized ratios/totals only |
| App interactions / diagnostics | No | No | — | No analytics SDK |
| Personal identifiers / account | No | No | — | No user accounts |
| Location | No | No | — | — |
| Contacts / photos | No | No | — | Import is user-picked files |

## Security practices

- [x] Data encrypted in transit (HTTPS for optional Gemini)
- [x] Data encrypted at rest (SQLCipher + SecureStore key)
- [x] Users can request deletion by uninstalling / clearing app data
- [x] Independent security review: not claimed unless performed

## Optional features

- Smart Tips: declare as optional, user-controlled
- Notifications: local only; not used for advertising

## Privacy policy URL

Host `docs/privacy-policy.md` (or exported HTML) at a public URL before production release and link it in Play Console and the store listing.
