[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$distRoot = Join-Path $projectRoot "dist"

Push-Location -LiteralPath $projectRoot
try {
    if (Test-Path -LiteralPath $distRoot) {
        $resolvedDistRoot = (Resolve-Path -LiteralPath $distRoot).Path
        $expectedParent = [System.IO.Path]::GetFullPath($projectRoot)
        $actualParent = [System.IO.Path]::GetFullPath(
            [System.IO.Path]::GetDirectoryName($resolvedDistRoot)
        )
        if ($actualParent -ne $expectedParent -or [System.IO.Path]::GetFileName($resolvedDistRoot) -ne "dist") {
            throw "Refusing to clear unexpected shell build directory: $resolvedDistRoot"
        }

        Remove-Item -LiteralPath $resolvedDistRoot -Recurse -Force
    }

    & tsc -p tsconfig.build.json
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript build failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
