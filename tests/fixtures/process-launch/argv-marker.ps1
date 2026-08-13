param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [string]$Marker,
    [int]$ExitCode = 0,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArguments = @()
)

$payload = [ordered]@{
    scriptPath = $PSCommandPath
    outputPath = $OutputPath
    marker = $Marker
    remainingArguments = @($RemainingArguments)
    cwd = (Get-Location).Path
}

$payload | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
exit $ExitCode
