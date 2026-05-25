# 合并 docs/docs 到 docs/ 子目录的 PowerShell 脚本
# 所有注释采用简体中文

$folders = @('architecture', 'development', 'reference', 'setup', 'specs', 'reports', 'superpowers', 'screenshots')

foreach ($folder in $folders) {
    $src = "docs/docs/$folder"
    $dest = "docs/$folder"
    if (Test-Path $src) {
        if (-not (Test-Path $dest)) {
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
        }
        Copy-Item -Path "$src/*" -Destination $dest -Recurse -Force
    }
}

if (Test-Path "docs/docs") {
    $files = Get-ChildItem -Path "docs/docs" -File
    if (-not (Test-Path "docs/reference")) {
        New-Item -ItemType Directory -Path "docs/reference" -Force | Out-Null
    }
    foreach ($file in $files) {
        Copy-Item -Path $file.FullName -Destination "docs/reference/" -Force
    }
    Remove-Item -Path "docs/docs" -Recurse -Force
}

Write-Host "Docs merged successfully."
