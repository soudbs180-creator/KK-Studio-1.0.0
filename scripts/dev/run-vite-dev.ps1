$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$viteCli = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'

if (-not (Test-Path -LiteralPath $viteCli)) {
    throw "Vite CLI was not found at $viteCli. Run npm install first."
}

$originalPathUpper = [string]$env:PATH
$originalPathMixed = [string]$env:Path

try {
    if ($originalPathUpper -and $originalPathMixed) {
        Remove-Item Env:PATH -ErrorAction SilentlyContinue
    }

    & $nodeExe $viteCli --configLoader native --config apps/web/vite.config.ts
} finally {
    if ($originalPathUpper) {
        $env:PATH = $originalPathUpper
    }

    if ($originalPathMixed) {
        $env:Path = $originalPathMixed
    }
}
