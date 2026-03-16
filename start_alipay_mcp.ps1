param(
    [switch]$DryRun
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LauncherPath = Join-Path $ScriptDir 'scripts\start-alipay-mcp.ps1'

if (-not (Test-Path -LiteralPath $LauncherPath)) {
    throw "Launcher script not found: $LauncherPath"
}

& $LauncherPath @PSBoundParameters
