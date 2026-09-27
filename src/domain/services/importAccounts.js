import { importAccountKey, normalizeImportAccountLabel } from "./importParser";

const GENERIC_ACCOUNT_LABELS = new Set([
  "CASH",
  "CARD",
  "CREDIT",
  "DEBIT",
  "EWALLET",
  "WALLET",
]);

function isGenericAccountLabel(label) {
  const compact = normalizeImportAccountLabel(label).toUpperCase().replace(/[^A-Z]/g, "");
  return GENERIC_ACCOUNT_LABELS.has(compact);
}

export function listImportAccountSources(rows) {
  const sources = new Map();
  for (const row of rows ?? []) {
    const key = row.accountKey || importAccountKey(row.accountLabel);
    if (key.length === 0 || sources.has(key)) {
      continue;
    }
    sources.set(key, {
      key,
      label: normalizeImportAccountLabel(row.accountLabel),
      suggestedType: row.accountType ?? null,
    });
  }
  return [...sources.values()];
}

export function buildAutomaticAccountResolutions(rows, accounts) {
  const activeAccounts = (accounts ?? []).filter((account) => !account.isArchived);
  const resolutions = {};
  for (const source of listImportAccountSources(rows)) {
    const exactMatches = activeAccounts.filter(
      (account) => importAccountKey(account.name) === source.key,
    );
    if (exactMatches.length === 1) {
      resolutions[source.key] = { kind: "existing", accountId: exactMatches[0].id };
      continue;
    }
    if (source.suggestedType !== null && isGenericAccountLabel(source.label)) {
      const typeMatches = activeAccounts.filter((account) => account.type === source.suggestedType);
      if (typeMatches.length === 1) {
        resolutions[source.key] = { kind: "existing", accountId: typeMatches[0].id };
      }
    }
  }
  return resolutions;
}

export function unresolvedImportAccountSources(rows, resolutions) {
  return listImportAccountSources(rows).filter((source) => resolutions?.[source.key] === undefined);
}
