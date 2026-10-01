// Use Node's built-in test runner so launcher tests add no project dependency.
import assert from "node:assert/strict";
import test from "node:test";

// Test only exported, side-effect-free helpers; importing the launcher must not
// start Expo because its entry-point guard remains false in this test process.
import {
  androidSdkCandidates,
  decodeGradleProperty,
  javaHomeCandidates,
} from "./run-android.mjs";

// Gradle escapes Windows drive separators and backslashes in local.properties.
test("decodeGradleProperty restores a Windows SDK path", () => {
  assert.equal(
    decodeGradleProperty(String.raw`C\:\\Users\\Student\\AppData\\Local\\Android\\Sdk`),
    String.raw`C:\Users\Student\AppData\Local\Android\Sdk`,
  );
});

// Each platform must include its documented default SDK location without needing
// the removed ~/.moneymap-env.sh file.
test("Android SDK candidates cover Windows, macOS, and Linux defaults", () => {
  const windows = androidSdkCandidates({
    targetPlatform: "win32",
    environment: { LOCALAPPDATA: String.raw`C:\Users\Student\AppData\Local` },
    homeDirectory: String.raw`C:\Users\Student`,
    workspaceRoot: String.raw`C:\repo`,
  });
  const macOS = androidSdkCandidates({
    targetPlatform: "darwin",
    environment: {},
    homeDirectory: "/Users/student",
    workspaceRoot: "/repo",
  });
  const linux = androidSdkCandidates({
    targetPlatform: "linux",
    environment: {},
    homeDirectory: "/home/student",
    workspaceRoot: "/repo",
  });

  assert.ok(windows.includes(String.raw`C:\Users\Student\AppData\Local\Android\Sdk`));
  assert.ok(macOS.includes("/Users/student/Library/Android/sdk"));
  assert.ok(linux.includes("/home/student/Android/Sdk"));
});

// The Java fallback list must include Android Studio's bundled runtime on all
// supported desktop operating systems.
test("Java candidates cover Android Studio on every desktop platform", () => {
  const windows = javaHomeCandidates({
    targetPlatform: "win32",
    environment: { ProgramFiles: String.raw`C:\Program Files` },
    homeDirectory: String.raw`C:\Users\Student`,
  });
  const macOS = javaHomeCandidates({
    targetPlatform: "darwin",
    environment: {},
    homeDirectory: "/Users/student",
  });
  const linux = javaHomeCandidates({
    targetPlatform: "linux",
    environment: {},
    homeDirectory: "/home/student",
  });

  assert.ok(
    windows.includes(String.raw`C:\Program Files\Android\Android Studio\jbr`),
  );
  assert.ok(macOS.includes("/Applications/Android Studio.app/Contents/jbr/Contents/Home"));
  assert.ok(linux.includes("/opt/android-studio/jbr"));
});

