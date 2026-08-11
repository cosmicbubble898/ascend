Set-StrictMode -Version Latest

function Initialize-AscendPythonToolchain {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ProjectRoot
    )

    $uvExecutable = Join-Path $ProjectRoot ".tools\uv-0.11.29\uv.exe"
    $pythonInstallRoot = Join-Path $ProjectRoot "runtime\uv-python-0.11.29"
    $uvCacheRoot = Join-Path $ProjectRoot "runtime\uv-cache-0.11.29"
    $pythonEnvironmentRoot = Join-Path $ProjectRoot "runtime\python-env-0.11.29"
    $pythonExecutable = Join-Path $pythonEnvironmentRoot "Scripts\python.exe"
    $bootstrapCommand = "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-python.ps1"

    if (-not (Test-Path -LiteralPath $uvExecutable -PathType Leaf)) {
        throw "Project-local uv 0.11.29 is missing. Run: $bootstrapCommand"
    }

    $installedUvVersion = (& $uvExecutable --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $installedUvVersion -notmatch '^uv 0\.11\.29 \(') {
        throw "Expected uv 0.11.29 at $uvExecutable, found: $installedUvVersion. Run: $bootstrapCommand"
    }

    if (-not (Test-Path -LiteralPath $pythonExecutable -PathType Leaf)) {
        throw "Project-local Python environment is missing. Run: $bootstrapCommand"
    }

    $installedPythonVersion = (& $pythonExecutable --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $installedPythonVersion -ne "Python 3.13.14") {
        throw "Expected Python 3.13.14 at $pythonExecutable, found: $installedPythonVersion. Run: $bootstrapCommand"
    }

    $env:UV_PYTHON_INSTALL_DIR = $pythonInstallRoot
    $env:UV_CACHE_DIR = $uvCacheRoot
    $env:UV_PROJECT_ENVIRONMENT = $pythonEnvironmentRoot

    return [PSCustomObject]@{
        UvExecutable = $uvExecutable
        PythonExecutable = $pythonExecutable
        PythonEnvironmentRoot = $pythonEnvironmentRoot
    }
}
