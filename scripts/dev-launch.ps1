param(
    [switch]$OpenBrowser,
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $projectRoot '.kk-local\run'
$logDir = Join-Path $projectRoot '.kk-local\logs'
$vitePidFile = Join-Path $runDir 'dev-vite.pid'
$apiPidFile = Join-Path $runDir 'dev-api.pid'
$viteOutLog = Join-Path $logDir 'dev-vite.out.log'
$viteErrLog = Join-Path $logDir 'dev-vite.err.log'
$apiOutLog = Join-Path $logDir 'dev-api.out.log'
$apiErrLog = Join-Path $logDir 'dev-api.err.log'
$viteUrl = 'http://127.0.0.1:3000/'
$apiUrl = 'http://127.0.0.1:3001/healthz'

New-Item -ItemType Directory -Force -Path $runDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Get-NodeExe {
    $nodeCommand = Get-Command node -ErrorAction Stop
    return $nodeCommand.Source
}

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

function Stop-ProcessTree {
    param([int]$ProcessId)

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return
    }

    & taskkill /PID $ProcessId /T /F | Out-Null
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

function Get-ListeningProcessIdByPort {
    param([int]$Port)

    return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Select-Object -First 1)
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
        return $commandLine -match 'vite[\\/]+bin[\\/]+vite\.js' -or $commandLine -like '*npm run dev*'
    }

    if ($Port -eq 3001) {
        return $commandLine -match 'scripts[\\/]+run-api-dev\.mjs' `
            -or $commandLine -match 'vite[\\/]+bin[\\/]+vite\.js' `
            -or $commandLine -like '*npm run dev*'
    }

    return $false
}

function Clear-KnownDevPortConflicts {
    param(
        [int]$Port,
        [int[]]$AllowedProcessIds = @()
    )

    $listenerIds = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)

    foreach ($processId in $listenerIds) {
        if ($processId -in $AllowedProcessIds) {
            continue
        }

        if (Is-KnownDevProcess -ProcessId $processId -Port $Port) {
            Stop-ProcessTree -ProcessId $processId
        }
    }
}

function Stop-TrackedProcess {
    param([string]$PidFile)

    $processId = Get-AliveProcessId -PidFile $PidFile
    if ($processId) {
        Stop-ProcessTree -ProcessId $processId
    }

    Remove-StalePidFile -PidFile $PidFile
}

function Test-UrlReady {
    param(
        [string]$Url,
        [int]$Attempts = 1,
        [int]$DelayMilliseconds = 250
    )

    for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
        }

        if ($attempt -lt ($Attempts - 1)) {
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }

    return $false
}

function Assert-PortAvailable {
    param(
        [int]$Port,
        [int[]]$AllowedProcessIds = @()
    )

    $listenerIds = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)

    if (-not $listenerIds.Count) {
        return
    }

    $unexpectedIds = @($listenerIds | Where-Object { $_ -notin $AllowedProcessIds })
    if (-not $unexpectedIds.Count) {
        return
    }

    throw "Port $Port is already in use by process id(s): $($unexpectedIds -join ', '). Run scripts/dev-stop.ps1 or close the conflicting app first."
}

function Reset-LogFile {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    }
}

function Start-DetachedNodeProcess {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$PidFile,
        [string]$StdOutLog,
        [string]$StdErrLog
    )

    Reset-LogFile -Path $StdOutLog
    Reset-LogFile -Path $StdErrLog

    $process = Start-Process `
        -FilePath $script:nodeExe `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $StdOutLog `
        -RedirectStandardError $StdErrLog `
        -PassThru

    Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ascii
    return $process.Id
}

function Sync-PidFileToPortOwner {
    param(
        [string]$PidFile,
        [int]$Port,
        [int]$FallbackProcessId
    )

    $portOwner = Get-ListeningProcessIdByPort -Port $Port
    $resolvedPid = if ($portOwner) { [int]$portOwner } else { $FallbackProcessId }
    Set-Content -LiteralPath $PidFile -Value $resolvedPid -Encoding ascii
    return $resolvedPid
}

$nodeExe = Get-NodeExe
$viteCli = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$apiScript = Join-Path $projectRoot 'scripts\run-api-dev.mjs'

if (-not (Test-Path -LiteralPath $viteCli)) {
    throw "Vite CLI was not found at $viteCli. Run npm install first."
}

if (-not (Test-Path -LiteralPath $apiScript)) {
    throw "API dev script was not found at $apiScript."
}

if ($Restart) {
    Stop-TrackedProcess -PidFile $vitePidFile
    Stop-TrackedProcess -PidFile $apiPidFile
}

$apiPid = Get-AliveProcessId -PidFile $apiPidFile
if ($apiPid -and -not (Test-UrlReady -Url $apiUrl)) {
    Stop-TrackedProcess -PidFile $apiPidFile
    $apiPid = $null
}

if (-not $apiPid) {
    Clear-KnownDevPortConflicts -Port 3001
    Assert-PortAvailable -Port 3001
    $apiPid = Start-DetachedNodeProcess `
        -Arguments @('--watch', $apiScript) `
        -WorkingDirectory $projectRoot `
        -PidFile $apiPidFile `
        -StdOutLog $apiOutLog `
        -StdErrLog $apiErrLog
}

if (-not (Test-UrlReady -Url $apiUrl -Attempts 80 -DelayMilliseconds 500)) {
    throw "The local API server did not become ready in time. Check $apiErrLog"
}

$apiPid = Sync-PidFileToPortOwner -PidFile $apiPidFile -Port 3001 -FallbackProcessId $apiPid

$vitePid = Get-AliveProcessId -PidFile $vitePidFile
if ($vitePid -and -not (Test-UrlReady -Url $viteUrl)) {
    Stop-TrackedProcess -PidFile $vitePidFile
    $vitePid = $null
}

if (-not $vitePid) {
    Clear-KnownDevPortConflicts -Port 3000
    Assert-PortAvailable -Port 3000
    $vitePid = Start-DetachedNodeProcess `
        -Arguments @($viteCli) `
        -WorkingDirectory $projectRoot `
        -PidFile $vitePidFile `
        -StdOutLog $viteOutLog `
        -StdErrLog $viteErrLog
}

if (-not (Test-UrlReady -Url $viteUrl -Attempts 80 -DelayMilliseconds 500)) {
    throw "The Vite dev server did not become ready in time. Check $viteErrLog"
}

$vitePid = Sync-PidFileToPortOwner -PidFile $vitePidFile -Port 3000 -FallbackProcessId $vitePid

if ($OpenBrowser) {
    Start-Process 'http://localhost:3000' | Out-Null
}

Write-Host "KK Studio dev server is ready at http://localhost:3000"
Write-Host "Vite PID: $vitePid"
Write-Host "API PID: $apiPid"
Write-Host "Logs: $logDir"
