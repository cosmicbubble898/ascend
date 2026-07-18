[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$nodeRoot = Join-Path $projectRoot ".tools\node-v22.23.1-win-x64"
$nodeExecutable = Join-Path $nodeRoot "node.exe"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [scriptblock]$Command
    )

    Write-Host "==> $Name"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    throw "Local Node 22.23.1 is missing. Run scripts\bootstrap-node.ps1 first."
}

$env:Path = "$nodeRoot;$env:Path"

Push-Location -LiteralPath $projectRoot
try {
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne "v22.23.1") {
        throw "Expected Node v22.23.1, found: $nodeVersion"
    }

    $npmVersion = & npm --version
    if ($LASTEXITCODE -ne 0 -or $npmVersion -ne "10.9.8") {
        throw "Expected npm 10.9.8, found: $npmVersion"
    }

    $ignoreScripts = (& npm config get ignore-scripts).Trim()
    if ($LASTEXITCODE -ne 0 -or $ignoreScripts -ne "true") {
        throw "Dependency lifecycle scripts must remain blocked; effective ignore-scripts is: $ignoreScripts"
    }

    Invoke-CheckedCommand "Python quality gate" {
        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-python.ps1
    }
    Invoke-CheckedCommand "Frozen Node install check" { npm ci --ignore-scripts --dry-run }
    Invoke-CheckedCommand "Prettier format check" { npm run format:check }
    Invoke-CheckedCommand "ESLint" { npm run lint }
    Invoke-CheckedCommand "TypeScript type check" { npm run typecheck }
    Invoke-CheckedCommand "JavaScript and shell tests" { npm test }
    Invoke-CheckedCommand "TypeScript build" { npm run build }

    Write-Host "Ascend quality gate passed."
}
finally {
    Pop-Location
}
