[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$nodeVersion = "22.23.2"
$npmVersion = "10.9.8"
$archiveName = "node-v$nodeVersion-win-x64.zip"
$archiveSha256 = "1177B4137BA5ADAA56354AE40F1080C7450E8AE09CECB47DA459D1C52AC99F97"
$downloadUrl = "https://nodejs.org/dist/v$nodeVersion/$archiveName"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$toolsRoot = Join-Path $projectRoot ".tools"
$archivePath = Join-Path $toolsRoot $archiveName
$nodeRoot = Join-Path $toolsRoot "node-v$nodeVersion-win-x64"
$nodeExecutable = Join-Path $nodeRoot "node.exe"
$npmExecutable = Join-Path $nodeRoot "npm.cmd"

New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archivePath
}

$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
if ($actualHash -ne $archiveSha256) {
    throw "Node archive checksum mismatch. Expected $archiveSha256, found $actualHash."
}

if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf)) {
    if (Test-Path -LiteralPath $nodeRoot) {
        throw "The Node tool directory exists without node.exe: $nodeRoot"
    }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot
}

$installedNodeVersion = & $nodeExecutable --version
if ($LASTEXITCODE -ne 0 -or $installedNodeVersion -ne "v$nodeVersion") {
    throw "Expected local Node v$nodeVersion, found: $installedNodeVersion"
}

$installedNpmVersion = & $npmExecutable --version
if ($LASTEXITCODE -ne 0 -or $installedNpmVersion -ne $npmVersion) {
    throw "Expected local npm $npmVersion, found: $installedNpmVersion"
}

Write-Host "Local Node toolchain ready: Node $installedNodeVersion, npm $installedNpmVersion."
