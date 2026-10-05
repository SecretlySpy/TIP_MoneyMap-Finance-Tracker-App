import { readFileSync } from "node:fs";
import { join } from "node:path";
import { selectRootNavigationMode } from "../src/navigation/routes";

describe("root navigation mode", () => {
  it("resumes a saved first-run draft and otherwise starts at Splash", () => {
    expect(selectRootNavigationMode({
      preferencesReady: true,
      hasSeenSplash: false,
      onboardingDraft: null,
      isLocked: false,
    })).toBe("first-run-splash");

    expect(selectRootNavigationMode({
      preferencesReady: true,
      hasSeenSplash: false,
      onboardingDraft: { version: 1, step: "expense" },
      isLocked: false,
    })).toBe("first-run-onboarding");
  });

  it("requires retry of an unreadable completion marker before resuming a saved draft", () => {
    expect(selectRootNavigationMode({
      preferencesReady: true,
      hasSeenSplash: false,
      onboardingDraft: { version: 1, step: "expense" },
      splashReadError: "Start marker unavailable",
      isLocked: false,
    })).toBe("first-run-splash");
  });

  it("keeps locked and unlocked shells mutually exclusive", () => {
    expect(selectRootNavigationMode({
      preferencesReady: true,
      hasSeenSplash: true,
      onboardingDraft: null,
      isLocked: true,
    })).toBe("locked");
    expect(selectRootNavigationMode({
      preferencesReady: true,
      hasSeenSplash: true,
      onboardingDraft: null,
      isLocked: false,
    })).toBe("main");

    const source = readFileSync(join(__dirname, "..", "src/navigation/RootNavigator.jsx"), "utf8");
    const lockedBranch = source.slice(
      source.indexOf('if (rootMode === "locked")'),
      source.indexOf('// The unlocked shell'),
    );
    expect(lockedBranch).toContain('key="root-locked"');
    expect(lockedBranch).toContain('name="AppLock"');
    expect(lockedBranch).toContain('name="PinRecovery"');
    expect(lockedBranch).not.toContain('name="Main"');
    expect(source).toContain('key="root-main"');
  });

  it("gives an active lock priority over unfinished first-run routing", () => {
    expect(selectRootNavigationMode({
      preferencesReady: true,
      hasSeenSplash: false,
      onboardingDraft: { version: 1, step: "lock" },
      isLocked: true,
    })).toBe("locked");
  });

  it("holds navigation until persisted preferences are ready", () => {
    expect(selectRootNavigationMode({
      preferencesReady: false,
      hasSeenSplash: false,
      onboardingDraft: null,
      isLocked: false,
    })).toBe("loading");
  });
});
