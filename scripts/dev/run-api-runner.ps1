param(
    [Parameter(Mandatory = $true)]
    [string]$ApiScript,
    [switch]$UseWatch
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$nodeExe = (Get-Command node -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $ApiScript)) {
    throw "API script was not found at $ApiScript."
}

$originalPathUpper = [string]$env:PATH
$originalPathMixed = [string]$env:Path

try {
    if ($originalPathUpper -and $originalPathMixed) {
        Remove-Item Env:PATH -ErrorAction SilentlyContinue
    }

    if ($UseWatch) {
        & $nodeExe --watch $ApiScript
    } else {
        & $nodeExe $ApiScript
    }
} finally {
    if ($originalPathUpper) {
        $env:PATH = $originalPathUpper
    }

    if ($originalPathMixed) {
        $env:Path = $originalPathMixed
    }
}
