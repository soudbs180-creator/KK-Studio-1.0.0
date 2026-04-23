param(
    [switch]$OpenBrowser,
    [switch]$Restart,
    [switch]$SkipVite
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
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

function Test-ApiWatchSpawnError {
    param([string]$LogSnippet)

    $normalized = [string]$LogSnippet
    return $normalized -match 'spawn EPERM' -and $normalized -match 'watch_mode'
}

function Start-DetachedPowerShellScript {
    param(
        [string]$ScriptPath,
        [string]$WorkingDirectory,
        [string]$PidFile
    )

    $process = Start-Process `
        -FilePath 'powershell' `
        -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ScriptPath) `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ascii
    return $process.Id
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
        return $resolvedOwnerPids[0]
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

function Clear-KnownDevPortConflicts {
    param(
        [int]$Port,
        [int[]]$AllowedProcessIds = @()
    )

    $knownProcessIds = @(Get-KnownDevProcessIds -Port $Port | Where-Object { $_ -notin $AllowedProcessIds })
    foreach ($processId in $knownProcessIds) {
        if ($processId -in $AllowedProcessIds) {
            continue
        }

        Stop-ProcessTree -ProcessId $processId
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

function Test-KkApiHealth {
    param(
        [string]$Url,
        [int]$Attempts = 1,
        [int]$DelayMilliseconds = 250
    )

    for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            $content = [string]$response.Content
            if (
                $response.StatusCode -eq 200 `
                -and $content -match '"success"\s*:\s*true' `
                -and $content -match '"service"\s*:\s*"kk-studio-api"'
            ) {
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

function Wait-UrlReadyOrExit {
    param(
        [string]$Url,
        [int]$ProcessId,
        [int]$Attempts = 1,
        [int]$DelayMilliseconds = 250
    )

    for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
        if (Test-UrlReady -Url $Url) {
            return $true
        }

        $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            return $false
        }

        if ($attempt -lt ($Attempts - 1)) {
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }

    return $false
}

function Get-LogSnippet {
    param(
        [string]$Path,
        [int]$LineCount = 12
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    $lines = @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue | Select-Object -Last $LineCount)
    if (-not $lines.Count) {
        return $null
    }

    return ($lines -join [Environment]::NewLine)
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

    throw "Port $Port is already in use by process id(s): $($unexpectedIds -join ', '). Run scripts/dev/dev-stop.ps1 or close the conflicting app first."
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

    $originalCi = [string]$env:CI
    $originalPathUpper = [string]$env:PATH
    $originalPathMixed = [string]$env:Path

    try {
        if ($originalPathUpper -and $originalPathMixed) {
            Remove-Item Env:PATH -ErrorAction SilentlyContinue
        }

        $env:CI = 'true'

        $startProcessParams = @{
            FilePath = $script:nodeExe
            ArgumentList = $Arguments
            WorkingDirectory = $WorkingDirectory
            WindowStyle = 'Hidden'
            PassThru = $true
        }

        if (-not [string]::IsNullOrWhiteSpace($StdOutLog)) {
            Reset-LogFile -Path $StdOutLog
            $startProcessParams.RedirectStandardOutput = $StdOutLog
        }

        if (-not [string]::IsNullOrWhiteSpace($StdErrLog)) {
            Reset-LogFile -Path $StdErrLog
            $startProcessParams.RedirectStandardError = $StdErrLog
        }

        $process = Start-Process @startProcessParams
    } finally {
        if ($originalCi) {
            $env:CI = $originalCi
        } else {
            Remove-Item Env:CI -ErrorAction SilentlyContinue
        }

        if ($originalPathUpper) {
            $env:PATH = $originalPathUpper
        }

        if ($originalPathMixed) {
            $env:Path = $originalPathMixed
        }
    }

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

function Start-ApiProcess {
    param(
        [string]$ApiScript,
        [bool]$UseWatch = $true
    )

    $arguments = if ($UseWatch) {
        @('--watch', $ApiScript)
    } else {
        @($ApiScript)
    }

    return Start-DetachedNodeProcess `
        -Arguments $arguments `
        -WorkingDirectory $projectRoot `
        -PidFile $apiPidFile `
        -StdOutLog $apiOutLog `
        -StdErrLog $apiErrLog
}

$nodeExe = Get-NodeExe
$viteCli = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$viteRunnerScript = Join-Path $projectRoot 'scripts\dev\run-vite-dev.ps1'
$apiDevScript = Join-Path $projectRoot 'scripts\dev\run-api-dev.mjs'
$apiLocalScript = Join-Path $projectRoot 'scripts\dev\run-api-local.mjs'
$apiScript = $apiDevScript
$apiMode = 'canonical'

if (-not (Test-Path -LiteralPath $viteCli)) {
    throw "Vite CLI was not found at $viteCli. Run npm install first."
}

if (-not (Test-Path -LiteralPath $viteRunnerScript)) {
    throw "Vite runner script was not found at $viteRunnerScript."
}

if (-not (Test-Path -LiteralPath $apiDevScript)) {
    throw "API dev script was not found at $apiDevScript."
}

if (-not (Test-Path -LiteralPath $apiLocalScript)) {
    throw "API local-only fallback script was not found at $apiLocalScript."
}

Reset-LogFile -Path $apiOutLog
Reset-LogFile -Path $apiErrLog

$apiEnabled = $true
$originalPathUpper = [string]$env:PATH
$originalPathMixed = [string]$env:Path
try {
    if ($originalPathUpper -and $originalPathMixed) {
        Remove-Item Env:PATH -ErrorAction SilentlyContinue
    }

    $apiPreflight = Start-Process `
        -FilePath $nodeExe `
        -ArgumentList @($apiScript, '--check') `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $apiOutLog `
        -RedirectStandardError $apiErrLog `
        -PassThru `
        -Wait
} finally {
    if ($originalPathUpper) {
        $env:PATH = $originalPathUpper
    }

    if ($originalPathMixed) {
        $env:Path = $originalPathMixed
    }
}

if ($apiPreflight.ExitCode -ne 0) {
    $apiScript = $apiLocalScript
    $apiMode = 'local-only'
    Write-Warning "Local API config preflight failed. Starting Vite with the local-only API fallback. Update apps/api/.env.local to restore canonical API routes."
}

if ($Restart) {
    Stop-TrackedProcess -PidFile $vitePidFile
    Stop-TrackedProcess -PidFile $apiPidFile
}

$apiPid = Get-AliveProcessId -PidFile $apiPidFile
if ($apiPid) {
    $apiCommandLine = [string](Get-ProcessCommandLine -ProcessId $apiPid)
    $apiUsesWatch = $apiCommandLine -match '--watch'
} else {
    $apiUsesWatch = $true
}

if ($apiPid -and -not (Test-UrlReady -Url $apiUrl)) {
    Stop-TrackedProcess -PidFile $apiPidFile
    $apiPid = $null
    $apiUsesWatch = $true
}

$apiReusedExistingListener = $false
if (-not $apiPid -and (Test-KkApiHealth -Url $apiUrl)) {
    $existingApiPid = Get-ListeningProcessIdByPort -Port 3001
    if ($existingApiPid) {
        $apiPid = Sync-PidFileToPortOwner -PidFile $apiPidFile -Port 3001 -FallbackProcessId $existingApiPid
    } else {
        Remove-StalePidFile -PidFile $apiPidFile
    }

    $apiReusedExistingListener = $true
    Write-Warning "Reusing the local API listener that is already healthy on port 3001."
}

if (-not $apiPid -and -not $apiReusedExistingListener) {
    Clear-KnownDevPortConflicts -Port 3001
    Assert-PortAvailable -Port 3001
    $apiPid = Start-ApiProcess -ApiScript $apiScript -UseWatch $true
}

if (-not $apiReusedExistingListener -and -not (Wait-UrlReadyOrExit -Url $apiUrl -ProcessId $apiPid -Attempts 80 -DelayMilliseconds 500)) {
    $apiLogSnippet = Get-LogSnippet -Path $apiErrLog
    if ($apiUsesWatch -and (Test-ApiWatchSpawnError -LogSnippet $apiLogSnippet)) {
        Write-Warning "Node watch mode is unavailable on this machine. Restarting the local API without watch mode."
        Stop-TrackedProcess -PidFile $apiPidFile
        $apiPid = Start-ApiProcess -ApiScript $apiScript -UseWatch $false
        $apiUsesWatch = $false

        if (-not (Wait-UrlReadyOrExit -Url $apiUrl -ProcessId $apiPid -Attempts 80 -DelayMilliseconds 500)) {
            $apiLogSnippet = Get-LogSnippet -Path $apiErrLog
            if ($apiLogSnippet) {
                throw "The local API server did not become ready. Latest error output:`n$apiLogSnippet"
            }

            throw "The local API server did not become ready in time. Check $apiErrLog"
        }
    } else {
        if ($apiLogSnippet) {
            throw "The local API server did not become ready. Latest error output:`n$apiLogSnippet"
        }

        throw "The local API server did not become ready in time. Check $apiErrLog"
    }
}

# Keep the API pid file pinned to the currently active API process.
$apiPid = Sync-PidFileToPortOwner -PidFile $apiPidFile -Port 3001 -FallbackProcessId $apiPid

if ($SkipVite) {
    Write-Host "KK Studio local API is ready at http://localhost:3001"
    if ($apiReusedExistingListener -and -not $apiPid) {
        Write-Host "API PID: external healthy listener on port 3001"
    } elseif ($apiMode -eq 'local-only') {
        Write-Host "API PID: $apiPid (local-only fallback)"
    } else {
        Write-Host "API PID: $apiPid"
    }
    Write-Host "Logs: $logDir"
    return
}

$vitePid = Get-AliveProcessId -PidFile $vitePidFile
if ($vitePid -and -not (Test-UrlReady -Url $viteUrl)) {
    Stop-TrackedProcess -PidFile $vitePidFile
    $vitePid = $null
}

if (-not $vitePid) {
    Clear-KnownDevPortConflicts -Port 3000
    Assert-PortAvailable -Port 3000
    $vitePid = Start-DetachedPowerShellScript `
        -ScriptPath $viteRunnerScript `
        -WorkingDirectory $projectRoot `
        -PidFile $vitePidFile
}

if (-not (Wait-UrlReadyOrExit -Url $viteUrl -ProcessId $vitePid -Attempts 80 -DelayMilliseconds 500)) {
    $viteLogSnippet = Get-LogSnippet -Path $viteErrLog
    if ($viteLogSnippet) {
        throw "The Vite dev server did not become ready. Latest error output:`n$viteLogSnippet"
    }

    throw "The Vite dev server did not become ready in time. Check $viteErrLog"
}

$vitePid = Sync-PidFileToPortOwner -PidFile $vitePidFile -Port 3000 -FallbackProcessId $vitePid

if ($OpenBrowser) {
    try {
        Start-Process 'http://localhost:3000' | Out-Null
    } catch {
        Write-Warning "Failed to open the browser automatically. Open http://localhost:3000 manually if needed."
    }
}

Write-Host "KK Studio dev server is ready at http://localhost:3000"
Write-Host "Vite PID: $vitePid"
if ($apiReusedExistingListener -and -not $apiPid) {
    Write-Host "API PID: external healthy listener on port 3001"
} elseif ($apiMode -eq 'local-only') {
    Write-Host "API PID: $apiPid (local-only fallback)"
} else {
    Write-Host "API PID: $apiPid"
}
Write-Host "Logs: $logDir"
