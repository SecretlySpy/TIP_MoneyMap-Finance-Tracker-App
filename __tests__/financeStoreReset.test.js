jest.mock("../src/db/client", () => ({
  initializeDatabase: jest.fn(),
}));
jest.mock("../src/services/localReset", () => ({
  performLocalReset: jest.fn(async () => {}),
}));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ currencySymbol: "₱", themePreference: "light" }),
}));

import { performLocalReset } from "../src/services/localReset";
import { useFinanceStore } from "../src/store/financeStore";

describe("financeStore local reset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFinanceStore.setState({
      accounts: [{ id: 1, name: "Sensitive account" }],
      budgets: [{ id: 2 }],
      categories: [{ id: 3 }],
      goals: [{ id: 4 }],
      recurringRules: [{ id: 5 }],
      status: "ready",
      transactions: [{ id: 6, note: "Sensitive note" }],
      transfers: [{ id: 7, note: "Sensitive transfer note" }],
    });
  });

  it("clears cached financial records before completing persistent erasure", async () => {
    await useFinanceStore.getState().resetLocalData();

    expect(performLocalReset).toHaveBeenCalledTimes(1);
    expect(useFinanceStore.getState()).toMatchObject({
      accounts: [],
      budgets: [],
      categories: [],
      goals: [],
      recurringRules: [],
      status: "idle",
      transactions: [],
      transfers: [],
    });
  });

  it("keeps cached records cleared and reports an error if persistent cleanup is interrupted", async () => {
    performLocalReset.mockRejectedValueOnce(new Error("interrupted"));

    await expect(useFinanceStore.getState().resetLocalData()).rejects.toThrow("interrupted");

    expect(useFinanceStore.getState()).toMatchObject({
      accounts: [],
      budgets: [],
      categories: [],
      goals: [],
      recurringRules: [],
      status: "error",
      transactions: [],
      transfers: [],
    });
  });
});
