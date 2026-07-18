[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

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

Push-Location -LiteralPath $projectRoot
try {
    $uvVersion = & uv --version
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to run uv."
    }
    if ($uvVersion -notmatch '^uv 0\.11\.29 \(') {
        throw "Expected uv 0.11.29, found: $uvVersion"
    }

    $pythonVersion = & uv run --locked python --version
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to run the locked Python environment."
    }
    if ($pythonVersion -ne "Python 3.13.14") {
        throw "Expected Python 3.13.14, found: $pythonVersion"
    }

    Invoke-CheckedCommand "Lockfile check" { uv lock --check }
    Invoke-CheckedCommand "Ruff format check" { uv run --locked ruff format --check . }
    Invoke-CheckedCommand "Ruff lint" { uv run --locked ruff check . }
    Invoke-CheckedCommand "mypy" { uv run --locked mypy }
    Invoke-CheckedCommand "pytest" { uv run --locked pytest }

    Write-Host "Python quality gate passed."
}
finally {
    Pop-Location
}
