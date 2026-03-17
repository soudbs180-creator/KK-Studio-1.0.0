# Canonical deployment check wrapper for the current Supabase runtime contract.
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\security\deploy-security-check.ps1

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$auditScript = Join-Path $repoRoot 'scripts\audit-supabase.mjs'

if (-not (Test-Path $auditScript)) {
    Write-Error "Missing audit script: $auditScript"
    exit 1
}

Write-Host "Running canonical Supabase runtime audit..." -ForegroundColor Cyan
node $auditScript
exit $LASTEXITCODE
