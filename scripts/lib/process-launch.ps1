function ConvertTo-KkWindowsCommandLineArgument {
    param(
        [AllowEmptyString()]
        [string]$Argument
    )

    if ($Argument.Length -gt 0 -and $Argument -notmatch '[\s"]') {
        return $Argument
    }

    # Start-Process flattens ArgumentList before CreateProcess. Encode each
    # argument with the Win32 CRT rules so spaces, quotes and trailing slashes
    # arrive at Node and PowerShell without being split or consumed.
    $builder = [System.Text.StringBuilder]::new()
    [void]$builder.Append([char]'"')
    $backslashCount = 0

    foreach ($character in $Argument.ToCharArray()) {
        if ($character -eq [char]'\') {
            $backslashCount += 1
            continue
        }

        if ($character -eq [char]'"') {
            [void]$builder.Append([char]'\', ($backslashCount * 2) + 1)
            [void]$builder.Append([char]'"')
        } else {
            [void]$builder.Append([char]'\', $backslashCount)
            [void]$builder.Append($character)
        }
        $backslashCount = 0
    }

    [void]$builder.Append([char]'\', $backslashCount * 2)
    [void]$builder.Append([char]'"')
    return $builder.ToString()
}

function ConvertTo-KkProcessArgumentString {
    param([AllowEmptyCollection()][string[]]$Arguments = @())

    $encodedArguments = @(
        foreach ($argument in $Arguments) {
            ConvertTo-KkWindowsCommandLineArgument -Argument ([string]$argument)
        }
    )
    return $encodedArguments -join ' '
}

function Start-KkProcess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [AllowEmptyCollection()]
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory,
        [ValidateSet('Normal', 'Hidden', 'Minimized', 'Maximized')]
        [string]$WindowStyle = 'Normal',
        [string]$RedirectStandardOutput,
        [string]$RedirectStandardError,
        [switch]$PassThru,
        [switch]$Wait
    )

    $startProcessParameters = @{
        FilePath = $FilePath
        WindowStyle = $WindowStyle
    }
    if ($Arguments.Count -gt 0) {
        $startProcessParameters.ArgumentList = ConvertTo-KkProcessArgumentString -Arguments $Arguments
    }
    if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
        $startProcessParameters.WorkingDirectory = $WorkingDirectory
    }
    if (-not [string]::IsNullOrWhiteSpace($RedirectStandardOutput)) {
        $startProcessParameters.RedirectStandardOutput = $RedirectStandardOutput
    }
    if (-not [string]::IsNullOrWhiteSpace($RedirectStandardError)) {
        $startProcessParameters.RedirectStandardError = $RedirectStandardError
    }
    if ($PassThru) {
        $startProcessParameters.PassThru = $true
    }
    if ($Wait) {
        $startProcessParameters.Wait = $true
    }

    return Start-Process @startProcessParameters
}
