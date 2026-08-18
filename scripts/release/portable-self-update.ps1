param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseRoot,

    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'

$LogDir = Join-Path $ReleaseRoot 'logs'
$script:LogFile = Join-Path $LogDir 'update.log'
$DefaultConfigPath = Join-Path $ReleaseRoot 'support\update-config.json'
$LocalManifestPath = Join-Path $ReleaseRoot 'app\dist\app-version.json'
$UpdatePolicyPath = Join-Path $PSScriptRoot 'portable-update-policy.ps1'
$UpdateStatePath = Join-Path $ReleaseRoot 'run\update-state.json'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-UpdateLog {
    param([string]$Message)

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath $script:LogFile -Value "[$timestamp] $Message" -Encoding utf8
}

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

function Save-UpdateState {
    param([object]$RemoteManifest)

    $state = New-PortableAcceptedUpdateState -RemoteManifest $RemoteManifest
    $stateDir = Split-Path -Parent $UpdateStatePath
    $temporaryPath = "$UpdateStatePath.tmp"
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    $stateJson = $state | ConvertTo-Json -Depth 4
    [IO.File]::WriteAllText($temporaryPath, $stateJson, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $UpdateStatePath -Force
}

function Resolve-AbsoluteUrl {
    param(
        [string]$BaseUrl,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    return [System.Uri]::new([System.Uri]::new($BaseUrl), $Value).AbsoluteUri
}

function Get-ArchiveRoot {
    param([string]$ExtractDir)

    $rootEntries = Get-ChildItem -LiteralPath $ExtractDir -Force
    if ($rootEntries.Count -eq 1 -and $rootEntries[0].PSIsContainer) {
        return $rootEntries[0].FullName
    }

    return $ExtractDir
}

function Save-PreservedFile {
    param(
        [string]$SourcePath,
        [string]$TargetPath
    )

    if (-not (Test-Path -LiteralPath $SourcePath)) {
        return
    }

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetPath) | Out-Null
    Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Force
}

function Restore-PreservedFile {
    param(
        [string]$SourcePath,
        [string]$TargetPath
    )

    if (-not (Test-Path -LiteralPath $SourcePath)) {
        return
    }

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $TargetPath) | Out-Null
    Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Force
}

try {
    if (-not (Test-Path -LiteralPath $UpdatePolicyPath -PathType Leaf)) {
        throw "Portable update policy is missing: $UpdatePolicyPath"
    }
    . $UpdatePolicyPath

    if (-not $ConfigPath) {
        $ConfigPath = $DefaultConfigPath
    }

    $config = Get-JsonFile -Path $ConfigPath
    if ($null -eq $config) {
        Write-UpdateLog 'Self-update skipped because support/update-config.json is missing.'
        return $false
    }

    if (-not $config.enabled) {
        Write-UpdateLog 'Self-update skipped because update-config.json has enabled=false.'
        return $false
    }

    if ([string]::IsNullOrWhiteSpace($config.manifestUrl)) {
        Write-UpdateLog 'Self-update skipped because manifestUrl is empty.'
        return $false
    }

    $expectedChannel = [string]$config.channel
    if ([string]::IsNullOrWhiteSpace($expectedChannel)) {
        Write-UpdateLog 'Self-update aborted because update-config.json does not declare a channel.'
        return $false
    }

    # HTTPS prevents an on-path network from replacing the manifest and selecting arbitrary bytes.
    $manifestUrl = [string]$config.manifestUrl
    if (-not ([Uri]::IsWellFormedUriString($manifestUrl, [UriKind]::Absolute)) `
        -or -not ($manifestUrl.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase))) {
        Write-UpdateLog 'Self-update aborted because manifestUrl must be an absolute https URL.'
        return $false
    }
    $manifestUri = [Uri]$manifestUrl

    $localManifest = Get-JsonFile -Path $LocalManifestPath
    if ($null -eq $localManifest -or [string]::IsNullOrWhiteSpace($localManifest.artifactVersion)) {
        Write-UpdateLog "Self-update skipped because local manifest was not found at $LocalManifestPath."
        return $false
    }

    $remoteManifest = Invoke-RestMethod -Uri $config.manifestUrl -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 20
    if ($null -eq $remoteManifest -or [string]::IsNullOrWhiteSpace($remoteManifest.artifactVersion)) {
        Write-UpdateLog 'Self-update skipped because remote manifest is missing artifactVersion.'
        return $false
    }

    $acceptedState = Get-JsonFile -Path $UpdateStatePath
    Assert-PortableUpdateTransition `
        -LocalManifest $localManifest `
        -RemoteManifest $remoteManifest `
        -ExpectedChannel $expectedChannel `
        -AcceptedState $acceptedState
    $localVersion = [string]$localManifest.artifactVersion
    $remoteVersion = [string]$remoteManifest.artifactVersion

    $downloadUrl = Resolve-AbsoluteUrl -BaseUrl $config.manifestUrl -Value ([string]$remoteManifest.downloadUrl)
    if ([string]::IsNullOrWhiteSpace($downloadUrl)) {
        Write-UpdateLog 'Self-update skipped because remote manifest does not define downloadUrl.'
        return $false
    }

    # Keep the payload on the manifest's HTTPS origin so a manifest cannot redirect to another host.
    if (-not ([Uri]::IsWellFormedUriString($downloadUrl, [UriKind]::Absolute)) `
        -or -not ($downloadUrl.StartsWith('https://', [StringComparison]::OrdinalIgnoreCase))) {
        throw 'Portable update download URL must be an absolute https URL.'
    }
    $downloadUri = [Uri]$downloadUrl
    if ($downloadUri.Scheme -ne 'https' `
        -or $downloadUri.Host -ne $manifestUri.Host) {
        throw "Portable update download URL must be https and share the manifest host ($($manifestUri.Host))."
    }

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("kk-studio-update-" + [guid]::NewGuid().ToString('N'))
    $archivePath = Join-Path $tempRoot 'portable-update.zip'
    $extractDir = Join-Path $tempRoot 'extract'
    $preserveRoot = Join-Path $tempRoot 'preserve'
    New-Item -ItemType Directory -Force -Path $tempRoot, $extractDir, $preserveRoot | Out-Null

    $preservedFiles = @(
        @{
            Source = Join-Path $ReleaseRoot 'app\server\.env'
            Backup = Join-Path $preserveRoot 'app\server\.env'
            Restore = Join-Path $ReleaseRoot 'app\server\.env'
        },
        @{
            Source = Join-Path $ReleaseRoot 'support\update-config.json'
            Backup = Join-Path $preserveRoot 'support\update-config.json'
            Restore = Join-Path $ReleaseRoot 'support\update-config.json'
        }
    )

    foreach ($item in $preservedFiles) {
        Save-PreservedFile -SourcePath $item.Source -TargetPath $item.Backup
    }

    Write-UpdateLog "Downloading portable update $remoteVersion from $downloadUrl"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing -TimeoutSec 180

    if (-not (Test-Path -LiteralPath $archivePath)) {
        throw 'Portable update download did not create an archive.'
    }

    # Always verify publisher-provided bytes before extracting executables into the release root.
    $expectedHash = ([string]$remoteManifest.sha256).Trim().ToLowerInvariant()
    if ($expectedHash -notmatch '^[0-9a-f]{64}$') {
        throw 'Portable update manifest is missing a valid sha256 checksum. Refusing to install.'
    }
    $downloadHash = Get-PortableFileSha256 -Path $archivePath
    if ($downloadHash -ne $expectedHash) {
        throw "Portable update hash mismatch. Expected $expectedHash but received $downloadHash."
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force
    $packageRoot = Get-ArchiveRoot -ExtractDir $extractDir
    $packageManifestPath = Join-Path $packageRoot 'app\dist\app-version.json'
    $packageManifest = Get-JsonFile -Path $packageManifestPath
    Assert-PortablePackageMatchesPublication `
        -PackageManifest $packageManifest `
        -RemoteManifest $remoteManifest

    $requiredPaths = @(
        (Join-Path $packageRoot 'app'),
        (Join-Path $packageRoot 'runtime'),
        (Join-Path $packageRoot 'support'),
        (Join-Path $packageRoot 'Start KK Studio.bat')
    )

    foreach ($requiredPath in $requiredPaths) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "Portable update package is missing: $requiredPath"
        }
    }

    $processLaunchHelperPath = Join-Path $packageRoot 'support\process-launch.ps1'
    if (-not (Test-Path -LiteralPath $processLaunchHelperPath -PathType Leaf)) {
        throw "Portable update package is missing the process launch helper: $processLaunchHelperPath"
    }

    Copy-Item -Path (Join-Path $packageRoot '*') -Destination $ReleaseRoot -Recurse -Force

    foreach ($item in $preservedFiles) {
        Restore-PreservedFile -SourcePath $item.Backup -TargetPath $item.Restore
    }

    Save-UpdateState -RemoteManifest $remoteManifest
    Write-UpdateLog "Portable client updated from $localVersion to $remoteVersion."
    return $true
} catch {
    $failureContext = if ($_.ScriptStackTrace) { " Stack: $($_.ScriptStackTrace)" } else { '' }
    Write-UpdateLog ("Portable self-update failed: " + $_.Exception.Message + $failureContext)
    return $false
}
