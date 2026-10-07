# Backend Functionalities

Updated: 2026-10-07

## Status

MoneyMap's backend is an on-device service/repository layer over SQLCipher-configured SQLite. It has no
owned application server, server database, login, or sync API. This is an intentional privacy/offline
boundary—not an absent persistence architecture. Native at-rest behavior still requires installed-build
verification.

## Local service boundaries

| Use case | Boundary | Failure behavior |
|---|---|---|
| First-run onboarding | Root navigation → versioned SecureStore draft → finance/UI stores | Account, optional first expense, and optional lock steps resume after interruption; completion clears the draft only after the splash-complete marker persists |
| Finance persistence | Zustand → repositories → SQLCipher | Error remains on the current form; no false success navigation |
| Account transfer | Store mutation lock → transaction-scoped `TransferRepository` → one `account_transfers` row | Same-account, missing/archived endpoint, invalid amount/date, and conflicting retry key fail before a second financial effect; account deletion remains blocked while referenced |
| Import | Local file/paste parser → account resolution → one DB transaction | Invalid file rows are excluded with reasons; partial pasted imports need confirmation; transaction failure rolls back; stable keys reconcile unchanged rows and skip edited rows while accepting new ones |
| Recurring catch-up | Pure planner → idempotent repository writes | Existing scheduled posts are skipped; next run advances after processing |
| Reminders | Expo local notifications | Permission/scheduling failure is surfaced locally; finance data remains intact |
| Backup/export | Local file/share services | Export failure does not mutate the database; backup v3 includes transfers, reads legacy v2, and restore validates first before capturing one pre-restore snapshot for single-use undo |
| App Lock and recovery | SecureStore preference/PIN result + native device authentication → locked-only root | Missing, invalid, or unreadable lock state fails closed. A short-lived native-auth grant can replace only the app PIN; destructive fallback uses a pending marker and never unlocks the old ledger |

Onboarding draft data is deliberately small and contains unfinished form state only. Authoritative accounts
and transactions remain in SQLite. Unreadable or unsupported drafts are preserved and not overwritten;
discarding an invalid draft requires explicit confirmation. A failed first-run-marker read blocks setup
until retried. The optional first expense uses a stable key; going Back and changing its amount updates
the existing transaction, even after a committed-but-unconfirmed save.

Import source keys combine a SHA-256 fingerprint of the selected local content, the active mapping, and the
source row number. Unchanged rows are reconciled; previously imported rows since edited in the ledger
are skipped with an explicit reason and do not block new rows. Direct repository reuse of a key for a
different financial effect still fails. A post-commit refresh error uses
`IMPORT_COMMITTED_REFRESH_FAILED` so the UI does not mislabel durable writes as a rolled-back failure.

Restore validates identities, enum/format fields, references, safe integers, recurring provenance, and
source-key uniqueness before replacing data. Transfer restore also validates distinct account endpoints and
remaps both references inside the same replacement transaction. The singleton recovery snapshot stays in the configured
SQLCipher database, not plaintext preferences. Undo consumes it in the same replacement transaction;
it is a one-use local safety net, not a versioned backup service. Native encryption remains unverified.

Transfers are deliberately separate from `transactions`. They change per-account balances but do not create
income, spending, or category-budget activity. A retry key is immutable and may produce exactly one effect;
an attempted reuse with different amount/accounts/date/note fails closed. Only a transaction-scoped executor
may run inside an open write transaction, so unrelated database calls wait for commit or rollback.

## Optional external clients

- `smartTipsClient`: opt-in Gemini finance advice with a minimized aggregate payload.
- `placesClient`: Overpass with Nominatim fallback around fixed TIP Quezon City coordinates.
- `eatsTipsClient`: optional Gemini explanation using place names, distance bands, and price levels—not
  precise device coordinates.

All external calls require bounded client-side handling. Offline Smart Tips remain available when network
calls fail. No external provider result is treated as verified local finance data.

QA update (2026-09-28): Overpass and its single Nominatim fallback share the same 18-second abort deadline; fallback errors resolve to the existing controlled error result. Smart Tips allows only its defined aggregate/ratio fields, validates real calendar months and finite ratios in [0,1], and rejects unexpected data before fetch. Remote resilience checks use a synthetic API key and local fetch doubles; they do not certify live providers. See [QA Verification Report](./QA%20Verification%20Report%202026-09-28.md).

Live Gemini, Overpass, and Nominatim behavior remains **UNVERIFIED** in this implementation pass. Provider
credentials, rate limits, network variability, and production responses were not exercised.

## Hosted-service decision gate

A general hosted ledger is not justified by the current product evidence. Core finance must remain usable
offline with no account. Reconsider sync/recovery/collaboration only after at least 50 target-user interviews
and both conditions hold: at least 30% rank it in their top three needs, and a candidate provider demonstrates
at least 80% coverage of the target Philippine institutions/e-wallets. A stateless Gemini proxy may be assessed
separately before public production to keep provider credentials off distributed clients and enforce quotas;
it must not become a remote finance source of truth.

## Authentication and authorization

There is no account authentication. Optional PIN/biometric App Lock is a local access gate, not backend
authorization. Its PIN verifier is separate from the SQLCipher key. Forgotten-PIN recovery delegates to
platform device security, stores only an expiring in-memory grant, replaces the PIN atomically, and never
reads or regenerates the database key. The locked root mounts only App Lock and PIN Recovery. API 35 emulator
smoke verified locked startup/resume and the unavailable-auth/reset-warning path; enrolled native success,
real deletion/interruption, physical hardware, and tablet behavior remain **UNVERIFIED**.
