import {
    assertNonBlank,
    assertPositiveInteger,
    assertValidEpochMillis,
    readInteger,
    readNullableString,
} from "../validation";
import {
    deleteRow,
    findRowById,
    insertRow,
    listRows,
    requireCreatedEntity,
    updateRow,
} from "./shared";

function mapTransfer(row) {
    return {
        id: readInteger(row, "id"),
        amountMinor: readInteger(row, "amount_minor"),
        fromAccountId: readInteger(row, "from_account_id"),
        toAccountId: readInteger(row, "to_account_id"),
        dateEpochMillis: readInteger(row, "date_epoch_millis"),
        note: readNullableString(row, "note"),
        sourceKey: readNullableString(row, "source_key"),
    };
}

function validateSourceKey(sourceKey) {
    if (sourceKey === null || sourceKey === undefined) {
        return;
    }
    if (typeof sourceKey !== "string") {
        throw new TypeError("sourceKey must be text or null.");
    }
    assertNonBlank(sourceKey, "sourceKey");
    if (sourceKey.length > 256) {
        throw new TypeError("sourceKey must be at most 256 characters.");
    }
}

function validateTransfer(transfer) {
    assertPositiveInteger(transfer.amountMinor, "amountMinor");
    assertPositiveInteger(transfer.fromAccountId, "fromAccountId");
    assertPositiveInteger(transfer.toAccountId, "toAccountId");
    if (transfer.fromAccountId === transfer.toAccountId) {
        throw new TypeError("A transfer requires two different accounts.");
    }
    assertValidEpochMillis(transfer.dateEpochMillis, "dateEpochMillis");
    if (transfer.note !== null && typeof transfer.note !== "string") {
        throw new TypeError("note must be text or null.");
    }
    validateSourceKey(transfer.sourceKey);
}

function isSameFinancialEffect(existing, transfer) {
    return existing.amountMinor === transfer.amountMinor
        && existing.fromAccountId === transfer.fromAccountId
        && existing.toAccountId === transfer.toAccountId
        && existing.dateEpochMillis === transfer.dateEpochMillis
        && existing.note === transfer.note;
}

async function assertTransferAccounts(database, fromAccountId, toAccountId, { requireActive }) {
    const result = await database.execute(
        "SELECT id, is_archived FROM accounts WHERE id IN (?, ?)",
        [fromAccountId, toAccountId],
    );
    if (result.rows.length !== 2) {
        throw new TypeError("Transfer accounts must both exist.");
    }
    if (requireActive && result.rows.some((row) => row.is_archived !== 0)) {
        throw new TypeError("Transfers require active accounts.");
    }
}

export class TransferRepository {
    constructor(database) {
        this.database = database;
    }

    async create(transfer) {
        const normalized = {
            ...transfer,
            note: transfer.note ?? null,
            sourceKey: transfer.sourceKey ?? null,
        };
        validateTransfer(normalized);
        if (normalized.sourceKey !== null) {
            const existing = await this.getBySourceKey(normalized.sourceKey);
            if (existing !== null) {
                if (!isSameFinancialEffect(existing, normalized)) {
                    throw new Error("The transfer source key is already assigned to a different financial effect.");
                }
                // An exact retry remains idempotent even if an endpoint was archived
                // after the original commit; no new financial effect is being created.
                return existing;
            }
        }
        await assertTransferAccounts(
            this.database,
            normalized.fromAccountId,
            normalized.toAccountId,
            { requireActive: true },
        );

        const statement = `INSERT INTO account_transfers (
          amount_minor, from_account_id, to_account_id, date_epoch_millis, note, source_key
        ) VALUES (?, ?, ?, ?, ?, ?)`;
        const parameters = [
            normalized.amountMinor,
            normalized.fromAccountId,
            normalized.toAccountId,
            normalized.dateEpochMillis,
            normalized.note,
            normalized.sourceKey,
        ];
        if (normalized.sourceKey !== null) {
            const result = await this.database.execute(
                `${statement} ON CONFLICT(source_key) DO NOTHING`,
                parameters,
            );
            if (result.rowsAffected === 0) {
                const existing = await this.getBySourceKey(normalized.sourceKey);
                if (existing === null || !isSameFinancialEffect(existing, normalized)) {
                    throw new Error("The transfer source key is already assigned to a different financial effect.");
                }
                return existing;
            }
            return requireCreatedEntity(
                await this.getBySourceKey(normalized.sourceKey),
                "Account transfer",
            );
        }
        const id = await insertRow(this.database, statement, parameters);
        return requireCreatedEntity(await this.getById(id), "Account transfer");
    }

    async getById(id) {
        const row = await findRowById(this.database, "account_transfers", id);
        return row === null ? null : mapTransfer(row);
    }

    async getBySourceKey(sourceKey) {
        if (typeof sourceKey !== "string") {
            throw new TypeError("sourceKey must be text.");
        }
        assertNonBlank(sourceKey, "sourceKey");
        const result = await this.database.execute(
            "SELECT * FROM account_transfers WHERE source_key = ?",
            [sourceKey],
        );
        return result.rows[0] === undefined ? null : mapTransfer(result.rows[0]);
    }

    async list() {
        return (await listRows(this.database, "account_transfers")).map(mapTransfer);
    }

    async update(id, patch) {
        if (patch.sourceKey !== undefined) {
            throw new TypeError("A transfer source key cannot be changed.");
        }
        const current = await this.getById(id);
        if (current === null) {
            return null;
        }
        const next = {
            ...current,
            ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
        };
        validateTransfer(next);
        await assertTransferAccounts(
            this.database,
            next.fromAccountId,
            next.toAccountId,
            { requireActive: patch.fromAccountId !== undefined || patch.toAccountId !== undefined },
        );

        const assignments = [];
        if (patch.amountMinor !== undefined) {
            assignments.push({ column: "amount_minor", value: patch.amountMinor });
        }
        if (patch.fromAccountId !== undefined) {
            assignments.push({ column: "from_account_id", value: patch.fromAccountId });
        }
        if (patch.toAccountId !== undefined) {
            assignments.push({ column: "to_account_id", value: patch.toAccountId });
        }
        if (patch.dateEpochMillis !== undefined) {
            assignments.push({ column: "date_epoch_millis", value: patch.dateEpochMillis });
        }
        if (patch.note !== undefined) {
            assignments.push({ column: "note", value: patch.note });
        }
        const didUpdate = await updateRow(this.database, "account_transfers", id, assignments);
        return didUpdate ? this.getById(id) : null;
    }

    delete(id) {
        return deleteRow(this.database, "account_transfers", id);
    }
}
