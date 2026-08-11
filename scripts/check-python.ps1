[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "python-toolchain.ps1")
$pythonToolchain = Initialize-AscendPythonToolchain -ProjectRoot $projectRoot
$uvExecutable = $pythonToolchain.UvExecutable

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
    $pythonVersion = & $uvExecutable run --locked python --version
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to run the locked Python environment."
    }
    if ($pythonVersion -ne "Python 3.13.14") {
        throw "Expected Python 3.13.14, found: $pythonVersion"
    }

    Invoke-CheckedCommand "Lockfile check" { & $uvExecutable lock --check }
    Invoke-CheckedCommand "Ruff format check" { & $uvExecutable run --locked ruff format --check . }
    Invoke-CheckedCommand "Ruff lint" { & $uvExecutable run --locked ruff check . }
    Invoke-CheckedCommand "mypy" { & $uvExecutable run --locked mypy }
    Invoke-CheckedCommand "pytest" { & $uvExecutable run --locked pytest }

    Write-Host "Python quality gate passed."
}
finally {
    Pop-Location
}
