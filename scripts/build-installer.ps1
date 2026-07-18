[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$nodeRoot = Join-Path $projectRoot ".tools\node-v22.23.1-win-x64"
$nodeExecutable = Join-Path $nodeRoot "node.exe"
$builderExecutable = Join-Path $projectRoot "node_modules\.bin\electron-builder.cmd"
$forgePackage = Join-Path $projectRoot "out\Ascend-win32-x64"
$installerOutput = Join-Path $projectRoot "out\nsis"
$proofRoot = Join-Path $projectRoot "runtime\installer-proof"
$cacheRoot = Join-Path $projectRoot "runtime\electron-builder-cache"
$runId = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfffZ")
$runRoot = Join-Path $proofRoot $runId
$proofInput = Join-Path $runRoot "input\Ascend-win32-x64"
$beforeManifest = Join-Path $runRoot "prepackaged-before.json"
$afterManifest = Join-Path $runRoot "prepackaged-after.json"
$cacheManifest = Join-Path $runRoot "electron-builder-cache.json"
$artifactHash = Join-Path $runRoot "artifact-sha256.txt"
$expectedInstaller = Join-Path $installerOutput "Ascend-Setup-0.0.0-x64.exe"
$builderDebugMetadata = Join-Path $installerOutput "builder-debug.yml"

function Assert-ExpectedProjectPath {
    param(
        [Parameter(Mandatory)]
        [string]$Candidate,

        [Parameter(Mandatory)]
        [string]$ExpectedRelativePath
    )

    $expected = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $ExpectedRelativePath))
    $actual = [System.IO.Path]::GetFullPath($Candidate)
    if ($actual -ne $expected) {
        throw "Refusing operation on unexpected path: $actual"
    }
}

if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf)) {
    throw "Local Node 22.23.1 is missing. Run scripts\bootstrap-node.ps1 first."
}
if (-not (Test-Path -LiteralPath $builderExecutable -PathType Leaf)) {
    throw "The approved electron-builder dependency is not installed. Run npm ci --ignore-scripts."
}

Assert-ExpectedProjectPath -Candidate $installerOutput -ExpectedRelativePath "out\nsis"
Assert-ExpectedProjectPath -Candidate $proofRoot -ExpectedRelativePath "runtime\installer-proof"
Assert-ExpectedProjectPath -Candidate $cacheRoot -ExpectedRelativePath "runtime\electron-builder-cache"

$env:Path = "$nodeRoot;$env:Path"
$env:ELECTRON_BUILDER_CACHE = $cacheRoot

Push-Location -LiteralPath $projectRoot
try {
    & npm run package
    if ($LASTEXITCODE -ne 0) {
        throw "Forge package build failed with exit code $LASTEXITCODE."
    }
    if (-not (Test-Path -LiteralPath $forgePackage -PathType Container)) {
        throw "Forge did not create the expected prepackaged application."
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $proofInput) -Force | Out-Null
    Copy-Item -LiteralPath $forgePackage -Destination $proofInput -Recurse

    & node .\scripts\package-manifest.cjs create $proofInput $beforeManifest
    if ($LASTEXITCODE -ne 0) {
        throw "Creating the prepackaged input manifest failed."
    }

    if (Test-Path -LiteralPath $installerOutput) {
        Remove-Item -LiteralPath $installerOutput -Recurse -Force
    }

    & $builderExecutable `
        --prepackaged $proofInput `
        --win nsis `
        --x64 `
        --publish never `
        --config electron-builder.config.cjs
    if ($LASTEXITCODE -ne 0) {
        throw "electron-builder failed with exit code $LASTEXITCODE."
    }

    & node .\scripts\package-manifest.cjs create $proofInput $afterManifest
    if ($LASTEXITCODE -ne 0) {
        throw "Creating the post-build input manifest failed."
    }
    & node .\scripts\package-manifest.cjs compare $beforeManifest $afterManifest
    if ($LASTEXITCODE -ne 0) {
        throw "electron-builder changed the prepackaged input."
    }

    if (-not (Test-Path -LiteralPath $expectedInstaller -PathType Leaf)) {
        throw "electron-builder did not create the expected NSIS installer."
    }
    if (Test-Path -LiteralPath $builderDebugMetadata -PathType Leaf) {
        Move-Item -LiteralPath $builderDebugMetadata -Destination (Join-Path $runRoot "builder-debug.yml")
    }
    & node .\scripts\installer-policy.cjs artifacts $installerOutput
    if ($LASTEXITCODE -ne 0) {
        throw "The NSIS output contains unapproved publishing or update artifacts."
    }
    if (-not (Test-Path -LiteralPath $cacheRoot -PathType Container)) {
        throw "electron-builder did not create the expected project-scoped tool cache."
    }

    & node .\scripts\package-manifest.cjs create $cacheRoot $cacheManifest
    if ($LASTEXITCODE -ne 0) {
        throw "Creating the electron-builder cache manifest failed."
    }

    $installerHash = (Get-FileHash -LiteralPath $expectedInstaller -Algorithm SHA256).Hash
    Set-Content -LiteralPath $artifactHash -Value "$installerHash  Ascend-Setup-0.0.0-x64.exe"

    Write-Host "NSIS installer proof build passed."
    Write-Host "Installer: $expectedInstaller"
    Write-Host "SHA-256: $installerHash"
    Write-Host "Evidence: $runRoot"
}
finally {
    Pop-Location
}
