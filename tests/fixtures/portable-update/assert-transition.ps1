param(
    [Parameter(Mandatory = $true)]
    [string]$PolicyPath,

    [Parameter(Mandatory = $true)]
    [string]$LocalManifestPath,

    [Parameter(Mandatory = $true)]
    [string]$RemoteManifestPath,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedChannel,

    [string]$AcceptedStatePath
)

$ErrorActionPreference = 'Stop'

. $PolicyPath

$localManifest = Get-Content -LiteralPath $LocalManifestPath -Raw | ConvertFrom-Json
$remoteManifest = Get-Content -LiteralPath $RemoteManifestPath -Raw | ConvertFrom-Json
$acceptedState = if ($AcceptedStatePath) {
    Get-Content -LiteralPath $AcceptedStatePath -Raw | ConvertFrom-Json
} else {
    $null
}

try {
    Assert-PortableUpdateTransition `
        -LocalManifest $localManifest `
        -RemoteManifest $remoteManifest `
        -ExpectedChannel $ExpectedChannel `
        -AcceptedState $acceptedState
    Write-Output 'accepted'
    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 17
}
