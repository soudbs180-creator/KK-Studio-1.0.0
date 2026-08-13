$script:PortableReleaseChannels = @(
    'development',
    'internal',
    'canary',
    'release-candidate',
    'stable'
)

function ConvertTo-PortableReleaseSequence {
    param(
        [object]$Value,
        [string]$FieldName = 'releaseSequence'
    )

    $parsed = 0L
    if ($null -eq $Value `
        -or -not [long]::TryParse([string]$Value, [ref]$parsed) `
        -or $parsed -lt 0 `
        -or [string]$Value -match '[^0-9]') {
        throw "Portable update $FieldName must be a non-negative integer."
    }
    return $parsed
}

function ConvertTo-PortableSemanticVersion {
    param([string]$Value)

    $pattern = '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$'
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -notmatch $pattern) {
        throw "Portable update artifactVersion is not valid SemVer: $Value"
    }
    $core = @([long]$Matches[1], [long]$Matches[2], [long]$Matches[3])
    $prerelease = @()
    if ($Matches[4]) {
        foreach ($identifier in $Matches[4].Split('.')) {
            $numericValue = 0L
            $isNumeric = [long]::TryParse($identifier, [ref]$numericValue)
            if ($isNumeric -and $identifier.Length -gt 1 -and $identifier.StartsWith('0')) {
                throw "Portable update artifactVersion has a leading-zero prerelease identifier: $Value"
            }
            $prerelease += [pscustomobject]@{
                IsNumeric = $isNumeric
                NumericValue = $numericValue
                Text = $identifier
            }
        }
    }
    return [pscustomobject]@{ Raw = $Value; Core = $core; Prerelease = $prerelease }
}

function Compare-PortablePrerelease {
    param([object[]]$Left, [object[]]$Right)

    if ($Left.Count -eq 0 -or $Right.Count -eq 0) {
        if ($Left.Count -eq $Right.Count) { return 0 }
        if ($Left.Count -eq 0) { return 1 }
        return -1
    }
    for ($index = 0; $index -lt [Math]::Max($Left.Count, $Right.Count); $index += 1) {
        if ($index -ge $Left.Count) { return -1 }
        if ($index -ge $Right.Count) { return 1 }
        $leftPart = $Left[$index]
        $rightPart = $Right[$index]
        if ($leftPart.IsNumeric -and -not $rightPart.IsNumeric) { return -1 }
        if (-not $leftPart.IsNumeric -and $rightPart.IsNumeric) { return 1 }
        if ($leftPart.IsNumeric -and $leftPart.NumericValue -ne $rightPart.NumericValue) {
            return [Math]::Sign($leftPart.NumericValue - $rightPart.NumericValue)
        }
        $textOrder = [string]::CompareOrdinal($leftPart.Text, $rightPart.Text)
        if (-not $leftPart.IsNumeric -and $textOrder -ne 0) { return [Math]::Sign($textOrder) }
    }
    return 0
}

function Compare-PortableSemanticVersion {
    param([string]$Left, [string]$Right)

    $leftVersion = ConvertTo-PortableSemanticVersion -Value $Left
    $rightVersion = ConvertTo-PortableSemanticVersion -Value $Right
    for ($index = 0; $index -lt 3; $index += 1) {
        if ($leftVersion.Core[$index] -ne $rightVersion.Core[$index]) {
            return [Math]::Sign($leftVersion.Core[$index] - $rightVersion.Core[$index])
        }
    }
    return Compare-PortablePrerelease -Left $leftVersion.Prerelease -Right $rightVersion.Prerelease
}

function Assert-PortableManifestShape {
    param(
        [object]$Manifest,
        [string]$ExpectedKind,
        [string]$Label
    )

    if ($null -eq $Manifest -or $Manifest.schemaVersion -ne 1) {
        throw "Portable update $Label manifest must use schemaVersion 1."
    }
    if ([string]$Manifest.provenance.kind -ne $ExpectedKind) {
        throw "Portable update $Label manifest provenance must be $ExpectedKind."
    }
    $channel = [string]$Manifest.channel
    if ($script:PortableReleaseChannels -notcontains $channel `
        -or [string]$Manifest.releasePhase -ne $channel) {
        throw "Portable update $Label channel is invalid or differs from releasePhase."
    }
    $target = ConvertTo-PortableSemanticVersion -Value ([string]$Manifest.releaseTarget)
    if ($target.Prerelease.Count -ne 0) {
        throw "Portable update $Label releaseTarget must be a numeric core version."
    }
    $artifact = ConvertTo-PortableSemanticVersion -Value ([string]$Manifest.artifactVersion)
    if (($artifact.Core -join '.') -ne ($target.Core -join '.')) {
        throw "Portable update $Label artifactVersion must use the releaseTarget core."
    }
    ConvertTo-PortableReleaseSequence -Value $Manifest.releaseSequence -FieldName "$Label releaseSequence" | Out-Null
}

function Assert-PortableAcceptedState {
    param(
        [object]$AcceptedState,
        [object]$RemoteManifest,
        [string]$ExpectedChannel
    )

    if ($null -eq $AcceptedState) { return }
    if ([string]$AcceptedState.channel -ne $ExpectedChannel) {
        throw 'Portable update accepted state belongs to another channel.'
    }
    $targetOrder = Compare-PortableSemanticVersion `
        -Left ([string]$RemoteManifest.releaseTarget) `
        -Right ([string]$AcceptedState.releaseTarget)
    if ($targetOrder -lt 0) { throw 'Portable update replayed an older accepted release target.' }
    $remoteSequence = ConvertTo-PortableReleaseSequence -Value $RemoteManifest.releaseSequence
    $acceptedSequence = ConvertTo-PortableReleaseSequence `
        -Value $AcceptedState.releaseSequence `
        -FieldName 'accepted releaseSequence'
    if ($targetOrder -eq 0 -and $remoteSequence -le $acceptedSequence) {
        throw 'Portable update replayed an already accepted sequence.'
    }
}

function Assert-PortableUpdateOrdering {
    param([object]$LocalManifest, [object]$RemoteManifest)

    $targetOrder = Compare-PortableSemanticVersion `
        -Left ([string]$RemoteManifest.releaseTarget) `
        -Right ([string]$LocalManifest.releaseTarget)
    if ($targetOrder -lt 0) { throw 'Portable update release target downgrade was rejected.' }
    $artifactOrder = Compare-PortableSemanticVersion `
        -Left ([string]$RemoteManifest.artifactVersion) `
        -Right ([string]$LocalManifest.artifactVersion)
    if ($artifactOrder -lt 0) { throw 'Portable update artifactVersion downgrade was rejected.' }
    $remoteSequence = ConvertTo-PortableReleaseSequence -Value $RemoteManifest.releaseSequence
    $localSequence = ConvertTo-PortableReleaseSequence -Value $LocalManifest.releaseSequence
    if ($targetOrder -eq 0 -and $remoteSequence -le $localSequence) {
        throw 'Portable update releaseSequence replay was rejected.'
    }
    $correctedStable = $artifactOrder -eq 0 `
        -and [string]$RemoteManifest.channel -eq 'stable' `
        -and [string]$LocalManifest.channel -eq 'stable'
    if ($artifactOrder -eq 0 -and -not $correctedStable) {
        throw 'Portable update artifactVersion replay was rejected.'
    }
}

function Assert-PortableUpdateTransition {
    param(
        [object]$LocalManifest,
        [object]$RemoteManifest,
        [string]$ExpectedChannel,
        [object]$AcceptedState
    )

    Assert-PortableManifestShape `
        -Manifest $LocalManifest `
        -ExpectedKind 'kk-studio-web-build' `
        -Label 'local build'
    Assert-PortableManifestShape `
        -Manifest $RemoteManifest `
        -ExpectedKind 'kk-studio-portable-publication' `
        -Label 'remote publication'
    if ([string]$LocalManifest.channel -ne $ExpectedChannel `
        -or [string]$RemoteManifest.channel -ne $ExpectedChannel) {
        throw "Portable update channel must remain $ExpectedChannel."
    }
    if ([string]$RemoteManifest.sha256 -notmatch '^[a-f0-9]{64}$' `
        -or [string]$RemoteManifest.envelopeHash -notmatch '^[a-f0-9]{64}$') {
        throw 'Portable update remote publication hashes are invalid.'
    }
    Assert-PortableAcceptedState `
        -AcceptedState $AcceptedState `
        -RemoteManifest $RemoteManifest `
        -ExpectedChannel $ExpectedChannel
    Assert-PortableUpdateOrdering -LocalManifest $LocalManifest -RemoteManifest $RemoteManifest
}

function Assert-PortablePackageMatchesPublication {
    param([object]$PackageManifest, [object]$RemoteManifest)

    Assert-PortableManifestShape `
        -Manifest $PackageManifest `
        -ExpectedKind 'kk-studio-web-build' `
        -Label 'downloaded build'
    foreach ($field in @('releaseTarget', 'releasePhase', 'releaseSequence', 'artifactVersion', 'channel')) {
        if ($PackageManifest.$field -ne $RemoteManifest.$field) {
            throw "Portable update downloaded build $field does not match the publication envelope."
        }
    }
}

function New-PortableAcceptedUpdateState {
    param([object]$RemoteManifest)

    return [ordered]@{
        schemaVersion = 1
        channel = [string]$RemoteManifest.channel
        releaseTarget = [string]$RemoteManifest.releaseTarget
        releaseSequence = [long]$RemoteManifest.releaseSequence
        artifactVersion = [string]$RemoteManifest.artifactVersion
        artifactSha256 = [string]$RemoteManifest.sha256
        envelopeHash = [string]$RemoteManifest.envelopeHash
    }
}
