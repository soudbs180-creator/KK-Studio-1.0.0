$ErrorActionPreference = 'Stop'

$ReleaseRoot = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $ReleaseRoot 'run'
$PidFiles = @(
    (Join-Path $RunDir 'web.pid'),
    (Join-Path $RunDir 'payment.pid')
)
$AuxFiles = @(
    (Join-Path $RunDir 'web.port')
)

foreach ($PidFile in $PidFiles) {
    if (-not (Test-Path -LiteralPath $PidFile)) {
        continue
    }

    $rawPidLine = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($rawPidLine)) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        continue
    }

    $rawPid = $rawPidLine.Trim()
    $pidValue = 0
    if ([int]::TryParse($rawPid, [ref]$pidValue)) {
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        }
    }

    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

foreach ($AuxFile in $AuxFiles) {
    if (Test-Path -LiteralPath $AuxFile) {
        Remove-Item -LiteralPath $AuxFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host 'KK Studio portable processes were stopped.'
