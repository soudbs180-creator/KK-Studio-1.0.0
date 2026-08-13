param(
    [Parameter(Mandatory = $true)]
    [string]$UpdaterPath,

    [Parameter(Mandatory = $true)]
    [string]$ReleaseRoot,

    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,

    [Parameter(Mandatory = $true)]
    [string]$RemoteManifestPath,

    [Parameter(Mandatory = $true)]
    [string]$ArchiveFixturePath
)

$ErrorActionPreference = 'Stop'

function Invoke-RestMethod {
    param(
        [string]$Uri,
        [hashtable]$Headers,
        [int]$TimeoutSec
    )

    return Get-Content -LiteralPath $RemoteManifestPath -Raw | ConvertFrom-Json
}

function Invoke-WebRequest {
    param(
        [string]$Uri,
        [string]$OutFile,
        [switch]$UseBasicParsing,
        [int]$TimeoutSec
    )

    Copy-Item -LiteralPath $ArchiveFixturePath -Destination $OutFile -Force
}

$updated = & $UpdaterPath -ReleaseRoot $ReleaseRoot -ConfigPath $ConfigPath
if ($updated -contains $true) {
    exit 0
}
exit 18
