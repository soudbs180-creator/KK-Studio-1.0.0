$ErrorActionPreference = 'Stop'

$ReleaseRoot = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $ReleaseRoot 'run'
$LogDir = Join-Path $ReleaseRoot 'logs'
$NodeExe = Join-Path $ReleaseRoot 'runtime\node.exe'
$AppDir = Join-Path $ReleaseRoot 'app'
$PortableDistDir = Join-Path $AppDir 'dist'
$WebScript = Join-Path $AppDir 'portable-app-server.cjs'
$UpdateScript = Join-Path $ReleaseRoot 'support\portable-self-update.ps1'
$UpdateConfig = Join-Path $ReleaseRoot 'support\update-config.json'
$PaymentDir = Join-Path $AppDir 'payment-server'
$PaymentScript = Join-Path $PaymentDir 'index.js'
$PaymentEnv = Join-Path $PaymentDir '.env'
$WebPidFile = Join-Path $RunDir 'web.pid'
$WebPortFile = Join-Path $RunDir 'web.port'
$PaymentPidFile = Join-Path $RunDir 'payment.pid'

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Get-JsonFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    return $raw | ConvertFrom-Json
}

function Convert-ToVersion {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    try {
        return [version]$Value
    } catch {
        return $null
    }
}

function Get-ManifestFingerprint {
    param($Manifest)

    if ($null -eq $Manifest) {
        return ''
    }

    return @(
        [string]$Manifest.version,
        [string]$Manifest.buildTime,
        [string]$Manifest.releaseDate,
        [string]$Manifest.channel,
        [string]$Manifest.deploymentTarget,
        [string]$Manifest.commitSha
    ) -join '|'
}

function Get-FileSha256 {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Resolve-WorkspaceRoot {
    $releaseParent = Split-Path -Parent $ReleaseRoot
    if ([string]::IsNullOrWhiteSpace($releaseParent)) {
        return $null
    }

    $candidate = Split-Path -Parent $releaseParent
    if ([string]::IsNullOrWhiteSpace($candidate)) {
        return $null
    }

    $requiredPaths = @(
        (Join-Path $candidate 'package.json'),
        (Join-Path $candidate 'dist\app-version.json'),
        (Join-Path $candidate 'scripts\release\portable-app-server.cjs'),
        (Join-Path $candidate 'scripts\release\portable-stop.ps1'),
        (Join-Path $candidate 'scripts\release\portable-self-update.ps1')
    )

    foreach ($requiredPath in $requiredPaths) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            return $null
        }
    }

    return $candidate
}

function Get-WorkspacePortableSyncPlan {
    param([string]$WorkspaceRoot)

    if ([string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
        return $null
    }

    $workspaceManifestPath = Join-Path $WorkspaceRoot 'dist\app-version.json'
    $portableManifestPath = Join-Path $PortableDistDir 'app-version.json'
    $workspaceManifest = Get-JsonFile -Path $workspaceManifestPath
    $portableManifest = Get-JsonFile -Path $portableManifestPath

    if ($null -eq $workspaceManifest) {
        return $null
    }

    $reasons = New-Object System.Collections.Generic.List[string]
    $workspaceVersion = Convert-ToVersion -Value ([string]$workspaceManifest.version)
    $portableVersion = Convert-ToVersion -Value ([string]$portableManifest.version)

    if ($portableVersion -and $workspaceVersion) {
        if ($workspaceVersion -gt $portableVersion) {
            $reasons.Add("workspace version $($workspaceManifest.version) is newer than portable version $($portableManifest.version)")
        } elseif ($workspaceVersion -eq $portableVersion -and (Get-ManifestFingerprint -Manifest $workspaceManifest) -ne (Get-ManifestFingerprint -Manifest $portableManifest)) {
            $reasons.Add('workspace build manifest differs from the packaged portable manifest')
        }
    } elseif ((Get-ManifestFingerprint -Manifest $workspaceManifest) -ne (Get-ManifestFingerprint -Manifest $portableManifest)) {
        $reasons.Add('workspace build manifest differs from the packaged portable manifest')
    }

    $filesToCompare = @(
        @{
            Source = Join-Path $WorkspaceRoot 'scripts\release\portable-app-server.cjs'
            Target = Join-Path $AppDir 'portable-app-server.cjs'
            Label = 'portable app server'
        },
        @{
            Source = Join-Path $WorkspaceRoot 'scripts\release\portable-stop.ps1'
            Target = Join-Path $ReleaseRoot 'support\portable-stop.ps1'
            Label = 'portable stop script'
        },
        @{
            Source = Join-Path $WorkspaceRoot 'scripts\release\portable-self-update.ps1'
            Target = Join-Path $ReleaseRoot 'support\portable-self-update.ps1'
            Label = 'portable self-update script'
        }
    )

    foreach ($filePair in $filesToCompare) {
        if ((Get-FileSha256 -Path $filePair.Source) -ne (Get-FileSha256 -Path $filePair.Target)) {
            $reasons.Add("$($filePair.Label) differs from the workspace copy")
        }
    }

    return [pscustomobject]@{
        WorkspaceRoot = $WorkspaceRoot
        WorkspaceManifest = $workspaceManifest
        PortableManifest = $portableManifest
        Reasons = @($reasons)
        Required = $reasons.Count -gt 0
    }
}

function Sync-PortableBundleFromWorkspace {
    $workspaceRoot = Resolve-WorkspaceRoot
    if ([string]::IsNullOrWhiteSpace($workspaceRoot)) {
        return $false
    }

    $plan = Get-WorkspacePortableSyncPlan -WorkspaceRoot $workspaceRoot
    if ($null -eq $plan -or -not $plan.Required) {
        return $false
    }

    $reasonText = $plan.Reasons -join '; '
    Write-Host "Detected newer workspace files. Syncing portable bundle before launch..."
    Write-Host "Reasons: $reasonText"

    $workspaceDistDir = Join-Path $workspaceRoot 'dist'
    if (Test-Path -LiteralPath $PortableDistDir) {
        Remove-Item -LiteralPath $PortableDistDir -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $PortableDistDir | Out-Null
    Copy-Item -Path (Join-Path $workspaceDistDir '*') -Destination $PortableDistDir -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $workspaceRoot 'scripts\release\portable-app-server.cjs') -Destination (Join-Path $AppDir 'portable-app-server.cjs') -Force
    Copy-Item -LiteralPath (Join-Path $workspaceRoot 'scripts\release\portable-stop.ps1') -Destination (Join-Path $ReleaseRoot 'support\portable-stop.ps1') -Force
    Copy-Item -LiteralPath (Join-Path $workspaceRoot 'scripts\release\portable-self-update.ps1') -Destination (Join-Path $ReleaseRoot 'support\portable-self-update.ps1') -Force

    $syncedManifest = Get-JsonFile -Path (Join-Path $PortableDistDir 'app-version.json')
    Write-Host "Portable bundle is now aligned to workspace build $([string]$syncedManifest.version) ($([string]$syncedManifest.buildTime))."
    return $true
}

Sync-PortableBundleFromWorkspace | Out-Null

if (Test-Path -LiteralPath $UpdateScript) {
    try {
        & $UpdateScript -ReleaseRoot $ReleaseRoot -ConfigPath $UpdateConfig | Out-Null
    } catch {
        Write-Warning ("Portable self-update check failed: " + $_.Exception.Message)
    }
}

function Get-WebUrl {
    param([int]$Port)
    return "http://127.0.0.1:$Port"
}

function Get-StoredWebPort {
    if (-not (Test-Path -LiteralPath $WebPortFile)) {
        return $null
    }

    $rawPortLine = Get-Content -LiteralPath $WebPortFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($rawPortLine)) {
        return $null
    }

    $storedPort = 0
    if ([int]::TryParse($rawPortLine.Trim(), [ref]$storedPort)) {
        return $storedPort
    }

    return $null
}

function Get-AvailableWebPort {
    $candidates = @(3000, 8888, 3010, 3011, 3100, 3200)
    foreach ($candidate in $candidates) {
        $inUse = Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue
        if (-not $inUse) {
            return $candidate
        }
    }

    throw 'No supported local port was available for the portable web server.'
}

function Get-AliveProcessId {
    param([string]$PidFile)

    if (-not (Test-Path -LiteralPath $PidFile)) {
        return $null
    }

    $rawPidLine = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($rawPidLine)) {
        return $null
    }

    $rawPid = $rawPidLine.Trim()
    $pidValue = 0
    if (-not [int]::TryParse($rawPid, [ref]$pidValue)) {
        return $null
    }

    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    return $pidValue
}

function Start-HiddenNodeProcess {
    param(
        [string]$ScriptPath,
        [string]$WorkingDirectory,
        [string]$PidFile,
        [string]$StdOutLog,
        [string]$StdErrLog,
        [hashtable]$EnvVars = @{}
    )

    $existingPid = Get-AliveProcessId -PidFile $PidFile
    if ($existingPid) {
        return $existingPid
    }

    $originalEnv = @{}
    foreach ($envKey in $EnvVars.Keys) {
        $originalEnv[$envKey] = [Environment]::GetEnvironmentVariable($envKey, 'Process')
        [Environment]::SetEnvironmentVariable($envKey, [string]$EnvVars[$envKey], 'Process')
    }

    try {
        $process = Start-Process `
            -FilePath $NodeExe `
            -ArgumentList @($ScriptPath) `
            -WorkingDirectory $WorkingDirectory `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StdOutLog `
            -RedirectStandardError $StdErrLog `
            -PassThru
    } finally {
        foreach ($envKey in $EnvVars.Keys) {
            [Environment]::SetEnvironmentVariable($envKey, $originalEnv[$envKey], 'Process')
        }
    }

    Set-Content -LiteralPath $PidFile -Value $process.Id -Encoding ascii
    return $process.Id
}

function Wait-ForUrl {
    param(
        [string]$Url,
        [int]$Attempts = 20,
        [int]$DelayMilliseconds = 500
    )

    for ($i = 0; $i -lt $Attempts; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
            return $true
        } catch {
            Start-Sleep -Milliseconds $DelayMilliseconds
        }
    }

    return $false
}

if (-not (Test-Path -LiteralPath $NodeExe)) {
    Write-Error "Bundled node.exe was not found: $NodeExe"
}

if (-not (Test-Path -LiteralPath $WebScript)) {
    Write-Error "Portable app server was not found: $WebScript"
}

$webWasRunning = [bool](Get-AliveProcessId -PidFile $WebPidFile)
$webPort = if ($webWasRunning) { Get-StoredWebPort } else { $null }
if (-not $webPort) {
    $webPort = Get-AvailableWebPort
}
Set-Content -LiteralPath $WebPortFile -Value $webPort -Encoding ascii
$WebUrl = Get-WebUrl -Port $webPort

Start-HiddenNodeProcess `
    -ScriptPath $WebScript `
    -WorkingDirectory $AppDir `
    -PidFile $WebPidFile `
    -StdOutLog (Join-Path $LogDir 'web.out.log') `
    -StdErrLog (Join-Path $LogDir 'web.err.log') `
    -EnvVars @{
        PORT = $webPort
        HOST = '127.0.0.1'
    } | Out-Null

if ((Test-Path -LiteralPath $PaymentScript) -and (Test-Path -LiteralPath $PaymentDir) -and (Test-Path -LiteralPath $PaymentEnv)) {
    Start-HiddenNodeProcess `
        -ScriptPath $PaymentScript `
        -WorkingDirectory $PaymentDir `
        -PidFile $PaymentPidFile `
        -StdOutLog (Join-Path $LogDir 'payment.out.log') `
        -StdErrLog (Join-Path $LogDir 'payment.err.log') | Out-Null
} elseif (Test-Path -LiteralPath $PaymentScript) {
    $note = @(
        "Payment sidecar was not started because app\payment-server\.env is missing.",
        "The main app still works. Payment features stay disabled until that file is provided."
    ) -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $LogDir 'payment.note.txt') -Value $note -Encoding utf8
}

if (-not (Wait-ForUrl -Url "$WebUrl/health")) {
    Write-Error "KK Studio portable server did not start in time. Check logs\web.err.log"
}

Start-Process $WebUrl | Out-Null

if ($webWasRunning) {
    Write-Host "KK Studio was already running. Opened the app in your browser."
} else {
    Write-Host "KK Studio is ready at $WebUrl"
}
