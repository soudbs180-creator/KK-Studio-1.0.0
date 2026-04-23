param(
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runDir = Join-Path $projectRoot '.kk-local\run'
$services = @(
    @{
        Port = 3000
        PidFile = (Join-Path $runDir 'dev-vite.pid')
    },
    @{
        Port = 3001
        PidFile = (Join-Path $runDir 'dev-api.pid')
    }
)

function Remove-StalePidFile {
    param([string]$PidFile)

    if (Test-Path -LiteralPath $PidFile) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Get-AliveProcessId {
    param([string]$PidFile)

    if (-not (Test-Path -LiteralPath $PidFile)) {
        return $null
    }

    $rawPidLine = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($rawPidLine)) {
        Remove-StalePidFile -PidFile $PidFile
        return $null
    }

    $pidValue = 0
    if (-not [int]::TryParse($rawPidLine.Trim(), [ref]$pidValue)) {
        Remove-StalePidFile -PidFile $PidFile
        return $null
    }

    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        Remove-StalePidFile -PidFile $PidFile
        return $null
    }

    return $pidValue
}

function Get-ProcessCommandLine {
    param([int]$ProcessId)

    try {
        return (Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop).CommandLine
    } catch {
        return $null
    }
}

function Get-ListeningPortsForProcess {
    param([int]$ProcessId)

    return @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.OwningProcess -eq $ProcessId } |
        Select-Object -ExpandProperty LocalPort -Unique)
}

function Is-KnownDevProcess {
    param(
        [int]$ProcessId,
        [int]$Port
    )

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $false
    }

    if ($process.ProcessName -notin @('node', 'npm', 'cmd', 'powershell')) {
        return $false
    }

    $commandLine = [string](Get-ProcessCommandLine -ProcessId $ProcessId)
    $listeningPorts = @(Get-ListeningPortsForProcess -ProcessId $ProcessId)

    if ($process.ProcessName -eq 'node' -and 3000 -in $listeningPorts -and 3001 -in $listeningPorts) {
        return $true
    }

    if ([string]::IsNullOrWhiteSpace($commandLine)) {
        return $false
    }

    if ($Port -eq 3000) {
        return $commandLine -match 'vite[\\/]+bin[\\/]+vite\.js' `
            -or $commandLine -match 'scripts[\\/]+dev[\\/]+run-vite-dev\.ps1'
    }

    if ($Port -eq 3001) {
        return $commandLine -match 'scripts[\\/]+run-api-(?:dev|local)\.mjs' `
            -or $commandLine -match 'vite[\\/]+bin[\\/]+vite\.js'
    }

    return $false
}

function Get-PortOwnerProcessId {
    param([int]$Port)

    $ownerPids = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)

    $resolvedOwnerPids = @()
    foreach ($ownerPid in $ownerPids) {
        $resolvedOwnerPid = 0
        if ([int]::TryParse([string]$ownerPid, [ref]$resolvedOwnerPid)) {
            $resolvedOwnerPids += $resolvedOwnerPid
        }
    }

    foreach ($resolvedOwnerPid in $resolvedOwnerPids) {
        if (Is-KnownDevProcess -ProcessId $resolvedOwnerPid -Port $Port) {
            return $resolvedOwnerPid
        }
    }

    if ($resolvedOwnerPids.Count -eq 1) {
        $fallbackProcess = Get-Process -Id $resolvedOwnerPids[0] -ErrorAction SilentlyContinue
        if ($fallbackProcess -and $fallbackProcess.ProcessName -in @('node', 'npm', 'cmd', 'powershell')) {
            return $resolvedOwnerPids[0]
        }
    }

    return $null
}

function Get-KnownDevProcessIds {
    param([int]$Port)

    return @(Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -in @('node', 'npm', 'cmd', 'powershell') } |
        ForEach-Object {
            $resolvedProcessId = 0
            if ([int]::TryParse([string]$_.Id, [ref]$resolvedProcessId) -and (Is-KnownDevProcess -ProcessId $resolvedProcessId -Port $Port)) {
                $resolvedProcessId
            }
        } |
        Select-Object -Unique)
}

foreach ($service in $services) {
    $processId = Get-AliveProcessId -PidFile $service.PidFile
    if ($processId) {
        & taskkill /PID $processId /T /F | Out-Null
    }

    $fallbackProcessId = Get-PortOwnerProcessId -Port $service.Port
    if ($fallbackProcessId -and (Is-KnownDevProcess -ProcessId $fallbackProcessId -Port $service.Port)) {
        & taskkill /PID $fallbackProcessId /T /F | Out-Null
    }

    foreach ($knownProcessId in @(Get-KnownDevProcessIds -Port $service.Port)) {
        if ($knownProcessId -ne $processId -and $knownProcessId -ne $fallbackProcessId) {
            & taskkill /PID $knownProcessId /T /F | Out-Null
        }
    }

    Remove-StalePidFile -PidFile $service.PidFile
}

if (-not $Quiet) {
    Write-Host 'KK Studio dev processes were stopped.'
}
