[CmdletBinding()]
param(
    [string]$CodexHome = (Join-Path $env:USERPROFILE ".codex"),
    [string]$OutputDir = (Join-Path $PSScriptRoot "codex-chat-recovery"),
    [int]$Newest = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ThreadIdFromPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $match = [regex]::Match(
        [System.IO.Path]::GetFileName($Path),
        "([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
    )

    if ($match.Success) {
        return $match.Groups[1].Value.ToLowerInvariant()
    }

    return $null
}

function Join-ContentText {
    param(
        [AllowNull()]
        [object]$Content
    )

    if ($null -eq $Content) {
        return ""
    }

    if ($Content -is [string]) {
        return $Content
    }

    if ($Content.PSObject.Properties.Name -contains "text") {
        return [string]$Content.text
    }

    if ($Content.PSObject.Properties.Name -contains "content") {
        return Join-ContentText -Content $Content.content
    }

    $chunks = New-Object System.Collections.Generic.List[string]

    if ($Content -is [System.Collections.IEnumerable]) {
        foreach ($item in $Content) {
            if ($null -eq $item) {
                continue
            }

            if ($item -is [string]) {
                [void]$chunks.Add($item)
                continue
            }

            $text = $null
            if ($item.PSObject.Properties.Name -contains "text") {
                $text = $item.text
            } elseif ($item.PSObject.Properties.Name -contains "message") {
                $text = $item.message
            } elseif ($item.PSObject.Properties.Name -contains "content") {
                $text = Join-ContentText -Content $item.content
            }

            if (-not [string]::IsNullOrWhiteSpace($text)) {
                [void]$chunks.Add([string]$text)
            }
        }
    }

    return ($chunks -join "`n").Trim()
}

function Test-IsInjectedContextText {
    param(
        [AllowNull()]
        [string]$Text
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $true
    }

    $trimmed = $Text.Trim()
    return (
        $trimmed.StartsWith("# AGENTS.md instructions for") -or
        $trimmed.StartsWith("<environment_context>") -or
        $trimmed.StartsWith("<permissions instructions>")
    )
}

function Get-OneLineSummary {
    param(
        [AllowNull()]
        [string]$Text,
        [int]$MaxLength = 80
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return ""
    }

    $singleLine = [regex]::Replace($Text, "<[^>]+>", " ")
    $singleLine = [regex]::Replace($singleLine, "\s+", " ").Trim()

    if ($singleLine.Length -le $MaxLength) {
        return $singleLine
    }

    return $singleLine.Substring(0, $MaxLength - 3).TrimEnd() + "..."
}

function New-SafeName {
    param(
        [AllowNull()]
        [string]$Text
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return "untitled"
    }

    $safe = [regex]::Replace($Text, '[<>:"/\\|?*\x00-\x1F]', "-")
    $safe = [regex]::Replace($safe, "\s+", " ").Trim()
    $safe = $safe.Trim(". ")

    if ([string]::IsNullOrWhiteSpace($safe)) {
        return "untitled"
    }

    if ($safe.Length -gt 70) {
        $safe = $safe.Substring(0, 70).TrimEnd()
    }

    return $safe
}

function Get-DateLabel {
    param(
        [AllowNull()]
        [string]$Value
    )

    if (-not [string]::IsNullOrWhiteSpace($Value)) {
        try {
            return ([datetime]$Value).ToString("yyyyMMdd-HHmmss")
        } catch {
        }
    }

    return (Get-Date).ToString("yyyyMMdd-HHmmss")
}

function Add-MessageRecord {
    param(
        [Parameter(Mandatory = $true)]
        [System.Collections.Generic.List[object]]$Messages,
        [Parameter(Mandatory = $true)]
        [System.Collections.Generic.HashSet[string]]$Seen,
        [AllowNull()]
        [string]$Timestamp,
        [Parameter(Mandatory = $true)]
        [string]$Role,
        [AllowNull()]
        [string]$Text,
        [AllowNull()]
        [string]$Phase
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return
    }

    $normalizedText = $Text.Trim()
    if ($Role -eq "user" -and (Test-IsInjectedContextText -Text $normalizedText)) {
        return
    }

    $key = "{0}|{1}|{2}|{3}" -f $Timestamp, $Role, $Phase, $normalizedText
    if (-not $Seen.Add($key)) {
        return
    }

    $Messages.Add([pscustomobject]@{
        Timestamp = $Timestamp
        Role      = $Role
        Phase     = $Phase
        Text      = $normalizedText
    })
}

function Read-SessionIndex {
    param(
        [Parameter(Mandatory = $true)]
        [string]$IndexPath
    )

    $index = @{}
    if (-not (Test-Path -LiteralPath $IndexPath)) {
        return $index
    }

    foreach ($line in [System.IO.File]::ReadLines($IndexPath)) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        try {
            $entry = $line | ConvertFrom-Json
        } catch {
            continue
        }

        if ($null -eq $entry.id) {
            continue
        }

        $threadId = ([string]$entry.id).ToLowerInvariant()
        $index[$threadId] = [pscustomobject]@{
            Id        = $threadId
            ThreadName = [string]$entry.thread_name
            UpdatedAt = [string]$entry.updated_at
        }
    }

    return $index
}

function Read-RolloutTranscript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [hashtable]$IndexLookup,
        [Parameter(Mandatory = $true)]
        [bool]$Archived
    )

    $threadId = Get-ThreadIdFromPath -Path $Path
    if ($null -eq $threadId) {
        return $null
    }

    $messages = New-Object 'System.Collections.Generic.List[object]'
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'

    $sessionMeta = $null
    $warnings = New-Object 'System.Collections.Generic.List[string]'

    foreach ($line in [System.IO.File]::ReadLines($Path)) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        try {
            $entry = $line | ConvertFrom-Json
        } catch {
            [void]$warnings.Add("Failed to parse JSON line.")
            continue
        }

        $entryType = [string]$entry.type
        $timestamp = [string]$entry.timestamp

        if ($entryType -eq "session_meta") {
            $sessionMeta = $entry.payload
            continue
        }

        if ($entryType -eq "response_item" -and $null -ne $entry.payload) {
            if ([string]$entry.payload.type -eq "message") {
                $role = [string]$entry.payload.role
                if ($role -eq "user" -or $role -eq "assistant") {
                    $text = Join-ContentText -Content $entry.payload.content
                    $phase = $null
                    if ($entry.payload.PSObject.Properties.Name -contains "phase") {
                        $phase = [string]$entry.payload.phase
                    }

                    Add-MessageRecord -Messages $messages -Seen $seen -Timestamp $timestamp -Role $role -Text $text -Phase $phase
                }
            }

            continue
        }

        if ($entryType -eq "event_msg" -and $null -ne $entry.payload) {
            $payloadType = [string]$entry.payload.type

            if ($payloadType -eq "user_message") {
                Add-MessageRecord -Messages $messages -Seen $seen -Timestamp $timestamp -Role "user" -Text ([string]$entry.payload.message) -Phase $null
            } elseif ($payloadType -eq "agent_message") {
                Add-MessageRecord -Messages $messages -Seen $seen -Timestamp $timestamp -Role "assistant" -Text ([string]$entry.payload.message) -Phase $null
            }
        }
    }

    $indexEntry = $IndexLookup[$threadId]
    $title = ""
    $updatedAt = ""

    if ($null -ne $indexEntry) {
        $title = [string]$indexEntry.ThreadName
        $updatedAt = [string]$indexEntry.UpdatedAt
    }

    if ([string]::IsNullOrWhiteSpace($title)) {
        $firstUserMessage = $messages | Where-Object { $_.Role -eq "user" } | Select-Object -First 1
        if ($null -ne $firstUserMessage) {
            $title = Get-OneLineSummary -Text $firstUserMessage.Text
        }
    }

    if ([string]::IsNullOrWhiteSpace($title)) {
        $title = [System.IO.Path]::GetFileNameWithoutExtension($Path)
    }

    if ([string]::IsNullOrWhiteSpace($updatedAt)) {
        $lastMessage = $messages | Select-Object -Last 1
        if ($null -ne $lastMessage -and -not [string]::IsNullOrWhiteSpace($lastMessage.Timestamp)) {
            $updatedAt = [string]$lastMessage.Timestamp
        } elseif ($null -ne $sessionMeta -and $sessionMeta.PSObject.Properties.Name -contains "timestamp") {
            $updatedAt = [string]$sessionMeta.timestamp
        } else {
            $updatedAt = (Get-Item -LiteralPath $Path).LastWriteTimeUtc.ToString("o")
        }
    }

    $userCount = @($messages | Where-Object { $_.Role -eq "user" }).Count
    $assistantCount = @($messages | Where-Object { $_.Role -eq "assistant" }).Count

    return [pscustomobject]@{
        ThreadId         = $threadId
        Title            = $title
        Archived         = $Archived
        UpdatedAt        = $updatedAt
        MessageCount     = $messages.Count
        UserCount        = $userCount
        AssistantCount   = $assistantCount
        RolloutPath      = $Path
        SessionTimestamp = if ($null -ne $sessionMeta -and $sessionMeta.PSObject.Properties.Name -contains "timestamp") { [string]$sessionMeta.timestamp } else { "" }
        Cwd              = if ($null -ne $sessionMeta -and $sessionMeta.PSObject.Properties.Name -contains "cwd") { [string]$sessionMeta.cwd } else { "" }
        Originator       = if ($null -ne $sessionMeta -and $sessionMeta.PSObject.Properties.Name -contains "originator") { [string]$sessionMeta.originator } else { "" }
        Source           = if ($null -ne $sessionMeta -and $sessionMeta.PSObject.Properties.Name -contains "source") { [string]$sessionMeta.source } else { "" }
        Warnings         = $warnings
        Messages         = $messages
    }
}

function Write-TranscriptMarkdown {
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$Transcript,
        [Parameter(Mandatory = $true)]
        [string]$DestinationRoot
    )

    $bucket = if ($Transcript.Archived) { "archived" } else { "active" }
    $targetDir = Join-Path $DestinationRoot $bucket
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

    $titleSlug = New-SafeName -Text $Transcript.Title
    $fileName = "{0}--{1}--{2}.md" -f (
        (Get-DateLabel -Value $Transcript.UpdatedAt)
    ), $Transcript.ThreadId, $titleSlug

    $targetPath = Join-Path $targetDir $fileName

    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add("# " + $Transcript.Title)
    [void]$lines.Add("")
    [void]$lines.Add("- Thread ID: " + $Transcript.ThreadId)
    [void]$lines.Add("- Archived: " + ($(if ($Transcript.Archived) { "yes" } else { "no" })))
    [void]$lines.Add("- Updated At: " + $Transcript.UpdatedAt)

    if (-not [string]::IsNullOrWhiteSpace($Transcript.SessionTimestamp)) {
        [void]$lines.Add("- Session Started: " + $Transcript.SessionTimestamp)
    }

    if (-not [string]::IsNullOrWhiteSpace($Transcript.Cwd)) {
        [void]$lines.Add("- Working Directory: " + $Transcript.Cwd)
    }

    if (-not [string]::IsNullOrWhiteSpace($Transcript.Originator)) {
        [void]$lines.Add("- Originator: " + $Transcript.Originator)
    }

    if (-not [string]::IsNullOrWhiteSpace($Transcript.Source)) {
        [void]$lines.Add("- Source: " + $Transcript.Source)
    }

    [void]$lines.Add("- Rollout File: " + $Transcript.RolloutPath)
    [void]$lines.Add("")
    [void]$lines.Add("## Transcript")
    [void]$lines.Add("")

    foreach ($message in $Transcript.Messages) {
        $heading = if ($message.Role -eq "user") { "User" } else { "Assistant" }
        [void]$lines.Add("### " + $heading)
        if (-not [string]::IsNullOrWhiteSpace($message.Timestamp)) {
            [void]$lines.Add("Timestamp: " + $message.Timestamp)
        }
        if (-not [string]::IsNullOrWhiteSpace($message.Phase)) {
            [void]$lines.Add("Phase: " + $message.Phase)
        }
        [void]$lines.Add("")
        [void]$lines.Add($message.Text.Trim())
        [void]$lines.Add("")
    }

    [System.IO.File]::WriteAllLines($targetPath, $lines)
    return $targetPath
}

if (-not (Test-Path -LiteralPath $CodexHome)) {
    throw "Codex home not found: $CodexHome"
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$indexLookup = Read-SessionIndex -IndexPath (Join-Path $CodexHome "session_index.jsonl")

$rolloutFiles = New-Object System.Collections.Generic.List[object]

$activeDir = Join-Path $CodexHome "sessions"
if (Test-Path -LiteralPath $activeDir) {
    Get-ChildItem -LiteralPath $activeDir -Recurse -File -Filter "*.jsonl" | ForEach-Object {
        [void]$rolloutFiles.Add([pscustomobject]@{
            Path     = $_.FullName
            Archived = $false
        })
    }
}

$archivedDir = Join-Path $CodexHome "archived_sessions"
if (Test-Path -LiteralPath $archivedDir) {
    Get-ChildItem -LiteralPath $archivedDir -Recurse -File -Filter "*.jsonl" | ForEach-Object {
        [void]$rolloutFiles.Add([pscustomobject]@{
            Path     = $_.FullName
            Archived = $true
        })
    }
}

if ($rolloutFiles.Count -eq 0) {
    throw "No rollout files found under $CodexHome"
}

$orderedRollouts = $rolloutFiles | ForEach-Object {
    [pscustomobject]@{
        Path             = $_.Path
        Archived         = $_.Archived
        LastWriteTimeUtc = (Get-Item -LiteralPath $_.Path).LastWriteTimeUtc
    }
} | Sort-Object -Property LastWriteTimeUtc -Descending

if ($Newest -gt 0) {
    $orderedRollouts = $orderedRollouts | Select-Object -First $Newest
}

$transcripts = New-Object System.Collections.Generic.List[object]

foreach ($entry in $orderedRollouts) {
    $transcript = Read-RolloutTranscript -Path $entry.Path -IndexLookup $indexLookup -Archived $entry.Archived
    if ($null -eq $transcript) {
        continue
    }

    $markdownPath = Write-TranscriptMarkdown -Transcript $transcript -DestinationRoot $OutputDir
    $transcript | Add-Member -NotePropertyName MarkdownPath -NotePropertyValue $markdownPath
    [void]$transcripts.Add($transcript)
}

$indexRows = foreach ($transcript in $transcripts) {
    [pscustomobject]@{
        ThreadId         = $transcript.ThreadId
        Title            = $transcript.Title
        Archived         = $transcript.Archived
        UpdatedAt        = $transcript.UpdatedAt
        MessageCount     = $transcript.MessageCount
        UserMessages     = $transcript.UserCount
        AssistantMessages = $transcript.AssistantCount
        Cwd              = $transcript.Cwd
        Originator       = $transcript.Originator
        Source           = $transcript.Source
        RolloutPath      = $transcript.RolloutPath
        MarkdownPath     = $transcript.MarkdownPath
    }
}

$indexCsvPath = Join-Path $OutputDir "recovered-index.csv"
$indexJsonPath = Join-Path $OutputDir "recovered-index.json"
$summaryPath = Join-Path $OutputDir "README.md"

$indexRows | Sort-Object UpdatedAt -Descending | Export-Csv -LiteralPath $indexCsvPath -NoTypeInformation -Encoding UTF8
$indexRows | Sort-Object UpdatedAt -Descending | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $indexJsonPath -Encoding UTF8

$summaryLines = New-Object System.Collections.Generic.List[string]
[void]$summaryLines.Add("# Codex Chat Recovery")
[void]$summaryLines.Add("")
[void]$summaryLines.Add("- Codex home: " + $CodexHome)
[void]$summaryLines.Add("- Output directory: " + $OutputDir)
[void]$summaryLines.Add("- Active threads exported: " + (@($transcripts | Where-Object { -not $_.Archived }).Count))
[void]$summaryLines.Add("- Archived threads exported: " + (@($transcripts | Where-Object { $_.Archived }).Count))
[void]$summaryLines.Add("- Index CSV: " + $indexCsvPath)
[void]$summaryLines.Add("- Index JSON: " + $indexJsonPath)
[void]$summaryLines.Add("")
[void]$summaryLines.Add("## Newest Threads")
[void]$summaryLines.Add("")

foreach ($row in ($indexRows | Sort-Object UpdatedAt -Descending | Select-Object -First 20)) {
    $archivedTag = if ($row.Archived) { "[archived]" } else { "[active]" }
    [void]$summaryLines.Add("- " + $archivedTag + " " + $row.UpdatedAt + " :: " + $row.Title + " :: " + $row.MarkdownPath)
}

[void]$summaryLines.Add("")
[void]$summaryLines.Add("## Notes")
[void]$summaryLines.Add("")
[void]$summaryLines.Add("- This script is read-only against the Codex store. It does not modify state_5.sqlite, session_index.jsonl, or rollout files.")
[void]$summaryLines.Add("- If a thread is missing in the Codex UI but present here, that points to a local UI/indexing bug rather than confirmed data loss.")
[void]$summaryLines.Add("- Archived threads are exported under the archived folder; active threads are exported under the active folder.")

[System.IO.File]::WriteAllLines($summaryPath, $summaryLines)

Write-Host ""
Write-Host "Recovered $($transcripts.Count) thread(s)."
Write-Host "Summary: $summaryPath"
Write-Host "Index CSV: $indexCsvPath"
Write-Host "Index JSON: $indexJsonPath"
