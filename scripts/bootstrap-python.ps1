[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$uvVersion = "0.11.29"
$archiveName = "uv-x86_64-pc-windows-msvc.zip"
$archiveSha256 = "A047D55651BC3E0CA24595B25EC4CFCB10F9DCA9FB56514E661269B37D4FAE68"
$downloadUrl = "https://github.com/astral-sh/uv/releases/download/0.11.29/uv-x86_64-pc-windows-msvc.zip"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$toolsRoot = Join-Path $projectRoot ".tools"
$archivePath = Join-Path $toolsRoot "uv-x86_64-pc-windows-msvc-$uvVersion.zip"
$uvRoot = Join-Path $toolsRoot "uv-$uvVersion"
$uvExecutable = Join-Path $uvRoot "uv.exe"
$pythonInstallRoot = Join-Path $projectRoot "runtime\uv-python-0.11.29"
$uvCacheRoot = Join-Path $projectRoot "runtime\uv-cache-0.11.29"
$pythonEnvironmentRoot = Join-Path $projectRoot "runtime\python-env-0.11.29"
$pythonExecutable = Join-Path $pythonEnvironmentRoot "Scripts\python.exe"

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archivePath
}

$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
if ($actualHash -ne $archiveSha256) {
    throw "uv archive checksum mismatch. Expected $archiveSha256, found $actualHash."
}

if (-not (Test-Path -LiteralPath $uvExecutable -PathType Leaf)) {
    if (Test-Path -LiteralPath $uvRoot) {
        throw "The uv tool directory exists without uv.exe: $uvRoot"
    }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $uvRoot
}

$installedUvVersion = (& $uvExecutable --version).Trim()
if ($LASTEXITCODE -ne 0 -or $installedUvVersion -notmatch '^uv 0\.11\.29 \(') {
    throw "Expected project-local uv 0.11.29, found: $installedUvVersion"
}

$env:UV_PYTHON_INSTALL_DIR = $pythonInstallRoot
$env:UV_CACHE_DIR = $uvCacheRoot
$env:UV_PROJECT_ENVIRONMENT = $pythonEnvironmentRoot

Push-Location -LiteralPath $projectRoot
try {
    & $uvExecutable python install 3.13.14
    if ($LASTEXITCODE -ne 0) {
        throw "uv failed to install project-local Python 3.13.14."
    }

    & $uvExecutable sync --locked --python 3.13.14
    if ($LASTEXITCODE -ne 0) {
        throw "uv failed to create the locked project-local Python environment."
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $pythonExecutable -PathType Leaf)) {
    throw "uv did not create the expected project-local Python executable: $pythonExecutable"
}

$installedPythonVersion = (& $pythonExecutable --version).Trim()
if ($LASTEXITCODE -ne 0 -or $installedPythonVersion -ne "Python 3.13.14") {
    throw "Expected project-local Python 3.13.14, found: $installedPythonVersion"
}

Write-Host "Project-local Python toolchain ready: $installedUvVersion, $installedPythonVersion."
