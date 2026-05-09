param(
    [string]$ProjectPath = ".",
    [string]$Framework = "vite"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Net.Http

$resolvedProjectPath = (Resolve-Path $ProjectPath).Path
$tempDir = Join-Path $env:TEMP ("kk-studio-vercel-" + [guid]::NewGuid().ToString())
$tarball = Join-Path $tempDir "project.tgz"
$endpoint = "https://codex-deploy-skills.vercel.sh/api/deploy"

$fileStream = $null
$client = $null

try {
    New-Item -ItemType Directory -Path $tempDir | Out-Null

    tar.exe `
        --exclude=m `
        --exclude=node_modules `
        --exclude=.git `
        --exclude=.github `
        --exclude=.agent `
        --exclude=.agents `
        --exclude=.claude `
        --exclude=.codex-* `
        --exclude=.kk-local `
        --exclude=.npm-cache `
        --exclude=.tmp `
        --exclude=.tmp-* `
        --exclude=.worktrees `
        --exclude=.env `
        --exclude=.env.* `
        --exclude=dist `
        --exclude=build `
        --exclude=coverage `
        --exclude=output `
        --exclude=tests `
        --exclude=docs `
        --exclude=deploy `
        --exclude=release `
        --exclude=AGENTS.md `
        --exclude=plans.md `
        --exclude=implement.md `
        --exclude=status.md `
        --exclude=validation.md `
        --exclude=*.log `
        --exclude=*.out `
        --exclude=*.err `
        --exclude=*.out.log `
        --exclude=*.err.log `
        --exclude=tmp-*.out `
        --exclude=tmp-*.err `
        --exclude=*.bak `
        --exclude=*.backup `
        -czf $tarball `
        -C $resolvedProjectPath .

    if (!(Test-Path $tarball)) {
        throw "Tarball was not created."
    }

    $client = New-Object System.Net.Http.HttpClient
    $content = New-Object System.Net.Http.MultipartFormDataContent

    $fileStream = [System.IO.File]::OpenRead($tarball)
    $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/gzip")

    $content.Add($fileContent, "file", "project.tgz")
    $content.Add((New-Object System.Net.Http.StringContent($Framework)), "framework")

    $response = $client.PostAsync($endpoint, $content).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

    if (-not $response.IsSuccessStatusCode) {
        throw "Deploy request failed: $($response.StatusCode) $body"
    }

    $json = $body | ConvertFrom-Json
    $json | ConvertTo-Json -Depth 10
}
finally {
    if ($fileStream) {
        $fileStream.Dispose()
    }
    if ($client) {
        $client.Dispose()
    }
    if (Test-Path $tempDir) {
        Remove-Item -Recurse -Force $tempDir
    }
}
