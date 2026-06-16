param(
    [switch]$StopProjectDevProcesses,
    [switch]$CleanStaleNativeAddonDirs
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$nodeModulesPath = Join-Path $projectRoot 'node_modules'
$devStopScript = Join-Path $projectRoot 'scripts\dev\dev-stop.ps1'

function Get-RelativeProjectPath {
    param([string]$Path)

    $rootFullPath = [System.IO.Path]::GetFullPath($projectRoot).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $fullPath = [System.IO.Path]::GetFullPath($Path)

    if ($fullPath.StartsWith($rootFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $fullPath.Substring($rootFullPath.Length)
    }

    return $fullPath
}

function Add-RestartManagerType {
    $existingType = ([System.Management.Automation.PSTypeName]'KkRestartManagerNativeAddonProbe').Type
    if ($existingType) {
        return
    }

    $source = @'
using System;
using System.Runtime.InteropServices;

public static class KkRestartManagerNativeAddonProbe {
    [StructLayout(LayoutKind.Sequential)]
    public struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    public enum RM_APP_TYPE {
        RmUnknownApp = 0,
        RmMainWindow = 1,
        RmOtherWindow = 2,
        RmService = 3,
        RmExplorer = 4,
        RmConsole = 5,
        RmCritical = 1000
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string strServiceShortName;
        public RM_APP_TYPE ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    public static extern int RmRegisterResources(
        uint dwSessionHandle,
        uint nFiles,
        string[] rgsFilenames,
        uint nApplications,
        IntPtr rgApplications,
        uint nServices,
        string[] rgsServiceNames
    );

    [DllImport("rstrtmgr.dll")]
    public static extern int RmGetList(
        uint dwSessionHandle,
        out uint pnProcInfoNeeded,
        ref uint pnProcInfo,
        [In, Out] RM_PROCESS_INFO[] rgAffectedApps,
        ref uint lpdwRebootReasons
    );

    [DllImport("rstrtmgr.dll")]
    public static extern int RmEndSession(uint pSessionHandle);
}
'@

    Add-Type -TypeDefinition $source -ErrorAction Stop
}

function Get-NativeAddonFiles {
    if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
        return @()
    }

    $nativeAddonPattern = '(lightningcss|tailwindcss|rollup|esbuild|sharp|canvas|argon2|node-gyp-build|napi-rs)'

    return @(Get-ChildItem -LiteralPath $nodeModulesPath -Recurse -Filter '*.node' -File -Force -ErrorAction SilentlyContinue |
        Where-Object {
            $relativePath = (Get-RelativeProjectPath -Path $_.FullName).Replace('\', '/')
            $relativePath -match $nativeAddonPattern
        } |
        Sort-Object FullName -Unique)
}

function Get-RestartManagerLockersForFile {
    param([System.IO.FileInfo]$File)

    Add-RestartManagerType

    $sessionHandle = [uint32]0
    $sessionKey = [Guid]::NewGuid().ToString()
    $startResult = [KkRestartManagerNativeAddonProbe]::RmStartSession([ref]$sessionHandle, 0, $sessionKey)
    if ($startResult -ne 0) {
        Write-Warning "Restart Manager session failed with code $startResult for $($File.FullName)."
        return @()
    }

    try {
        $registerResult = [KkRestartManagerNativeAddonProbe]::RmRegisterResources(
            $sessionHandle,
            1,
            [string[]]@($File.FullName),
            0,
            [IntPtr]::Zero,
            0,
            $null
        )

        if ($registerResult -ne 0) {
            Write-Warning "Restart Manager resource registration failed with code $registerResult for $($File.FullName)."
            return @()
        }

        $needed = [uint32]0
        $count = [uint32]0
        $rebootReasons = [uint32]0
        $emptyList = New-Object KkRestartManagerNativeAddonProbe+RM_PROCESS_INFO[] 0

        [void][KkRestartManagerNativeAddonProbe]::RmGetList(
            $sessionHandle,
            [ref]$needed,
            [ref]$count,
            $emptyList,
            [ref]$rebootReasons
        )

        if ($needed -eq 0) {
            return @()
        }

        $count = $needed
        $processList = New-Object KkRestartManagerNativeAddonProbe+RM_PROCESS_INFO[] $count
        $listResult = [KkRestartManagerNativeAddonProbe]::RmGetList(
            $sessionHandle,
            [ref]$needed,
            [ref]$count,
            $processList,
            [ref]$rebootReasons
        )

        if ($listResult -ne 0) {
            Write-Warning "Restart Manager process list failed with code $listResult for $($File.FullName)."
            return @()
        }

        $records = @()
        for ($index = 0; $index -lt $count; $index += 1) {
            $lockingProcessId = [int]$processList[$index].Process.dwProcessId
            $process = Get-CimInstance Win32_Process -Filter "ProcessId = $lockingProcessId" -ErrorAction SilentlyContinue
            $records += [pscustomobject]@{
                Path = Get-RelativeProjectPath -Path $File.FullName
                ProcessId = $lockingProcessId
                ProcessName = if ($process) { $process.Name } else { $processList[$index].strAppName }
                CommandLine = if ($process) { $process.CommandLine } else { '' }
                Source = 'Restart Manager'
            }
        }

        return $records
    } finally {
        [void][KkRestartManagerNativeAddonProbe]::RmEndSession($sessionHandle)
    }
}

function Get-NativeAddonLockRecords {
    $records = @()
    foreach ($file in @(Get-NativeAddonFiles)) {
        $records += @(Get-RestartManagerLockersForFile -File $file)
    }

    return @($records | Sort-Object Path, ProcessId -Unique)
}

function Get-ProjectDevOrTestProcesses {
    $normalizedProjectRoot = $projectRoot.Replace('\', '/')
    $processNamePattern = '^(node|npm|npx|cmd|powershell|pwsh)\.exe$'
    # Matches KK Studio dev/test commands such as npm run dev, npm.cmd run test, node --test, and Vite.
    $commandPattern = 'node_modules[\\/]vite[\\/]bin[\\/]vite\.js|scripts[\\/]dev[\\/](?:dev-launch|dev-stop|run-api-runner|run-api-dev|run-api-local|run-vite-dev)\.(?:ps1|mjs)|node --test|npm(?:\.cmd)? run (?:dev|test|verify|typecheck|build)'

    $records = @()
    foreach ($process in @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) {
        $commandLine = [string]$process.CommandLine
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            continue
        }

        if ($process.Name -notmatch $processNamePattern) {
            continue
        }

        $normalizedCommandLine = $commandLine.Replace('\', '/')
        if ($normalizedCommandLine -notmatch $commandPattern) {
            continue
        }

        $isProjectScoped = $normalizedCommandLine.Contains($normalizedProjectRoot) -or $normalizedCommandLine -match 'scripts/dev/'
        if (-not $isProjectScoped) {
            continue
        }

        if ([int]$process.ProcessId -eq $PID) {
            continue
        }

        $records += [pscustomobject]@{
            ProcessId = [int]$process.ProcessId
            ParentProcessId = [int]$process.ParentProcessId
            ProcessName = $process.Name
            CommandLine = $commandLine
        }
    }

    return @($records | Sort-Object ProcessId -Unique)
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    if ($ProcessId -eq $PID) {
        return
    }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return
    }

    & taskkill /PID $ProcessId /T /F | Out-Null
    if ($LASTEXITCODE -eq 0) {
        return
    }

    try {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    } catch {
    }
}

function Stop-ProjectDevOrTestProcesses {
    if (Test-Path -LiteralPath $devStopScript) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $devStopScript -Quiet
    }

    Start-Sleep -Milliseconds 250

    foreach ($process in @(Get-ProjectDevOrTestProcesses | Sort-Object ProcessId -Descending)) {
        Stop-ProcessTree -ProcessId $process.ProcessId
    }
}

function Get-StaleNativeAddonDirectories {
    if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
        return @()
    }

    $staleDirectoryPattern = '^\.(?:lightningcss|oxide|rollup|esbuild|sharp|canvas|argon2|node-gyp-build|napi-rs)'
    $candidateRoots = @(
        $nodeModulesPath,
        (Join-Path $nodeModulesPath '@tailwindcss'),
        (Join-Path $nodeModulesPath '@rollup'),
        (Join-Path $nodeModulesPath '@esbuild'),
        (Join-Path $nodeModulesPath '@napi-rs')
    )

    $directories = @()
    foreach ($candidateRoot in $candidateRoots) {
        if (-not (Test-Path -LiteralPath $candidateRoot)) {
            continue
        }

        $directories += @(Get-ChildItem -LiteralPath $candidateRoot -Directory -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match $staleDirectoryPattern })
    }

    return @($directories | Sort-Object FullName -Unique)
}

function Remove-StaleNativeAddonDirectories {
    $directories = @(Get-StaleNativeAddonDirectories)
    if ($directories.Count -eq 0) {
        Write-Host 'No stale native addon cleanup directories were found.'
        return
    }

    foreach ($directory in $directories) {
        $lockedFiles = @()
        foreach ($file in @(Get-ChildItem -LiteralPath $directory.FullName -Recurse -Filter '*.node' -File -Force -ErrorAction SilentlyContinue)) {
            $lockedFiles += @(Get-RestartManagerLockersForFile -File $file)
        }

        if ($lockedFiles.Count -gt 0) {
            Write-Warning "Skipping locked stale native addon directory: $(Get-RelativeProjectPath -Path $directory.FullName)"
            continue
        }

        Remove-Item -LiteralPath $directory.FullName -Recurse -Force
        Write-Host "Removed stale native addon directory: $(Get-RelativeProjectPath -Path $directory.FullName)"
    }
}

function Write-TableOrMessage {
    param(
        [object[]]$Rows,
        [string]$EmptyMessage
    )

    if ($Rows.Count -eq 0) {
        Write-Host $EmptyMessage
        return
    }

    $Rows | Format-Table -Wrap -AutoSize | Out-String | Write-Host
}

Set-Location $projectRoot

Write-Host 'KK Studio Windows npm clean-install lock diagnostics'
Write-Host "Project root: $projectRoot"

$nativeAddonFiles = @(Get-NativeAddonFiles)
Write-Host "Native addon files checked: $($nativeAddonFiles.Count)"

$lockRecords = @(Get-NativeAddonLockRecords)
Write-TableOrMessage -Rows $lockRecords -EmptyMessage 'No locked native addon files were reported by Restart Manager.'

$projectProcesses = @(Get-ProjectDevOrTestProcesses)
Write-TableOrMessage -Rows $projectProcesses -EmptyMessage 'No KK Studio dev/test processes were detected.'

if ($StopProjectDevProcesses) {
    Write-Host 'Stopping KK Studio dev/test processes before npm clean install...'
    Stop-ProjectDevOrTestProcesses

    $remainingProcesses = @(Get-ProjectDevOrTestProcesses)
    Write-TableOrMessage -Rows $remainingProcesses -EmptyMessage 'No KK Studio dev/test processes remain.'

    $remainingLocks = @(Get-NativeAddonLockRecords)
    Write-TableOrMessage -Rows $remainingLocks -EmptyMessage 'No locked native addon files remain after stopping dev/test processes.'
}

if ($CleanStaleNativeAddonDirs) {
    Remove-StaleNativeAddonDirectories
}

if (-not $StopProjectDevProcesses -and -not $CleanStaleNativeAddonDirs) {
    Write-Host 'To prepare for npm ci on Windows, run: npm run install:recover'
}
