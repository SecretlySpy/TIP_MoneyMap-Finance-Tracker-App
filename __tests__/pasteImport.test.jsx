import { Alert } from "react-native";
import { fireEvent, act, render, waitFor } from "@testing-library/react-native";
import { OpSqliteDatabase } from "../src/db/sql";
import { migrateDatabase } from "../src/db/schema";
import { TransactionRepository } from "../src/db/repositories";
import { PasteImportScreen } from "../src/screens/PasteImportScreen";
import { useFinanceStore } from "../src/store/financeStore";
import { initializeDatabase } from "../src/db/client";
import { TestSqliteDatabase } from "./support/testDatabase";

jest.mock("../src/db/client", () => ({ initializeDatabase: jest.fn() }));
// Crypto is irrelevant to the paste UX; keep only the source-key builder real.
jest.mock("../src/services/importFile", () => ({
  fingerprintImportContent: jest.fn(async () => "c".repeat(64)),
  buildImportSourceKey: jest.requireActual("../src/services/importFile").buildImportSourceKey,
}));
jest.mock("../src/store/uiStore", () => ({
  registerFinanceSnapshotProvider: jest.fn(),
  syncRemindersFromStores: jest.fn(async () => {}),
  useUiStore: (selector) => selector({ themePreference: "light", currencySymbol: "₱" }),
}));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

const HEADER = "date,type,amount,category,account,note";

describe("Paste import partial-row confirmation", () => {
  let database;
  let transactions;
  let alertSpy;
  let navigation;
  let navigate;

  const alerts = () => alertSpy.mock.calls.map(([title, message]) => ({ title, message }));
  const alertWithButtons = (title) => alertSpy.mock.calls.find(([called]) => called === title)?.[2] ?? [];
  // Alert is stubbed, so dialog buttons are invoked directly from the captured call.
  const pressDialogButton = async (title, label) => {
    const button = alertWithButtons(title).find((candidate) => candidate.text === label);
    expect(button).toBeDefined();
    await act(async () => { button.onPress?.(); });
  };

  beforeEach(async () => {
    database = new OpSqliteDatabase(new TestSqliteDatabase());
    await migrateDatabase(database);
    initializeDatabase.mockResolvedValue(database);
    transactions = new TransactionRepository(database);
    navigate = jest.fn();
    navigation = { navigate, getParent: () => ({ navigate }), goBack: jest.fn() };
    useFinanceStore.setState({ status: "idle" });
    await useFinanceStore.getState().ensureHydrated();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    database.close();
  });

  async function pasteCsv(csv) {
    const screen = await render(<PasteImportScreen navigation={navigation} route={{ params: { mode: "csv" } }} />);
    await fireEvent.changeText(screen.getByLabelText("CSV text"), csv);
    await fireEvent.press(screen.getByRole("button", { name: "Import CSV" }));
    return screen;
  }

  it("commits a fully valid paste without an extra confirmation step", async () => {
    const screen = await pasteCsv([HEADER, "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch"].join("\n"));

    await waitFor(() => expect(alerts().some(({ title }) => title === "Import complete")).toBe(true));
    expect(alertWithButtons("Import the valid rows only?")).toEqual([]);
    expect(alerts().find(({ title }) => title === "Import complete")?.message).toMatch(/Imported 1 and reconciled 0/);
    expect(await transactions.list()).toHaveLength(1);
    screen.unmount();
  });

  it("asks before importing the valid rows when some pasted rows are invalid", async () => {
    const csv = [
      HEADER,
      "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch",
      "2026-08-02,TRANSFER,20.00,Food,Cash,ambiguous",
      "2026-08-03,EXPENSE,,Food,Cash,no amount",
    ].join("\n");
    const screen = await pasteCsv(csv);

    await waitFor(() => expect(alertWithButtons("Import the valid rows only?")).toHaveLength(2));
    const prompt = alerts().find(({ title }) => title === "Import the valid rows only?");
    expect(prompt?.message).toMatch(/2 of 3 pasted row\(s\) are invalid/);
    expect(prompt?.message).toMatch(/Row 3: invalid type "TRANSFER"/);
    expect(prompt?.message).toMatch(/Row 4: is missing an amount/);
    // Nothing is written until the user confirms the partial import.
    expect(await transactions.list()).toHaveLength(0);
    screen.unmount();
  });

  it("writes nothing when the partial import is cancelled", async () => {
    const csv = [HEADER, "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch", "2026-08-02,TRANSFER,20.00,Food,Cash,x"].join("\n");
    const screen = await pasteCsv(csv);

    await waitFor(() => expect(alertWithButtons("Import the valid rows only?")).toHaveLength(2));
    await pressDialogButton("Import the valid rows only?", "Cancel");
    expect(await transactions.list()).toHaveLength(0);
    expect(alerts().some(({ title }) => title === "Import complete")).toBe(false);
    screen.unmount();
  });

  it("imports only the valid rows and reports the skipped count once confirmed", async () => {
    const csv = [HEADER, "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch", "2026-08-02,TRANSFER,20.00,Food,Cash,x"].join("\n");
    const screen = await pasteCsv(csv);

    await waitFor(() => expect(alertWithButtons("Import the valid rows only?")).toHaveLength(2));
    await pressDialogButton("Import the valid rows only?", "Import 1");

    await waitFor(() => expect(alerts().some(({ title }) => title === "Import complete")).toBe(true));
    expect(alerts().find(({ title }) => title === "Import complete")?.message).toMatch(/skipped 1 invalid row\(s\)/);
    expect(await transactions.list()).toHaveLength(1);
    screen.unmount();
  });

  it("rejects the whole paste when every row is invalid", async () => {
    const csv = [HEADER, "2026-08-01,TRANSFER,20.00,Food,Cash,x", "2026-08-02,bad-date,20.00,Food,Cash,y"].join("\n");
    const screen = await pasteCsv(csv);

    await waitFor(() => expect(alerts().some(({ title }) => title === "Nothing imported")).toBe(true));
    expect(alertWithButtons("Nothing imported")).toEqual([]);
    expect(alerts().find(({ title }) => title === "Nothing imported")?.message).toMatch(/nothing was written/);
    expect(await transactions.list()).toHaveLength(0);
    screen.unmount();
  });

  it("rejects a malformed paste instead of importing misaligned rows", async () => {
    const csv = [HEADER, "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch", '2026-08-02,EXPENSE,20.00,Food,Cash,"unclosed'].join("\n");
    const screen = await pasteCsv(csv);

    await waitFor(() => expect(alerts().some(({ title }) => title === "Import failed")).toBe(true));
    expect(alerts().find(({ title }) => title === "Import failed")?.message).toMatch(/Could not read the CSV at row 3/);
    expect(await transactions.list()).toHaveLength(0);
    screen.unmount();
  });

  it("reports a previously imported row edited in the ledger as retained", async () => {
    const csv = [HEADER, "2026-08-01,EXPENSE,150.00,Food,Cash,Lunch"].join("\n");
    let screen = await pasteCsv(csv);
    await waitFor(() => expect(alerts().some(({ title }) => title === "Import complete")).toBe(true));
    screen.unmount();
    const [original] = await transactions.list();
    await useFinanceStore.getState().updateTransaction(original.id, { amountMinor: 20_000 });

    alertSpy.mockClear();
    screen = await pasteCsv(csv);
    await waitFor(() => expect(alerts().some(({ title }) => title === "No new transactions")).toBe(true));
    expect(alerts().find(({ title }) => title === "No new transactions")?.message).toMatch(/Row 2: This imported transaction was edited after import/);
    expect((await transactions.list()).map(({ amountMinor }) => amountMinor)).toEqual([20_000]);
    screen.unmount();
  });
});
