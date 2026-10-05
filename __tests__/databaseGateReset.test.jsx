import { render, waitFor } from "@testing-library/react-native";
import { DatabaseGate } from "../src/components/DatabaseGate";

const mockOrder = [];
const mockEnsureHydrated = jest.fn(async () => {
  mockOrder.push("hydrate");
});
const mockResumePendingLocalReset = jest.fn(async () => {
  mockOrder.push("resume-reset");
});

jest.mock("../src/services/localReset", () => ({
  resumePendingLocalReset: (...args) => mockResumePendingLocalReset(...args),
}));
jest.mock("../src/store/financeStore", () => ({
  useFinanceStore: (selector) => selector({
    ensureHydrated: mockEnsureHydrated,
    errorMessage: null,
    status: "loading",
  }),
}));
jest.mock("../src/store/uiStore", () => ({
  useUiStore: (selector) => selector({ themePreference: "light" }),
}));

describe("DatabaseGate pending reset ordering", () => {
  it("finishes a pending reset before hydrating the finance database", async () => {
    await render(<DatabaseGate><></></DatabaseGate>);

    await waitFor(() => expect(mockEnsureHydrated).toHaveBeenCalledTimes(1));
    expect(mockOrder).toEqual(["resume-reset", "hydrate"]);
  });
});
