# Database Structure

Updated: 2026-09-27  
Engine: SQLite via OP-SQLite with SQLCipher; schema version 4

## Data model

```mermaid
erDiagram
  ACCOUNTS ||--o{ TRANSACTIONS : receives
  CATEGORIES ||--o{ TRANSACTIONS : classifies
  RECURRING_RULES ||--o{ TRANSACTIONS : posts
  ACCOUNTS ||--o{ RECURRING_RULES : pays
  CATEGORIES ||--o{ RECURRING_RULES : classifies
  CATEGORIES ||--o{ BUDGETS : limits
  SAVINGS_GOALS {
    integer id PK
    integer target_minor
    integer current_minor
    integer deadline_epoch_millis
  }
```

| Entity | Ownership and constraints | Relevant indexes |
|---|---|---|
| `accounts` | Local user data; Cash/Card/E-wallet; archived accounts remain referentially valid | Primary key |
| `categories` | Seeded plus custom; type participates in the transaction/rule foreign key | Unique `(id,type)` |
| `transactions` | Positive integer minor amount, type/category/account, epoch, optional recurring rule | Category, account, date, recurring rule |
| `recurring_rules` | Positive amount, frequency, next run, optional icon, 14-day default, monthly anchor | Category, account, active/next run |
| `budgets` | One positive limit per category/month | Unique `(category_id,month_year)` |
| `savings_goals` | Positive target, nonnegative current amount, optional deadline, archive flag | Active/deadline |

## Reconciliation effects

- No schema version or existing record ID changed.
- Fresh databases now default `recurring_rules.reminder_lead_days` to 14. Existing values are preserved;
  no migration overwrites user data.
- Import parsing retains the source account label. Resolution occurs before the transaction starts, then
  named accounts and all transaction rows are created inside one database transaction.
- Recurring de-duplication uses the scheduled `(recurring_rule_id, date_epoch_millis)` pair. It is an
  application invariant rather than a database unique index.

## Lifecycle, privacy, and recovery

### QA integrity corrections (2026-09-28)

Single-statement repository helpers now accept both a database and a caller-owned transaction executor. Goal contributions increment atomically in SQL, with a safe-integer overflow guard. Recurring catch-up reads schedules, checks prior posts, inserts, and advances schedules in one serialized transaction, so concurrent callers cannot post duplicate runs or leave partial posts after failure. No migration or schema version changed.

Restore validates collection shapes, unique source IDs, required references, and safe integer money/timestamps before replacing local data. Unmapped references fail instead of silently skipping rows. Thirty-two concurrent contribution/catch-up checks and rollback/unsafe-backup reproductions pass on real desktop SQLite; native SQLCipher remains unverified. Details and query plans: [QA Verification Report](./QA%20Verification%20Report%202026-09-28.md).

- SQLCipher keys are generated separately from App Lock PIN material and stored through SecureStore.
- Android automatic backup is disabled; explicit app backup/export is the supported recovery path.
- Foreign keys, `STRICT` tables, WAL, `synchronous=FULL`, and `foreign_key_check` protect local integrity.
- There is no remote database. Import files and exports are user-selected local/share artifacts.

Rollback for this reconciliation is code-only because no migration was introduced. Reverting the changed
source restores prior behavior without transforming persisted rows.
