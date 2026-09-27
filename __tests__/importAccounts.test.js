import {
  buildAutomaticAccountResolutions,
  listImportAccountSources,
  unresolvedImportAccountSources,
} from "../src/domain/services/importAccounts";

const accounts = [
  { id: 1, name: "Cash", type: "CASH", isArchived: false },
  { id: 2, name: "GCash", type: "EWALLET", isArchived: false },
  { id: 3, name: "Old Wallet", type: "EWALLET", isArchived: true },
];

describe("import account resolution", () => {
  it("matches a source label to one active named account", () => {
    const rows = [{ accountLabel: "  gcash ", accountKey: "gcash", accountType: null }];
    expect(buildAutomaticAccountResolutions(rows, accounts)).toEqual({
      gcash: { kind: "existing", accountId: 2 },
    });
  });

  it("leaves unknown labels unresolved instead of mapping them to Cash", () => {
    const rows = [
      { accountLabel: "BPI Savings", accountKey: "bpi savings", accountType: null },
      { accountLabel: "GCash", accountKey: "gcash", accountType: null },
    ];
    const resolutions = buildAutomaticAccountResolutions(rows, accounts);

    expect(listImportAccountSources(rows)).toHaveLength(2);
    expect(unresolvedImportAccountSources(rows, resolutions).map((source) => source.label)).toEqual([
      "BPI Savings",
    ]);
  });

  it("does not resolve to an archived account", () => {
    const rows = [{ accountLabel: "Old Wallet", accountKey: "old wallet", accountType: null }];
    expect(unresolvedImportAccountSources(
      rows,
      buildAutomaticAccountResolutions(rows, accounts),
    )).toHaveLength(1);
  });
});
