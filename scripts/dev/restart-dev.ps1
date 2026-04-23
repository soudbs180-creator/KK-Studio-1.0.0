$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$viteCachePath = Join-Path $projectRoot 'node_modules/.vite'
if (Test-Path $viteCachePath) {
    Remove-Item -Recurse -Force $viteCachePath
    Write-Host "[CLEAN] Removed Vite cache at node_modules/.vite"
}

Write-Host "[RESTART] Restarting KK Studio dev services ..."
powershell -ExecutionPolicy Bypass -File (Join-Path $projectRoot 'scripts/dev/dev-launch.ps1') -Restart
