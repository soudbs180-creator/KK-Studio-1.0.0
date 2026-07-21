# Canonical deployment check wrapper for the current VPS/PostgreSQL runtime contract.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\security\deploy-security-check.ps1

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$auditScript = Join-Path $repoRoot 'scripts\audit-vps-postgres.mjs'

if (-not (Test-Path $auditScript)) {
    Write-Error "Missing audit script: $auditScript"
    exit 1
}

Write-Host "Running canonical VPS/PostgreSQL runtime audit..." -ForegroundColor Cyan
node $auditScript
exit $LASTEXITCODE
