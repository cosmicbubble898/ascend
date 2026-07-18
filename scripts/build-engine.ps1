[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$entryPoint = Join-Path $projectRoot "src\ascend_engine\__main__.py"
$distRoot = Join-Path $projectRoot "build\engine"
$workRoot = Join-Path $projectRoot "build\pyinstaller-work"
$specRoot = Join-Path $projectRoot "build\pyinstaller-spec"
$engineExecutable = Join-Path $distRoot "ascend-engine\ascend-engine.exe"

Push-Location -LiteralPath $projectRoot
try {
    & uv run --locked pyinstaller `
        --clean `
        --console `
        --contents-directory "_internal" `
        --distpath $distRoot `
        --name "ascend-engine" `
        --noconfirm `
        --onedir `
        --specpath $specRoot `
        --workpath $workRoot `
        $entryPoint
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed with exit code $LASTEXITCODE."
    }

    if (-not (Test-Path -LiteralPath $engineExecutable -PathType Leaf)) {
        throw "PyInstaller did not create the expected engine executable."
    }

    $versionOutput = (& $engineExecutable --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $versionOutput -ne "Ascend engine 0.0.0") {
        throw "Packaged engine version smoke failed: $versionOutput"
    }

    $engineHash = (Get-FileHash -LiteralPath $engineExecutable -Algorithm SHA256).Hash
    Write-Host "Packaged engine smoke passed: $engineHash"
}
finally {
    Pop-Location
}
