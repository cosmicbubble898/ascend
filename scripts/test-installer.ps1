[CmdletBinding()]
param(
    [string]$InstallerPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
    $InstallerPath = Join-Path $projectRoot "out\nsis\Ascend-Setup-0.0.0-x64.exe"
}
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\Ascend"
$installedExecutable = Join-Path $installRoot "Ascend.exe"
$uninstaller = Join-Path $installRoot "Uninstall Ascend.exe"
$updaterRoot = Join-Path $env:LOCALAPPDATA "ascend-updater"
$shortcutPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Ascend.lnk"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "Ascend.lnk"
$publicDesktopShortcut = Join-Path $env:PUBLIC "Desktop\Ascend.lnk"
$proofRoot = Join-Path $projectRoot "runtime\installer-proof"
$smokeRoot = Join-Path $projectRoot "runtime\installer-smoke"
$runId = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$runRoot = Join-Path $smokeRoot $runId
$unicodeSourceRoot = Join-Path $runRoot "source path Ünicode"
$installerCopy = Join-Path $unicodeSourceRoot "Ascend Setup.exe"
$resultPath = Join-Path $runRoot "result.json"
$syntheticProfileRoot = Join-Path $env:APPDATA "Ascend"
$syntheticMarker = Join-Path $syntheticProfileRoot "installer-proof-$runId.txt"
$failures = [System.Collections.Generic.List[string]]::new()
$defenderPlatformRoot = Join-Path $env:ProgramData "Microsoft\Windows Defender\Platform"
$defenderCommand = $null
if (Test-Path -LiteralPath $defenderPlatformRoot -PathType Container) {
    $latestDefenderPlatform = Get-ChildItem -LiteralPath $defenderPlatformRoot -Directory |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($null -ne $latestDefenderPlatform) {
        $candidateDefenderCommand = Join-Path $latestDefenderPlatform.FullName "MpCmdRun.exe"
        if (Test-Path -LiteralPath $candidateDefenderCommand -PathType Leaf) {
            $defenderCommand = $candidateDefenderCommand
        }
    }
}

function Wait-ForCondition {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$Condition,

        [int]$TimeoutSeconds = 30
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if (& $Condition) {
            return $true
        }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    return $false
}

function Get-AscendProcesses {
    @(Get-CimInstance Win32_Process | Where-Object {
        $_.ExecutablePath -eq $installedExecutable
    })
}

function Invoke-BoundedProcess {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [string[]]$ArgumentList = @(),

        [int]$TimeoutSeconds = 240
    )

    $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -PassThru
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        try {
            $process.Kill()
        }
        catch {
            Write-Warning "Could not stop timed-out process $($process.Id): $($_.Exception.Message)"
        }
        throw "Process timed out: $FilePath"
    }
    if ($process.ExitCode -ne 0) {
        throw "Process failed with exit code $($process.ExitCode): $FilePath"
    }
}

function Invoke-DefenderScan {
    param(
        [Parameter(Mandatory)]
        [string]$Target,

        [Parameter(Mandatory)]
        [string]$EvidenceName
    )

    if ($null -eq $defenderCommand) {
        throw "Microsoft Defender command-line scanner is unavailable."
    }
    $scanOutput = & $defenderCommand -Scan -ScanType 3 -File $Target -DisableRemediation 2>&1
    $scanExitCode = $LASTEXITCODE
    $scanOutput | Set-Content -LiteralPath (Join-Path $runRoot "$EvidenceName-defender.txt")
    if ($scanExitCode -ne 0) {
        throw "Microsoft Defender scan failed for $Target with exit code $scanExitCode."
    }
}

function Get-UninstallEntries {
    $root = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
    if (-not (Test-Path -LiteralPath $root)) {
        return @()
    }
    @(Get-ChildItem -LiteralPath $root | ForEach-Object {
        $item = Get-ItemProperty -LiteralPath $_.PSPath
        if ($item.DisplayName -like "Ascend*") {
            [PSCustomObject]@{
                Key = $_.PSChildName
                DisplayName = $item.DisplayName
                InstallLocation = $item.InstallLocation
                UninstallString = $item.UninstallString
            }
        }
    })
}

function Assert-NoConflictingInstall {
    if (@(Get-AscendProcesses).Count -ne 0) {
        throw "An installed Ascend process is already running."
    }
    foreach ($path in @($installRoot, $updaterRoot, $shortcutPath)) {
        if (Test-Path -LiteralPath $path) {
            throw "Conflicting NSIS proof state already exists: $path"
        }
    }
    if (@(Get-UninstallEntries).Count -ne 0) {
        throw "An Ascend uninstall registry entry already exists."
    }
}

function Assert-InstalledPayloadMatchesManifest {
    $latestProof = Get-ChildItem -LiteralPath $proofRoot -Directory |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($null -eq $latestProof) {
        throw "No prepackaged proof manifest is available."
    }
    $manifestPath = Join-Path $latestProof.FullName "prepackaged-before.json"
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    foreach ($record in $manifest) {
        $relativeWindowsPath = $record.path.Replace("/", "\")
        $installedPath = Join-Path $installRoot $relativeWindowsPath
        if (-not (Test-Path -LiteralPath $installedPath -PathType Leaf)) {
            throw "Installed payload is missing: $($record.path)"
        }
        $installedHash = (Get-FileHash -LiteralPath $installedPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($installedHash -ne $record.sha256) {
            throw "Installed payload hash differs: $($record.path)"
        }
    }
    return $manifestPath
}

function Assert-NoUnapprovedPersistence {
    if (Test-Path -LiteralPath $desktopShortcut -PathType Leaf) {
        $failures.Add("Desktop shortcut was created: $desktopShortcut")
    }
    if (Test-Path -LiteralPath $publicDesktopShortcut -PathType Leaf) {
        $failures.Add("Public desktop shortcut was created: $publicDesktopShortcut")
    }
    if (@(Get-Service | Where-Object { $_.Name -like "*Ascend*" -or $_.DisplayName -like "*Ascend*" }).Count -ne 0) {
        $failures.Add("An Ascend service was created.")
    }
    if (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue) {
        if (@(Get-ScheduledTask | Where-Object { $_.TaskName -like "*Ascend*" -or $_.TaskPath -like "*Ascend*" }).Count -ne 0) {
            $failures.Add("An Ascend scheduled task was created.")
        }
    }
    foreach ($runKey in @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
    )) {
        if (Test-Path -LiteralPath $runKey) {
            $runProperties = Get-ItemProperty -LiteralPath $runKey
            foreach ($property in $runProperties.PSObject.Properties) {
                if ($property.Value -is [string] -and $property.Value -like "*Ascend*") {
                    $failures.Add("An Ascend startup registry value was created: $runKey\$($property.Name)")
                }
            }
        }
    }
}

function Invoke-ShortcutLaunchAndClose {
    Start-Process -FilePath $shortcutPath | Out-Null
    if (-not (Wait-ForCondition -TimeoutSeconds 30 -Condition { @(Get-AscendProcesses).Count -gt 0 })) {
        throw "The Start Menu shortcut did not launch Ascend."
    }

    $mainProcess = $null
    $windowDeadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        foreach ($candidate in Get-AscendProcesses) {
            $process = Get-Process -Id $candidate.ProcessId -ErrorAction SilentlyContinue
            if ($null -ne $process) {
                $process.Refresh()
                if ($process.MainWindowHandle -ne 0) {
                    $mainProcess = $process
                    break
                }
            }
        }
        if ($null -eq $mainProcess) {
            Start-Sleep -Milliseconds 250
        }
    } while ($null -eq $mainProcess -and [DateTime]::UtcNow -lt $windowDeadline)

    if ($null -eq $mainProcess) {
        throw "Ascend launched without a visible main window."
    }
    if (-not $mainProcess.CloseMainWindow()) {
        throw "WM_CLOSE could not be sent to the Ascend window."
    }
    if (-not (Wait-ForCondition -TimeoutSeconds 30 -Condition { @(Get-AscendProcesses).Count -eq 0 })) {
        foreach ($remaining in Get-AscendProcesses) {
            Stop-Process -Id $remaining.ProcessId -Force -ErrorAction SilentlyContinue
        }
        throw "Ascend left orphan processes after WM_CLOSE."
    }
}

function Invoke-SilentInstall {
    Invoke-BoundedProcess -FilePath $installerCopy -ArgumentList @("/S")
    if (-not (Wait-ForCondition -TimeoutSeconds 30 -Condition { Test-Path -LiteralPath $installedExecutable -PathType Leaf })) {
        throw "The current-user install did not create Ascend.exe."
    }
}

function Invoke-SilentUninstall {
    if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        throw "The installed uninstaller is missing."
    }
    Invoke-BoundedProcess -FilePath $uninstaller -ArgumentList @("/S")
    [void](Wait-ForCondition -TimeoutSeconds 60 -Condition { -not (Test-Path -LiteralPath $installRoot) })
}

Assert-NoConflictingInstall
New-Item -ItemType Directory -Path $unicodeSourceRoot -Force | Out-Null
Copy-Item -LiteralPath $installer -Destination $installerCopy
if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $installerCopy -Algorithm SHA256).Hash) {
    throw "The Unicode-path installer copy differs from the reviewed artifact."
}

$result = [ordered]@{
    runId = $runId
    installer = $installer
    installerSha256 = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
    unicodeInstallerCopy = $installerCopy
    currentIntegrity = (whoami /groups | Select-String -Pattern "Mandatory Label\\(High|Medium) Mandatory Level" | ForEach-Object { $_.Line.Trim() })
    installRoot = $installRoot
    packageManifest = $null
    shortcutTarget = $null
    shortcutArguments = $null
    sidecarVersion = $null
    syntheticMarkerRetained = $false
    reinstallSucceeded = $false
    updaterResidue = @()
    defenderStatus = $null
    failures = @()
}

try {
    $defenderStatus = Get-MpComputerStatus
    $result.defenderStatus = [ordered]@{
        antivirusEnabled = $defenderStatus.AntivirusEnabled
        realTimeProtectionEnabled = $defenderStatus.RealTimeProtectionEnabled
        engineVersion = $defenderStatus.AMEngineVersion
        signatureVersion = $defenderStatus.AntivirusSignatureVersion
        signatureLastUpdated = $defenderStatus.AntivirusSignatureLastUpdated
    }
    Invoke-DefenderScan -Target $installerCopy -EvidenceName "installer"
    Invoke-DefenderScan -Target (Join-Path $projectRoot "out\Ascend-win32-x64") -EvidenceName "prepackaged"

    Invoke-SilentInstall
    $result.packageManifest = Assert-InstalledPayloadMatchesManifest

    New-Item -ItemType Directory -Path $syntheticProfileRoot -Force | Out-Null
    Set-Content -LiteralPath $syntheticMarker -Value "Synthetic installer proof only: $runId"

    if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) {
        throw "The Start Menu shortcut is missing."
    }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $result.shortcutTarget = $shortcut.TargetPath
    $result.shortcutArguments = $shortcut.Arguments
    if ($shortcut.TargetPath -ne $installedExecutable -or -not [string]::IsNullOrWhiteSpace($shortcut.Arguments)) {
        throw "The Start Menu shortcut does not point directly to Ascend.exe."
    }

    Assert-NoUnapprovedPersistence
    Invoke-ShortcutLaunchAndClose
    Invoke-ShortcutLaunchAndClose

    $sidecar = Join-Path $installRoot "resources\ascend-engine\ascend-engine.exe"
    $result.sidecarVersion = (& $sidecar --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $result.sidecarVersion -ne "Ascend engine 0.0.0") {
        throw "The installed sidecar version smoke failed."
    }
    Invoke-DefenderScan -Target $installRoot -EvidenceName "installed-tree"

    Invoke-SilentUninstall
    if (Test-Path -LiteralPath $installRoot) {
        $failures.Add("The install directory remains after uninstall: $installRoot")
    }
    if (Test-Path -LiteralPath $shortcutPath) {
        $failures.Add("The Start Menu shortcut remains after uninstall.")
    }
    if (@(Get-UninstallEntries).Count -ne 0) {
        $failures.Add("The uninstall registry entry remains after uninstall.")
    }
    $result.syntheticMarkerRetained = Test-Path -LiteralPath $syntheticMarker -PathType Leaf
    if (-not $result.syntheticMarkerRetained) {
        $failures.Add("Synthetic profile data was deleted by uninstall.")
    }
    if (Test-Path -LiteralPath $updaterRoot) {
        $result.updaterResidue = @(Get-ChildItem -LiteralPath $updaterRoot -Recurse -File | ForEach-Object { $_.FullName })
        $failures.Add("The installer left executable updater-cache residue: $updaterRoot")
    }

    Invoke-SilentInstall
    $result.reinstallSucceeded = Test-Path -LiteralPath $installedExecutable -PathType Leaf
    Invoke-SilentUninstall
    if (Test-Path -LiteralPath $installRoot) {
        $failures.Add("The install directory remains after the reinstall/uninstall cycle.")
    }
}
catch {
    $failures.Add($_.Exception.Message)
}
finally {
    foreach ($remaining in Get-AscendProcesses) {
        Stop-Process -Id $remaining.ProcessId -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $syntheticMarker -PathType Leaf) {
        Remove-Item -LiteralPath $syntheticMarker -Force
    }
    $result.failures = @($failures)
    $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultPath
    Write-Host "Installer smoke evidence: $resultPath"
}

if ($failures.Count -ne 0) {
    throw "Installer smoke failed:`n$($failures -join "`n")"
}

Write-Host "Installer install/launch/uninstall/reinstall smoke passed."
