param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFilePath = Join-Path $ScriptDir 'alipay-mcp.env'

function Import-EnvFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing config file: $Path`nCopy scripts/alipay-mcp.env.example to scripts/alipay-mcp.env and fill your values."
    }

    $loadedKeys = @()
    $lines = Get-Content -LiteralPath $Path -ErrorAction Stop

    foreach ($line in $lines) {
        $trimmed = $line.Trim()

        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }

        $separatorIndex = $trimmed.IndexOf('=')
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1).Trim()

        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }

        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        $loadedKeys += $key
    }

    return $loadedKeys
}

$loadedKeys = Import-EnvFile -Path $EnvFilePath

if (-not $env:AP_APP_ID -or -not $env:AP_APP_KEY -or -not $env:AP_PUB_KEY) {
    throw 'scripts/alipay-mcp.env is missing one of the required keys: AP_APP_ID, AP_APP_KEY, AP_PUB_KEY.'
}

if ($DryRun) {
    Write-Output ("Loaded Alipay MCP config from " + $EnvFilePath)
    Write-Output ("Loaded keys: " + ($loadedKeys -join ', '))
    exit 0
}

npx -y @modelcontextprotocol/inspector npx -y @alipay/mcp-server-alipay
