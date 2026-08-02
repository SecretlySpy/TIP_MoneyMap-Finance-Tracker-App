# Local Environment Audit — Linux Mint 22.3 — 2026-08-02

## Final development path

```text
Terminal / VS Code
  ├─ nvm Node 22.23.2 + npm 10.9.8
  ├─ Temurin JDK 21.0.12 (user-space)
  ├─ Android SDK ~/Android/Sdk
  │    ├─ platform-tools 37.0.1, platform 35, build-tools 35.0.0
  │    ├─ NDK 27.1.12297006, CMake 3.22.1, Emulator 37.1.11
  │    └─ AVD MoneyMap_VSCode_API_35 (google_apis/x86_64, Pixel 6)
  ├─ npm ci → 949 packages
  ├─ npm test → 11 suites / 44 passed
  ├─ npx expo-doctor → 18/18
  └─ npx expo export --platform android → Hermes bundle OK
```

Expo Go is not supported (OP-SQLite + SQLCipher native). First device/emulator launch needs `npm run android` or an EAS development APK.

## Tools installed or verified

| Capability | Tool | Verified value / path |
|---|---|---|
| OS | Linux Mint | 22.3 (Zena), kernel 6.8.0-124-generic, x86_64 |
| Git | git | 2.43.0 |
| Node | nvm + Node 22 LTS | `v22.23.2` at `~/.nvm/versions/node/v22.23.2` |
| npm | bundled | `10.9.8` |
| JDK | Eclipse Temurin 21 | `~/.local/share/MoneyMap/toolchains/temurin-21` (`21.0.12+8`) |
| Android SDK | Google cmdline-tools | `~/Android/Sdk` |
| Emulator accel | KVM | `/dev/kvm` usable (ACL for user); `emulator -accel-check` OK |
| AVD | Google APIs x86_64 | `MoneyMap_VSCode_API_35` |
| Editor | VS Code | 1.131.0 (`/snap/bin/code`) |
| RN extension | React Native Tools | `msjsdiag.vscode-react-native` (already installed) |
| Build host tools | gcc/g++/make/python3/libsqlite3 | present (required for better-sqlite3/sharp) |

## Issues diagnosed and resolved

| Symptom | Cause | Resolution |
|---|---|---|
| `node` / `npm` missing | Fresh clone host had no JS runtime | Installed nvm + Node 22.23.2 |
| `java` missing; only OpenJDK EA 26 under `~/.jdks` | No JDK 21 on PATH; EA 26 unsafe for Gradle | Installed user-space Temurin 21; exported `JAVA_HOME` |
| `sudo apt-get` blocked | Interactive password required | Used user-space toolchains (nvm, Temurin tarball, SDK zip) instead of apt |
| `ANDROID_HOME` unset / no SDK | Never installed | Installed cmdline-tools + platform 35 stack under `~/Android/Sdk` |
| No AVD | Fresh SDK | Created `MoneyMap_VSCode_API_35` from API 35 Google APIs x86_64 |
| `node_modules` missing | Clean checkout | `npm ci` (exit 0) |
| `.env` missing | gitignored | Copied from `.env.example` |
| README / guide called `npm run typecheck` | Stale after TS→JS migration | Docs updated; script does not exist |
| Peer warning `react-reconciler` wants React 19.2 | Nested test-renderer peer vs Expo-pinned React 19.1.0 | Non-blocking; left lockfile unchanged |
| npm audit moderate (Expo transitive) | Upstream advisories in config/manifest chain | No high severity with `--omit=dev`; deferred to Expo SDK upgrade |

## Verification evidence

- `npm test`: **44/44 passed** (~6s).
- `npx expo-doctor`: **18/18 checks passed**.
- `npx expo export --platform android --clear`: Android Hermes bundle **3.91 MB**, exit 0.
- `better-sqlite3` smoke: `SELECT 1` → `{ ok: 1 }`.
- Env persistence: `~/.moneymap-env.sh` sourced from `~/.bashrc`.

## Remaining optional host steps

1. `sudo usermod -aG kvm $USER` if ACL on `/dev/kvm` is removed later (then re-login).
2. Full native first build: `npm run android` with emulator running (Gradle + NDK compile; several minutes).
3. EAS: `npx eas-cli init` to replace placeholder `extra.eas.projectId` in `app.json` before cloud builds.
4. Physical device: enable USB debugging; optional udev rules for vendor IDs.

## Security and isolation notes

- Toolchains live under the user home; system-wide Java EA 26 was not used for Gradle.
- `.env` is gitignored; `GEMINI_API_KEY` unused until Smart Tips networking.
- SQLCipher keys are device-generated into SecureStore, never from `.env`.
- Do not commit keystores, EAS secrets, or `android/`/`ios/` CNG output.
EOF
