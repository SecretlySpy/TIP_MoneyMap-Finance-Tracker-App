[CmdletBinding()]
param(
    # Select the development operation exposed by the VS Code tasks.
    [ValidateSet('Status', 'Start', 'Build', 'Install', 'Launch', 'Run', 'Stop')]
    [string]$Action = 'Run',

    # Keep the project AVD name explicit so the script never selects BlueStacks or an unrelated device.
    [string]$AvdName = 'MoneyMap_VSCode_API_35',

    # Pin the ADB serial used by the MoneyMap virtual device.
    [string]$Serial = 'emulator-5554',

    # Allow enough time for a first cold boot while still failing with a useful error.
    [ValidateRange(30, 600)]
    [int]$BootTimeoutSeconds = 240
)

# Turn scripting mistakes into immediate failures instead of partial environment changes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Resolve every relative project path from this script rather than from the caller's terminal.
$WorkspaceRoot = Split-Path -Parent $PSScriptRoot

function Write-MoneyMapStep {
    param([Parameter(Mandatory = $true)][string]$Message)

    # Prefix task output so emulator, Gradle, and Metro messages are easy to distinguish.
    Write-Host "[MoneyMap] $Message" -ForegroundColor Cyan
}

function Resolve-AndroidSdk {
    # Preserve candidate order while allowing portable discovery across machines and drive letters.
    $candidates = New-Object 'System.Collections.Generic.List[string]'

    # Respect standard Android environment variables when a developer has already configured them.
    if (-not [string]::IsNullOrWhiteSpace($env:ANDROID_SDK_ROOT)) {
        $candidates.Add($env:ANDROID_SDK_ROOT)
    }
    if (-not [string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
        $candidates.Add($env:ANDROID_HOME)
    }

    # Reuse a generated Gradle SDK location when Expo prebuild has already created it.
    $localProperties = Join-Path $WorkspaceRoot 'android\local.properties'
    if (Test-Path -LiteralPath $localProperties) {
        $sdkProperty = Get-Content -LiteralPath $localProperties | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
        if ($sdkProperty -match '^sdk\.dir=(.+)$') {
            $decodedPath = $Matches[1].Trim().Replace('\:', ':').Replace('\\', '\')
            $candidates.Add($decodedPath)
        }
    }

    # Check the conventional per-user SDK location.
    if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $candidates.Add((Join-Path $env:LOCALAPPDATA 'Android\Sdk'))
    }

    # Scan fixed drive roots because this workstation intentionally stores its SDK on drive B:.
    foreach ($drive in Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Za-z]:\\$' }) {
        $candidates.Add((Join-Path $drive.Root "Users\$env:USERNAME\AppData\Local\Android\Sdk"))
    }

    # Accept only a directory containing the ADB binary required by every supported action.
    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath (Join-Path $candidate 'platform-tools\adb.exe'))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'Android SDK not found. Set ANDROID_SDK_ROOT or install the Android SDK platform tools.'
}

function Resolve-CompatibleJavaHome {
    # Gather JDK candidates without changing the machine-wide JAVA_HOME value.
    $candidates = New-Object 'System.Collections.Generic.List[string]'

    # Prefer MoneyMap's verified JDK 21 toolchain when it exists on this workstation.
    $toolchainRoot = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $null } else { Join-Path $env:LOCALAPPDATA 'MoneyMap\toolchains' }
    if ($toolchainRoot -and (Test-Path -LiteralPath $toolchainRoot)) {
        Get-ChildItem -LiteralPath $toolchainRoot -Directory -Filter 'temurin-21*' |
            Sort-Object LastWriteTime -Descending |
            ForEach-Object {
                # Accept both a direct JDK directory and the vendor archive's one-level nested layout.
                $candidates.Add($_.FullName)
                Get-ChildItem -LiteralPath $_.FullName -Directory |
                    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe') } |
                    ForEach-Object { $candidates.Add($_.FullName) }
            }
    }

    # Reuse the developer's configured Java when it is compatible with this Gradle stack.
    if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        $candidates.Add($env:JAVA_HOME)
    }

    # Android Studio bundles a supported JetBrains runtime on standard installations.
    $candidates.Add('C:\Program Files\Android\Android Studio\jbr')

    # Select JDK 17 through 21; Java 25 is deliberately rejected by the current Gradle toolchain.
    foreach ($candidate in $candidates | Select-Object -Unique) {
        $java = Join-Path $candidate 'bin\java.exe'
        if (Test-Path -LiteralPath $java) {
            # Capture Java's stderr-based version output without converting it into a PowerShell error record.
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = $java
            $startInfo.Arguments = '-version'
            $startInfo.UseShellExecute = $false
            $startInfo.CreateNoWindow = $true
            $startInfo.RedirectStandardOutput = $true
            $startInfo.RedirectStandardError = $true
            $javaProcess = [System.Diagnostics.Process]::Start($startInfo)
            $versionOutput = $javaProcess.StandardError.ReadToEnd() + $javaProcess.StandardOutput.ReadToEnd()
            $javaProcess.WaitForExit()
            $versionLine = ($versionOutput -split "`r?`n" | Select-Object -First 1) -join ''
            if ($versionLine -match 'version "(\d+)') {
                $major = [int]$Matches[1]
                if ($major -ge 17 -and $major -le 21) {
                    return (Resolve-Path -LiteralPath $candidate).Path
                }
            }
        }
    }

    throw 'A compatible JDK was not found. Install JDK 21 or set JAVA_HOME to JDK 17-21.'
}

function Resolve-EmulatorExecutable {
    param([Parameter(Mandatory = $true)][string]$AndroidSdk)

    # Let advanced users override the emulator without editing the workspace.
    $candidates = New-Object 'System.Collections.Generic.List[string]'
    if (-not [string]::IsNullOrWhiteSpace($env:MONEYMAP_EMULATOR_EXE)) {
        $candidates.Add($env:MONEYMAP_EMULATOR_EXE)
    }

    # Prefer the verified Google archive build that boots reliably on this Windows 10/i7 host.
    if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $candidates.Add((Join-Path $env:LOCALAPPDATA 'MoneyMap\android-emulator\35.6.11\emulator\emulator.exe'))
    }

    # Fall back to the SDK-managed emulator for teammates whose current release is compatible.
    $candidates.Add((Join-Path $AndroidSdk 'emulator\emulator.exe'))

    # Return the first complete emulator installation.
    foreach ($candidate in $candidates | Select-Object -Unique) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'Android Emulator not found. Install it with Android SDK Manager.'
}

function Get-AdbDeviceState {
    param(
        [Parameter(Mandatory = $true)][string]$Adb,
        [Parameter(Mandatory = $true)][string]$DeviceSerial
    )

    # Parse only the requested official emulator serial and ignore every unrelated ADB endpoint.
    $escapedSerial = [regex]::Escape($DeviceSerial)
    $deviceLine = & $Adb devices 2>$null | Where-Object { $_ -match "^$escapedSerial\s+" } | Select-Object -First 1
    if ($deviceLine -match "^$escapedSerial\s+(\S+)") {
        return $Matches[1]
    }

    return $null
}

function Wait-ForAndroidBoot {
    param(
        [Parameter(Mandatory = $true)][string]$Adb,
        [Parameter(Mandatory = $true)][string]$DeviceSerial,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds
    )

    # Poll bounded state rather than sleeping for a fixed and unreliable boot duration.
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $state = Get-AdbDeviceState -Adb $Adb -DeviceSerial $DeviceSerial
        if ($state -eq 'device') {
            $bootCompleted = ((& $Adb -s $DeviceSerial shell getprop sys.boot_completed 2>$null) -join '').Trim()
            if ($bootCompleted -eq '1') {
                Write-MoneyMapStep "Android finished booting on $DeviceSerial."
                return
            }
        }

        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)

    throw "Android emulator $DeviceSerial did not finish booting within $TimeoutSeconds seconds. Run the Status task for diagnostics."
}

function Start-MoneyMapEmulator {
    param(
        [Parameter(Mandatory = $true)][string]$AndroidSdk,
        [Parameter(Mandatory = $true)][string]$Emulator,
        [Parameter(Mandatory = $true)][string]$Adb,
        [Parameter(Mandatory = $true)][string]$DeviceSerial,
        [Parameter(Mandatory = $true)][string]$DeviceName,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds
    )

    # Export SDK variables only to this task and its child processes.
    $env:ANDROID_HOME = $AndroidSdk
    $env:ANDROID_SDK_ROOT = $AndroidSdk

    # Reuse a running official emulator instead of launching a duplicate virtual device.
    $existingState = Get-AdbDeviceState -Adb $Adb -DeviceSerial $DeviceSerial
    if ($existingState) {
        Write-MoneyMapStep "Reusing $DeviceSerial (state: $existingState)."
        Wait-ForAndroidBoot -Adb $Adb -DeviceSerial $DeviceSerial -TimeoutSeconds $TimeoutSeconds
        return
    }

    # Fail early when the configured AVD was removed or renamed.
    $availableAvds = @(& $Emulator -list-avds 2>$null)
    if ($availableAvds -notcontains $DeviceName) {
        throw "AVD '$DeviceName' is missing. Create it with the API 35 Google APIs x86_64 image."
    }

    # Select the software-renderer spelling supported by the resolved emulator generation.
    $versionLine = ((& $Emulator -version 2>&1 | Select-Object -First 1) -join '')
    $gpuMode = if ($versionLine -match 'version (?:2\d|3[0-5])\.') { 'swiftshader_indirect' } else { 'software' }

    # Launch a visible, cold-booted Google emulator window and leave BlueStacks untouched.
    $arguments = @(
        '-avd', $DeviceName,
        '-gpu', $gpuMode,
        '-feature', '-Vulkan',
        '-no-snapshot',
        '-no-boot-anim',
        '-no-audio'
    )
    $process = Start-Process -FilePath $Emulator -ArgumentList $arguments -WorkingDirectory (Split-Path -Parent $Emulator) -PassThru
    Write-MoneyMapStep "Started $DeviceName with emulator PID $($process.Id) using $versionLine."

    # Wait until Android reports a completed boot before Gradle or ADB touches the device.
    Wait-ForAndroidBoot -Adb $Adb -DeviceSerial $DeviceSerial -TimeoutSeconds $TimeoutSeconds
}

function Test-MetroServer {
    try {
        # Require Metro's status payload so another process on port 8081 is not mistaken for the bundler.
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 3
        $content = $response.Content
        if ($content -is [byte[]]) {
            $content = [System.Text.Encoding]::UTF8.GetString($content)
        }
        return ([string]$content).Contains('packager-status:running')
    }
    catch {
        return $false
    }
}

function Ensure-MetroServer {
    # Keep an already-running project bundler so Fast Refresh state survives repeated launches.
    if (Test-MetroServer) {
        Write-MoneyMapStep 'Metro is already running on port 8081.'
        return
    }

    # Store background Metro logs under Expo's ignored working directory.
    $expoDirectory = Join-Path $WorkspaceRoot '.expo'
    New-Item -ItemType Directory -Path $expoDirectory -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $standardOutput = Join-Path $expoDirectory "metro-vscode-$stamp.out.log"
    $standardError = Join-Path $expoDirectory "metro-vscode-$stamp.err.log"
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source

    # Run Metro as a hidden helper while the official emulator remains visible beside VS Code.
    Start-Process -FilePath $npm `
        -ArgumentList @('run', 'start', '--', '--localhost') `
        -WorkingDirectory $WorkspaceRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $standardOutput `
        -RedirectStandardError $standardError | Out-Null
    Write-MoneyMapStep "Starting Metro; logs: $standardOutput"

    # Wait for the HTTP readiness contract rather than guessing when bundling is complete.
    $deadline = (Get-Date).AddSeconds(90)
    do {
        if (Test-MetroServer) {
            Write-MoneyMapStep 'Metro is ready on port 8081.'
            return
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    throw "Metro did not become ready. Inspect '$standardOutput' and '$standardError'."
}

function Invoke-AndroidBuild {
    param([Parameter(Mandatory = $true)][string]$AndroidSdk)

    # Resolve a supported Java runtime without modifying the user's global Java 25 setup.
    $javaHome = Resolve-CompatibleJavaHome
    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $AndroidSdk
    $env:ANDROID_SDK_ROOT = $AndroidSdk
    $env:ANDROID_SERIAL = $Serial
    $env:NODE_ENV = 'development'
    $env:Path = "$javaHome\bin;$AndroidSdk\platform-tools;$env:Path"
    Write-MoneyMapStep "Building with JDK at $javaHome."

    # Generate ignored native Android sources only when this checkout does not have them yet.
    $gradleWrapper = Join-Path $WorkspaceRoot 'android\gradlew.bat'
    if (-not (Test-Path -LiteralPath $gradleWrapper)) {
        $npx = (Get-Command npx.cmd -ErrorAction Stop).Source
        Write-MoneyMapStep 'Generating the Android development-build project with Expo prebuild.'
        & $npx expo prebuild --platform android | ForEach-Object { Write-Host $_ }
        if ($LASTEXITCODE -ne 0) {
            throw "Expo prebuild failed with exit code $LASTEXITCODE."
        }
    }

    # Build only the x86_64 ABI used by the local API 35 emulator for a faster feedback loop.
    Push-Location (Join-Path $WorkspaceRoot 'android')
    try {
        $gradleInitScript = Join-Path $WorkspaceRoot 'scripts\moneymap-gradle.init.gradle'
        & $gradleWrapper ':app:assembleDebug' '-PreactNativeArchitectures=x86_64' '--console=plain' '--init-script' $gradleInitScript | ForEach-Object { Write-Host $_ }
        $gradleExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($gradleExitCode -ne 0) {
        throw "Gradle debug build failed with exit code $gradleExitCode."
    }

    # Return the exact artifact consumed by the install action.
    $apk = Join-Path $WorkspaceRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path -LiteralPath $apk)) {
        throw "Gradle succeeded but the debug APK is missing at '$apk'."
    }
    Write-MoneyMapStep "Debug APK ready: $apk"
    return $apk
}

function Resolve-DebugApk {
    # Reuse the latest local debug artifact for the quick install action.
    $apk = Join-Path $WorkspaceRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path -LiteralPath $apk)) {
        throw "Debug APK not found at '$apk'. Run the full Run task first."
    }
    return $apk
}

function Install-DebugApk {
    param(
        [Parameter(Mandatory = $true)][string]$Adb,
        [Parameter(Mandatory = $true)][string]$DeviceSerial,
        [Parameter(Mandatory = $true)][string]$Apk
    )

    # Stream a replace install to the one explicitly selected official emulator.
    & $Adb -s $DeviceSerial install -r $Apk | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "ADB install failed with exit code $LASTEXITCODE."
    }
    Write-MoneyMapStep 'MoneyMap debug build installed successfully.'
}

function Open-MoneyMap {
    param(
        [Parameter(Mandatory = $true)][string]$Adb,
        [Parameter(Mandatory = $true)][string]$DeviceSerial
    )

    # Read package and slug values from the single Expo configuration source.
    $appConfig = Get-Content -LiteralPath (Join-Path $WorkspaceRoot 'app.json') -Raw | ConvertFrom-Json
    $packageName = [string]$appConfig.expo.android.package
    $developmentScheme = "exp+$([string]$appConfig.expo.slug)"
    $metroUrl = [System.Uri]::EscapeDataString('http://127.0.0.1:8081')
    $developmentUri = "${developmentScheme}://expo-development-client/?url=$metroUrl"

    # Route emulator localhost to the workstation Metro process over ADB only.
    & $Adb -s $DeviceSerial reverse tcp:8081 tcp:8081 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "ADB reverse failed with exit code $LASTEXITCODE."
    }

    # Restart the application and deep-link the development client directly to this project.
    & $Adb -s $DeviceSerial shell am force-stop $packageName | Out-Null
    & $Adb -s $DeviceSerial shell am start -a android.intent.action.VIEW -d $developmentUri | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "MoneyMap launch failed with exit code $LASTEXITCODE."
    }

    # Confirm that Android created a process before reporting success to VS Code.
    Start-Sleep -Seconds 4
    $applicationPid = ((& $Adb -s $DeviceSerial shell pidof $packageName 2>$null) -join '').Trim()
    if ([string]::IsNullOrWhiteSpace($applicationPid)) {
        throw 'MoneyMap did not create an Android process after launch.'
    }
    Write-MoneyMapStep "MoneyMap is running as Android PID $applicationPid."
}

function Show-EnvironmentStatus {
    param(
        [Parameter(Mandatory = $true)][string]$AndroidSdk,
        [Parameter(Mandatory = $true)][string]$Emulator,
        [Parameter(Mandatory = $true)][string]$Adb
    )

    # Report reproducible paths and live state without changing the environment.
    $emulatorVersion = ((& $Emulator -version 2>&1 | Select-Object -First 1) -join '')
    $javaHome = Resolve-CompatibleJavaHome
    $deviceState = Get-AdbDeviceState -Adb $Adb -DeviceSerial $Serial
    $bootCompleted = if ($deviceState -eq 'device') { ((& $Adb -s $Serial shell getprop sys.boot_completed 2>$null) -join '').Trim() } else { '0' }
    Write-MoneyMapStep "Android SDK: $AndroidSdk"
    Write-MoneyMapStep "Emulator: $Emulator"
    Write-MoneyMapStep "Emulator version: $emulatorVersion"
    Write-MoneyMapStep "JDK: $javaHome"
    Write-MoneyMapStep "AVD: $AvdName"
    Write-MoneyMapStep "ADB: $Serial state=$deviceState bootCompleted=$bootCompleted"
    Write-MoneyMapStep "Metro ready: $(Test-MetroServer)"

    # Use the current SDK probe, whose helper correctly quotes SDK paths containing spaces.
    $sdkEmulator = Join-Path $AndroidSdk 'emulator\emulator.exe'
    $accelerationProbe = if (Test-Path -LiteralPath $sdkEmulator) { $sdkEmulator } else { $Emulator }
    & $accelerationProbe -accel-check 2>&1 | ForEach-Object { Write-Host $_ }
}

function Stop-MoneyMapEmulator {
    param(
        [Parameter(Mandatory = $true)][string]$Adb,
        [Parameter(Mandatory = $true)][string]$DeviceSerial
    )

    # Request a graceful emulator shutdown and never terminate BlueStacks or unrelated VMs.
    $state = Get-AdbDeviceState -Adb $Adb -DeviceSerial $DeviceSerial
    if (-not $state) {
        Write-MoneyMapStep "$DeviceSerial is not running."
        return
    }
    & $Adb -s $DeviceSerial emu kill | ForEach-Object { Write-Host $_ }
    Write-MoneyMapStep "Shutdown requested for $DeviceSerial."
}

# Resolve shared tool paths once so every action uses the same SDK and ADB instance.
$androidSdk = Resolve-AndroidSdk
$adb = Join-Path $androidSdk 'platform-tools\adb.exe'
$emulator = Resolve-EmulatorExecutable -AndroidSdk $androidSdk

# Execute the smallest operation requested by VS Code or the command line.
switch ($Action) {
    'Status' {
        Show-EnvironmentStatus -AndroidSdk $androidSdk -Emulator $emulator -Adb $adb
    }
    'Start' {
        Start-MoneyMapEmulator -AndroidSdk $androidSdk -Emulator $emulator -Adb $adb -DeviceSerial $Serial -DeviceName $AvdName -TimeoutSeconds $BootTimeoutSeconds
    }
    'Build' {
        Invoke-AndroidBuild -AndroidSdk $androidSdk | Out-Null
    }
    'Install' {
        Start-MoneyMapEmulator -AndroidSdk $androidSdk -Emulator $emulator -Adb $adb -DeviceSerial $Serial -DeviceName $AvdName -TimeoutSeconds $BootTimeoutSeconds
        Install-DebugApk -Adb $adb -DeviceSerial $Serial -Apk (Resolve-DebugApk)
    }
    'Launch' {
        Start-MoneyMapEmulator -AndroidSdk $androidSdk -Emulator $emulator -Adb $adb -DeviceSerial $Serial -DeviceName $AvdName -TimeoutSeconds $BootTimeoutSeconds
        Ensure-MetroServer
        Open-MoneyMap -Adb $adb -DeviceSerial $Serial
    }
    'Run' {
        Start-MoneyMapEmulator -AndroidSdk $androidSdk -Emulator $emulator -Adb $adb -DeviceSerial $Serial -DeviceName $AvdName -TimeoutSeconds $BootTimeoutSeconds
        Ensure-MetroServer
        $apk = Invoke-AndroidBuild -AndroidSdk $androidSdk
        Install-DebugApk -Adb $adb -DeviceSerial $Serial -Apk $apk
        Open-MoneyMap -Adb $adb -DeviceSerial $Serial
    }
    'Stop' {
        Stop-MoneyMapEmulator -Adb $adb -DeviceSerial $Serial
    }
}
