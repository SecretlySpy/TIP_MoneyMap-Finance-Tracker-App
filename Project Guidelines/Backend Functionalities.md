# Backend Functionalities

Updated: 2026-09-27

## Status

Not applicable: MoneyMap v0.1.0 has no owned backend, server database, login, or server-side API. The app is
offline-first and stores finance data in encrypted on-device SQLite.

## Local service boundaries

| Use case | Boundary | Failure behavior |
|---|---|---|
| Finance persistence | Zustand → repositories → SQLCipher | Error remains on the current form; no false success navigation |
| Import | Parser → account resolution → one DB transaction | Unresolved/invalid input writes nothing; transactional failure rolls back |
| Recurring catch-up | Pure planner → idempotent repository writes | Existing scheduled posts are skipped; next run advances after processing |
| Reminders | Expo local notifications | Permission/scheduling failure is surfaced locally; finance data remains intact |
| Backup/export | File/share services | Failure does not mutate the database |

## Optional external clients

- `smartTipsClient`: opt-in Gemini finance advice with a minimized aggregate payload.
- `placesClient`: Overpass with Nominatim fallback around fixed TIP Quezon City coordinates.
- `eatsTipsClient`: optional Gemini explanation using place names, distance bands, and price levels—not
  precise device coordinates.

All external calls require bounded client-side handling. Offline Smart Tips remain available when network
calls fail. No external provider result is treated as verified local finance data.

QA update (2026-09-28): Overpass and its single Nominatim fallback share the same 18-second abort deadline; fallback errors resolve to the existing controlled error result. Smart Tips allows only its defined aggregate/ratio fields, validates real calendar months and finite ratios in [0,1], and rejects unexpected data before fetch. Remote resilience checks use a synthetic API key and local fetch doubles; they do not certify live providers. See [QA Verification Report](./QA%20Verification%20Report%202026-09-28.md).

## Authentication and authorization

There is no account authentication. Optional PIN/biometric App Lock is a local access gate, not identity or
authorization for a backend. Its PIN-derived verifier is separate from the SQLCipher key.
