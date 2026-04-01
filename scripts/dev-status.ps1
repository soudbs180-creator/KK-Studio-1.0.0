$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $projectRoot '.kk-local\run'

$services = @(
    @{
        Name = 'vite'
        Port = 3000
        Url = 'http://127.0.0.1:3000/'
        PidFile = Join-Path $runDir 'dev-vite.pid'
    },
    @{
        Name = 'api'
        Port = 3001
        Url = 'http://127.0.0.1:3001/healthz'
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

function Get-PortOwnerProcessId {
    param([int]$Port)

    $ownerPid = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Select-Object -First 1)

    if (-not $ownerPid) {
        return $null
    }

    if (-not (Is-KnownDevProcess -ProcessId $ownerPid -Port $Port)) {
        return $null
    }

    return [int]$ownerPid
}

function Test-UrlReady {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
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

    $isHealthy = Test-UrlReady -Url $service.Url
    Write-Host ("{0}: pid={1}; port={2}; running={3}; healthy={4}" -f `
        $service.Name,
        ($(if ($pidValue) { $pidValue } else { 'none' })),
        $service.Port,
        $isRunning,
        $isHealthy)
}
