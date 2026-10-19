import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isExpoGoRuntime } from "../src/runtime/expoGo";

describe("Expo Go runtime detection", () => {
  it("treats Expo Go ownership and store-client execution as Expo Go", () => {
    expect(isExpoGoRuntime({ appOwnership: "expo" })).toBe(true);
    expect(isExpoGoRuntime({ executionEnvironment: "storeClient" })).toBe(true);
  });

  it("does not treat a development build as Expo Go", () => {
    expect(isExpoGoRuntime({ appOwnership: "guest", executionEnvironment: "bare" })).toBe(false);
    expect(isExpoGoRuntime(null)).toBe(false);
    expect(isExpoGoRuntime({})).toBe(false);
  });

  it("keeps SQLCipher imports out of the Expo Go entry graph", () => {
    const appSource = readFileSync(join(__dirname, "..", "App.js"), "utf8");
    expect(appSource).toContain("isExpoGoRuntime");
    expect(appSource).toContain("ExpoGoUnsupportedScreen");
    expect(appSource).toContain("lazy(() => import(\"./src/MoneyMapRoot\"))");
    expect(appSource).not.toMatch(/from ["']@op-engineering\/op-sqlite["']/);
    expect(appSource).not.toMatch(/from ["']\.\/src\/db\/client["']/);
    expect(appSource).not.toMatch(/from ["']\.\/src\/store\/financeStore["']/);
  });
});
