const mockCallOrder = [];
const mockSecureValues = new Map();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key) => mockSecureValues.get(key) ?? null),
  setItemAsync: jest.fn(async (key, value) => {
    mockCallOrder.push(`secure:set:${key}`);
    mockSecureValues.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    mockCallOrder.push(`secure:delete:${key}`);
    mockSecureValues.delete(key);
  }),
}));

jest.mock("../src/db/client", () => ({
  beginDatabaseReset: jest.fn(() => mockCallOrder.push("database-guard:start")),
  completeDatabaseReset: jest.fn(() => mockCallOrder.push("database-guard:complete")),
  deleteFinanceDatabase: jest.fn(async () => mockCallOrder.push("database")),
}));
jest.mock("../src/db/databaseKey", () => ({
  clearDatabaseKey: jest.fn(async () => mockCallOrder.push("database-key")),
}));
jest.mock("../src/services/appLock", () => ({
  clearPin: jest.fn(async () => mockCallOrder.push("pin")),
}));
jest.mock("../src/services/notificationScheduler", () => ({
  clearMoneyMapNotifications: jest.fn(async () => mockCallOrder.push("notifications")),
}));
jest.mock("../src/services/onboarding", () => ({
  clearOnboardingDraft: jest.fn(async () => mockCallOrder.push("onboarding")),
}));
jest.mock("../src/services/preferences", () => ({
  clearPreferences: jest.fn(async () => mockCallOrder.push("preferences")),
  clearSplashSeen: jest.fn(async () => mockCallOrder.push("splash")),
}));

import * as SecureStore from "expo-secure-store";
import { clearDatabaseKey } from "../src/db/databaseKey";
import { deleteFinanceDatabase } from "../src/db/client";
import {
  LOCAL_RESET_PENDING_KEY,
  performLocalReset,
  resumePendingLocalReset,
} from "../src/services/localReset";

describe("interruption-safe local reset", () => {
  beforeEach(() => {
    mockCallOrder.length = 0;
    mockSecureValues.clear();
    jest.clearAllMocks();
  });

  it("writes a pending marker first and clears it only after all reset steps", async () => {
    await performLocalReset();

    expect(mockCallOrder).toEqual([
      "database-guard:start",
      `secure:set:${LOCAL_RESET_PENDING_KEY}`,
      "database",
      "database-key",
      "pin",
      "preferences",
      "splash",
      "onboarding",
      "notifications",
      `secure:delete:${LOCAL_RESET_PENDING_KEY}`,
      "database-guard:complete",
    ]);
    expect(mockSecureValues.has(LOCAL_RESET_PENDING_KEY)).toBe(false);
  });

  it("retains the marker when a step fails so startup can finish cleanup", async () => {
    clearDatabaseKey.mockRejectedValueOnce(new Error("secure storage unavailable"));

    await expect(performLocalReset()).rejects.toThrow("secure storage unavailable");

    expect(mockSecureValues.get(LOCAL_RESET_PENDING_KEY)).toBe("pending");
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(LOCAL_RESET_PENDING_KEY);
    expect(mockCallOrder).not.toContain("database-guard:complete");
  });

  it("resumes a pending reset without writing a second marker", async () => {
    mockSecureValues.set(LOCAL_RESET_PENDING_KEY, "pending");

    await expect(resumePendingLocalReset()).resolves.toBe(true);

    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(deleteFinanceDatabase).toHaveBeenCalledTimes(1);
    expect(mockSecureValues.has(LOCAL_RESET_PENDING_KEY)).toBe(false);
  });

  it("does nothing when no reset is pending", async () => {
    await expect(resumePendingLocalReset()).resolves.toBe(false);
    expect(deleteFinanceDatabase).not.toHaveBeenCalled();
  });
});
