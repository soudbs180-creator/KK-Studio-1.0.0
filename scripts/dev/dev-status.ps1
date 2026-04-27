$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runDir = Join-Path $projectRoot '.kk-local\run'

$services = @(
    @{
        Name = 'vite'
        Port = 3000
        Url = 'http://127.0.0.1:3000/'
        TimeoutSec = 3
        PidFile = Join-Path $runDir 'dev-vite.pid'
    },
    @{
        Name = 'api'
        Port = 3001
        Url = 'http://127.0.0.1:3001/healthz'
        TimeoutSec = 10
        PidFile = Join-Path $runDir 'dev-api.pid'
    }
)

function Get-TrackedPid {
    param([string]$PidFile)

    if (-not (Test-Path -LiteralPath $PidFile)) {
        return $null
    }

    $rawPidLine = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($rawPidLine)) {
        return $null
    }

    $pidValue = 0
    if ([int]::TryParse($rawPidLine.Trim(), [ref]$pidValue)) {
        return $pidValue
    }

    return $null
}

function Get-ProcessCommandLine {
    param([int]$ProcessId)

    try {
        return (Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop).CommandLine
    } catch {
        return $null
    }
}

function Get-ListeningConnectionRecords {
    $netTcpRecords = @()

    try {
        $netTcpRecords = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
            Select-Object LocalPort, OwningProcess -Unique)
    } catch {
        $netTcpRecords = @()
    }

    if ($netTcpRecords.Count -gt 0) {
        return $netTcpRecords
    }

    $netstatRecords = @()
    try {
        $netstatLines = @(cmd /c netstat -ano -p tcp | Select-String 'LISTENING')
        foreach ($lineMatch in $netstatLines) {
            $normalizedLine = ([string]$lineMatch.Line -replace '\s+', ' ').Trim()
            if ([string]::IsNullOrWhiteSpace($normalizedLine)) {
                continue
            }

            $parts = $normalizedLine.Split(' ')
            if ($parts.Length -lt 5) {
                continue
            }

            $localPort = 0
            $owningProcess = 0
            $localPortText = [string](($parts[1] -split ':')[-1])
            $localPortText = $localPortText.Trim()
            $owningProcessText = [string]$parts[4]

            if ([int]::TryParse($localPortText, [ref]$localPort) -and [int]::TryParse($owningProcessText, [ref]$owningProcess)) {
                $netstatRecords += [pscustomobject]@{
                    LocalPort = $localPort
                    OwningProcess = $owningProcess
                }
            }
        }
    } catch {
        $netstatRecords = @()
    }

    return @($netstatRecords | Sort-Object LocalPort, OwningProcess -Unique)
}

function Get-ListeningPortsForProcess {
    param([int]$ProcessId)

    return @(Get-ListeningConnectionRecords |
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

    if ($Port -in $listeningPorts) {
        return $true
    }

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

    $ownerPids = @(Get-ListeningConnectionRecords | Where-Object { $_.LocalPort -eq $Port } |
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

function Test-UrlReady {
    param(
        [string]$Url,
        [int]$TimeoutSec = 3
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

foreach ($service in $services) {
    $pidValue = Get-TrackedPid -PidFile $service.PidFile
    $isRunning = $false
    if ($pidValue) {
        $isRunning = [bool](Get-Process -Id $pidValue -ErrorAction SilentlyContinue)
    }

    if (-not $isRunning) {
        $portOwnerPid = Get-PortOwnerProcessId -Port $service.Port
        if ($portOwnerPid) {
            $pidValue = $portOwnerPid
            $isRunning = $true
        }
    }

    $isHealthy = Test-UrlReady -Url $service.Url -TimeoutSec $service.TimeoutSec
    Write-Host ("{0}: pid={1}; port={2}; running={3}; healthy={4}" -f `
        $service.Name,
        ($(if ($pidValue) { $pidValue } else { 'none' })),
        $service.Port,
        $isRunning,
        $isHealthy)
}
