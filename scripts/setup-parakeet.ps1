[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$uvExecutable = Join-Path $projectRoot '.tools\uv-0.11.29\uv.exe'
$basePython = Join-Path $projectRoot 'runtime\uv-python-0.11.29\cpython-3.13.14-windows-x86_64-none\python.exe'
$workerPython = Join-Path $projectRoot 'runtime\parakeet-env\Scripts\python.exe'
Push-Location -LiteralPath $projectRoot
try {
    if ([System.IO.DriveInfo]::new([System.IO.Path]::GetPathRoot($projectRoot)).AvailableFreeSpace -lt 12GB) {
        throw 'Setup needs 12 GB of free space.'
    }
    if (-not (Test-Path -LiteralPath $workerPython)) {
        & $uvExecutable venv --python $basePython --no-python-downloads runtime\parakeet-env
        if ($LASTEXITCODE -ne 0) { throw 'Worker environment setup failed.' }
    }
    & $uvExecutable pip sync --python $workerPython --require-hashes --only-binary :all: --link-mode copy --cache-dir runtime\parakeet-wheel-cache docs\proposals\parakeet-worker-requirements.lock
    if ($LASTEXITCODE -ne 0) { throw 'Verified dependency installation failed.' }
    & $basePython -I -B scripts\setup-parakeet.py
    if ($LASTEXITCODE -ne 0) { throw 'Model verification failed.' }
    & $basePython -I -B scripts\parakeet-sandbox.py --setup
    if ($LASTEXITCODE -ne 0) { throw 'Windows isolation setup failed.' }
    Write-Host 'Ascend local transcription is installed. Setup has not accessed any recording.'
}
finally { Pop-Location }
