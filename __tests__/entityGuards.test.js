import {
  canArchiveAccount,
  canDeleteAccount,
  canDeleteCategory,
  canRenameCategory,
} from "../src/domain/services/entityGuards";

describe("entityGuards", () => {
  it("blocks category delete when referenced", () => {
    const ok = canDeleteCategory(1, {
      transactions: [],
      budgets: [],
      recurringRules: [],
    });
    expect(ok).toEqual({ ok: true });

    const blocked = canDeleteCategory(2, {
      transactions: [{ categoryId: 2 }],
      budgets: [{ categoryId: 2 }, { categoryId: 3 }],
      recurringRules: [{ categoryId: 2 }],
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/1 transaction/);
    expect(blocked.reason).toMatch(/1 budget/);
    expect(blocked.reason).toMatch(/1 recurring rule/);
  });

  it("requires at least one active account when deleting", () => {
    const accounts = [
      { id: 1, isArchived: false },
      { id: 2, isArchived: true },
    ];
    expect(canDeleteAccount(1, { accounts }).ok).toBe(false);
    expect(
      canDeleteAccount(2, {
        accounts: [
          { id: 1, isArchived: false },
          { id: 2, isArchived: false },
        ],
      }).ok,
    ).toBe(true);
  });

  it("blocks account delete when used by transactions or recurring rules", () => {
    const accounts = [
      { id: 1, isArchived: false },
      { id: 2, isArchived: false },
    ];
    expect(
      canDeleteAccount(1, {
        accounts,
        transactions: [{ accountId: 1 }],
        recurringRules: [],
      }).ok,
    ).toBe(false);
    expect(
      canDeleteAccount(1, {
        accounts,
        transactions: [],
        recurringRules: [{ accountId: 1 }],
      }).reason,
    ).toMatch(/1 recurring rule/);
    expect(
      canDeleteAccount(1, {
        accounts,
        transactions: [],
        recurringRules: [],
      }),
    ).toEqual({ ok: true });
  });

  it("canArchiveAccount delegates to canDeleteAccount", () => {
    const accounts = [
      { id: 1, isArchived: false },
      { id: 2, isArchived: false },
    ];
    expect(canArchiveAccount(1, { accounts }).ok).toBe(true);
    expect(canArchiveAccount(1, { accounts: [{ id: 1, isArchived: false }] }).ok).toBe(false);
  });

  it("validates category rename uniqueness", () => {
    const categories = [
      { id: 1, name: "Food", type: "EXPENSE" },
      { id: 2, name: "Transport", type: "EXPENSE" },
      { id: 3, name: "Food", type: "INCOME" },
    ];
    expect(canRenameCategory("  Snacks  ", "EXPENSE", categories, 1)).toEqual({
      ok: true,
      name: "Snacks",
    });
    expect(canRenameCategory("transport", "EXPENSE", categories, 1).ok).toBe(false);
    expect(canRenameCategory("Food", "EXPENSE", categories, 1).ok).toBe(true); // same id
    expect(canRenameCategory("", "EXPENSE", categories, 1).ok).toBe(false);
  });
});
