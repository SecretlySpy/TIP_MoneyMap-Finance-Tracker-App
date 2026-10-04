const nativeDatabases = [];
const mockOpen = jest.fn(() => {
  const database = {
    close: jest.fn(),
    delete: jest.fn(),
    execute: jest.fn(async () => ({ rows: [], rowsAffected: 0 })),
    transaction: jest.fn(async (work) => work({ execute: database.execute })),
  };
  nativeDatabases.push(database);
  return database;
});

jest.mock("@op-engineering/op-sqlite", () => ({
  isSQLCipher: jest.fn(() => true),
  open: (...args) => mockOpen(...args),
}));
jest.mock("../src/db/databaseKey", () => ({
  loadDatabaseKey: jest.fn(async () => "a".repeat(64)),
}));
jest.mock("../src/db/schema", () => ({
  migrateDatabase: jest.fn(async () => {}),
}));
jest.mock("../src/services/localResetState", () => ({
  isLocalResetPending: jest.fn(async () => false),
}));

import { migrateDatabase } from "../src/db/schema";
import { isLocalResetPending } from "../src/services/localResetState";
import {
  deleteFinanceDatabase,
  initializeDatabase,
} from "../src/db/client";

describe("database client destructive reset", () => {
  it("deletes the active file and remains idempotent when no connection is cached", async () => {
    await initializeDatabase();
    expect(migrateDatabase).toHaveBeenCalledTimes(1);

    await deleteFinanceDatabase();
    expect(nativeDatabases[0].execute).toHaveBeenCalledWith("PRAGMA wal_checkpoint(TRUNCATE)", []);
    expect(nativeDatabases[0].delete).toHaveBeenCalledTimes(1);

    await deleteFinanceDatabase();
    expect(nativeDatabases[1].delete).toHaveBeenCalledTimes(1);

    await initializeDatabase();
    expect(mockOpen).toHaveBeenCalledTimes(3);
    expect(migrateDatabase).toHaveBeenCalledTimes(2);
  });

  it("blocks every database initializer while a reset marker is pending", async () => {
    isLocalResetPending.mockResolvedValueOnce(true);
    await expect(initializeDatabase()).rejects.toThrow(/reset is in progress/i);
  });
});
