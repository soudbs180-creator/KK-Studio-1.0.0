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

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-UpdateLog {
    param([string]$Message)

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath $script:LogFile -Value "[$timestamp] $Message" -Encoding utf8
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

    # 安全：更新清单只允许经 HTTPS 获取。允许 http:// 意味着任何能做中间人的网络位置
    # （公共 Wi-Fi、被劫持的 DNS）都能替换清单，进而指定任意下载地址。
    $manifestUri = $null
    if (-not [Uri]::TryCreate([string]$config.manifestUrl, [UriKind]::Absolute, [ref]$manifestUri) `
        -or $manifestUri.Scheme -ne 'https') {
        Write-UpdateLog 'Self-update aborted because manifestUrl must be an absolute https URL.'
        return $false
    }

    $localManifest = Get-JsonFile -Path $LocalManifestPath
    if ($null -eq $localManifest -or [string]::IsNullOrWhiteSpace($localManifest.version)) {
        Write-UpdateLog "Self-update skipped because local manifest was not found at $LocalManifestPath."
        return $false
    }

    $remoteManifest = Invoke-RestMethod -Uri $config.manifestUrl -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 20
    if ($null -eq $remoteManifest -or [string]::IsNullOrWhiteSpace($remoteManifest.version)) {
        Write-UpdateLog 'Self-update skipped because remote manifest is missing a version.'
        return $false
    }

    $localVersion = [string]$localManifest.version
    $remoteVersion = [string]$remoteManifest.version
    $localVersionObject = Convert-ToVersion -Value $localVersion
    $remoteVersionObject = Convert-ToVersion -Value $remoteVersion

    if ($remoteVersionObject -and $localVersionObject) {
        if ($remoteVersionObject -le $localVersionObject) {
            Write-UpdateLog "Self-update check complete. Already on version $localVersion."
            return $false
        }
    } elseif ($remoteVersion -eq $localVersion) {
        Write-UpdateLog "Self-update check complete. Already on version $localVersion."
        return $false
    }

    $downloadUrl = Resolve-AbsoluteUrl -BaseUrl $config.manifestUrl -Value ([string]$remoteManifest.downloadUrl)
    if ([string]::IsNullOrWhiteSpace($downloadUrl)) {
        Write-UpdateLog 'Self-update skipped because remote manifest does not define downloadUrl.'
        return $false
    }

    # 安全：downloadUrl 由远端清单提供，Resolve-AbsoluteUrl 对绝对 URL 直接透传，
    # 因此清单可把下载地址指向任意主机。限制为与清单同源的 https，
    # 使被篡改的清单无法把安装包换成第三方托管的载荷。
    $downloadUri = $null
    if (-not [Uri]::TryCreate([string]$downloadUrl, [UriKind]::Absolute, [ref]$downloadUri) `
        -or $downloadUri.Scheme -ne 'https' `
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

    # 安全：完整性校验必须强制执行，不能「清单里有 sha256 才校验」。
    # 原先的 fail-open 写法把是否校验的决定权交给了可能已被篡改的一方 ——
    # 攻击者只要在清单里删掉 sha256 字段，整个校验分支就被跳过，
    # 随后压缩包会被解包并覆盖到 $ReleaseRoot（内含 runtime\node.exe 与启动脚本），
    # 用户下次启动即以自身权限执行攻击者投放的可执行文件。
    # 发布器 scripts/release/publish-portable-release.mjs 始终生成 sha256，
    # 因此强制校验不会影响任何由本项目正常发布的清单。
    $expectedHash = ([string]$remoteManifest.sha256).Trim().ToLowerInvariant()
    if ($expectedHash -notmatch '^[0-9a-f]{64}$') {
        throw 'Portable update manifest is missing a valid sha256 checksum. Refusing to install.'
    }
    $downloadHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($downloadHash -ne $expectedHash) {
        throw "Portable update hash mismatch. Expected $expectedHash but received $downloadHash."
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractDir -Force
    $packageRoot = Get-ArchiveRoot -ExtractDir $extractDir

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

    Write-UpdateLog "Portable client updated from $localVersion to $remoteVersion."
    return $true
} catch {
    Write-UpdateLog ("Portable self-update failed: " + $_.Exception.Message)
    return $false
}
