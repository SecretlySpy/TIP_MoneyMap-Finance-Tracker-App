# Local Environment Audit — 2026-08-01

## Final development path

MoneyMap now runs on the official Google Android Emulator controlled from Visual Studio Code. BlueStacks is not connected, launched, selected, or required by the workspace workflow.

```text
VS Code build task
  └─ scripts/android-emulator.ps1
       ├─ API 35 AVD: MoneyMap_VSCode_API_35
       ├─ Metro: 127.0.0.1:8081 + adb reverse
       ├─ Gradle: JDK 21 + x86_64 debug APK
       └─ Expo dev-client deep link → MoneyMap Dashboard
```

The emulator display remains a native Android Emulator window beside VS Code. VS Code provides task-driven lifecycle control, build/install/launch commands, React Native log integration, and a Hermes attach configuration; VS Code does not provide Android Studio's literal embedded Running Devices pane.

## Existing tools reused

| Capability | Detected tool | Verified value or path | Final use |
|---|---|---|---|
| JavaScript runtime | Node.js | `v24.16.0` | Expo CLI, Metro, TypeScript, Jest, and asset scripts |
| Package manager | npm | `11.13.0` | Locked dependency installation and audits |
| Version control | Git | `2.54.0` | Worktree inspection and whitespace checks |
| Supported Android Java | Eclipse Temurin | `C:\Users\Kim Chim\AppData\Local\MoneyMap\toolchains\temurin-21-20260801155311\jdk-21.0.12+8` | Task-local Gradle runtime; global Java 25 remains unchanged |
| Android SDK | Android SDK | `B:\Users\Kim Chim\AppData\Local\Android\Sdk` | ADB 37, platform/build tools, NDK, API 35 image, and AVD tools |
| Hypervisor | Windows Hypervisor Platform | `WHPX(10.0.19045) is installed and usable` | Hardware VM acceleration |
| Android runtime | Google Android Emulator | `35.6.11.0`, build `13610412` | Compatible native emulator binary for this host |
| Android virtual device | Google APIs x86_64 AVD | `MoneyMap_VSCode_API_35`, Android 15/API 35 | Local application runtime at `emulator-5554` |
| Editor | Visual Studio Code | `1.131.0` | Tasks, debugger, source editing, and terminal workflow |
| Editor integration | Microsoft React Native Tools | `msjsdiag.vscode-react-native@1.13.0` | React Native logs, commands, packager state, and Hermes attach |
| Design source | Figma Desktop and connected Figma tooling | Approved file `JeEeOG1jZ0B72pA8gf7fMk` | Existing UI fidelity implementation |

## Root-cause investigation

The initial claim that firmware virtualization was disabled was incorrect. Current evidence shows a running Windows hypervisor, an operational WHPX accelerator, an Intel i7-10875H with EPT-capable virtualization, 64 GB RAM, and more than 30 GB free memory during boot.

The following controlled comparisons were performed:

| Test | Result | Conclusion |
|---|---|---|
| Existing and fresh API 35 AVD | Both stalled or exited with `emulator-5554 offline` | AVD profile/user data was not the cause |
| Clean reinstall of API 35 Google APIs x86_64 revision 9 | Same failure | System-image corruption was not the cause |
| Host, software, and SwiftShader graphics; Vulkan disabled | Same failure | GPU backend and overlay layers were not the cause |
| WHPX and `-accel off` | Both failed to boot with emulator 37 | Acceleration selection alone was not the cause |
| API 37.1 PS16K image | Same WHPX-stage failure | Android 15 guest image was not uniquely responsible |
| Emulator 36.6.11 and 37.1.11 | Both failed on this host | Newer emulator generation is incompatible with this Windows/CPU state |
| Official Emulator 35.6.11 archive, verified SHA-256 | Booted to Android 15; ADB online; `sys.boot_completed=1` | Stable compatibility path confirmed |

Docker Desktop/WSL and two long-running MetroDrip containers were detected but deliberately left running and unchanged. The compatible Android Emulator coexists with them. BlueStacks processes and its ADB endpoint were absent throughout the final boot, build, install, and runtime verification.

## Repairs and installations

- Installed Microsoft React Native Tools 1.13.0 through the VS Code CLI.
- Created the fresh official AVD `MoneyMap_VSCode_API_35` from the API 35 Google APIs x86_64 image.
- Reinstalled the API 35 system image from Android SDK Manager and validated its required image/kernel/package files.
- Downloaded Google Android Emulator 35.6.11 from the official archive and verified SHA-256 `0865071aecf3d90a5b967cb6cb0cd48bea0a58a26ef4953b32037671c129b7e9` before extraction.
- Moved the duplicate SDK package `emulator.backup` and original image revision into `B:\Users\Kim Chim\AppData\Local\Android\Sdk-package-backups\20260801`; no package was irreversibly deleted.
- Added `.vscode` tasks/settings/debugger recommendations and the portable `scripts/android-emulator.ps1` workflow.
- Added a Gradle init script that isolates only Expo Constants' disposable generated assets when a stale `node_modules` ACL returns `EPERM`; application source and package contents are not rewritten.

## Runtime evidence

- AVD: `MoneyMap_VSCode_API_35`.
- ADB: `emulator-5554 device`.
- Guest: Android `15`, API `35`, model `sdk_gphone64_x86_64`.
- Boot property: `sys.boot_completed=1`.
- APK streamed install: `Success`.
- Foreground application: `com.example.financetracker/.MainActivity`.
- Live accessibility hierarchy: Total Balance, Spending by Category, Budgets, Recent Transactions, Add transaction, Home, History, and Settings.
- Runtime error scan: zero `FATAL EXCEPTION`, fatal `AndroidRuntime`, `ReactNativeJS Error`, or missing-script matches after the final VS Code task launch.
- Full VS Code task: emulator reuse/boot check → Metro readiness → Gradle `BUILD SUCCESSFUL` → APK install → dev-client deep link → Android process confirmation.

## Workspace commands

| VS Code task | Purpose |
|---|---|
| `MoneyMap: Run on Android emulator` | Default build task; boots, bundles, builds, installs, and launches |
| `MoneyMap: Quick launch installed build` | Reuses the installed native client for JavaScript/UI iterations |
| `MoneyMap: Start Android emulator` | Boots only the official MoneyMap AVD |
| `MoneyMap: Android environment status` | Reports resolved SDK, emulator, JDK, ADB, Metro, and WHPX state |
| `MoneyMap: Stop Android emulator` | Requests a graceful `adb emu kill` for `emulator-5554` only |

## Security and isolation notes

- SDK/JDK/emulator variables are scoped to the VS Code task process; global Java 25 and unrelated project tooling remain unchanged.
- ADB commands always include `-s emulator-5554`, preventing accidental installation to BlueStacks, a physical phone, or another emulator.
- Metro binds to localhost and reaches the guest through `adb reverse`; no tunnel is opened.
- The script reads the Expo package and slug from `app.json`; it does not embed secrets or transmit financial data.
- The compatibility emulator is an official Google archive whose checksum was verified before execution.
