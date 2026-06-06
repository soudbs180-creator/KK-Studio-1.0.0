<!-- AI_ROUTING_KEY: encoding, utf8, powershell, CRLF, LF, mojibake -->
# Encoding and PowerShell Rules — KK Studio v1.5.4

Last updated: 2026-06-03

---

## 0. 目标

本项目必须统一文本编码，杜绝乱码、换行混乱、PowerShell 默认编码差异造成的不可复现问题。

所有 Agent 和人工开发者在创建或修改源码、脚本、配置、文档时都必须遵守本文件。

---

## 1. 总原则

默认编码与换行：

```text
UTF-8 without BOM
LF
```

禁止提交：

```text
GBK
GB2312
Big5
ANSI
UTF-16
UTF-8 with BOM
CRLF 文本文件
乱码文本
不可见异常字符
```

例外：

```text
.bat / .cmd 可使用 CRLF
必须兼容 Windows PowerShell 5.1 且含中文的 .ps1 可使用 UTF-8 BOM，但必须在文件头说明原因
```

---

## 2. 文件分类规则

| 文件类型 | 编码 | 换行 | 说明 |
|---|---|---|---|
| `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | UTF-8 without BOM | LF | 源码默认规则 |
| `.json` `.yaml` `.yml` `.toml` `.ini` `.env.example` | UTF-8 without BOM | LF | `.env` 不提交 |
| `.md` `.txt` `.csv` | UTF-8 without BOM | LF | CSV 给旧 Excel 用时另行导出副本 |
| `.sh` | UTF-8 without BOM | LF | 禁止 BOM，避免 shebang 异常 |
| `.ps1` `.psm1` `.psd1` | UTF-8 without BOM | LF | PowerShell 7+ 默认 |
| `.bat` `.cmd` | 系统兼容编码 | CRLF | Windows 批处理例外 |
| 二进制文件 | binary | binary | 不做文本转换 |

---

## 3. PowerShell 版本规则

默认推荐：

```text
PowerShell 7+
```

检查：

```powershell
$PSVersionTable.PSVersion
```

Windows PowerShell 5.1 默认编码行为不统一，不能依赖默认写文件行为。

---

## 4. PowerShell 写文件规则

### 4.1 PowerShell 7+

写入：

```powershell
Set-Content -Path $Path -Value $Content -Encoding utf8NoBOM
```

追加：

```powershell
Add-Content -Path $Path -Value $Content -Encoding utf8NoBOM
```

导出 CSV：

```powershell
Export-Csv -Path $Path -InputObject $Data -NoTypeInformation -Encoding utf8NoBOM
```

读取：

```powershell
Get-Content -Path $Path -Encoding utf8
```

### 4.2 Windows PowerShell 5.1 写 UTF-8 without BOM

```powershell
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
```

追加：

```powershell
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::AppendAllText($Path, $Content, $Utf8NoBom)
```

---

## 5. 禁止写法

禁止在持久化文本文件时使用：

```powershell
"内容" > file.txt
"内容" >> file.txt
Out-File file.txt
Set-Content file.txt "内容"
```

除非显式指定编码。

原因：不同 PowerShell 版本中重定向、`Out-File`、`Set-Content`、`Add-Content`、`Export-Csv` 默认编码不一致，最容易造成乱码。

---

## 6. 控制台乱码处理

PowerShell 启动脚本或项目入口脚本可加入：

```powershell
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding           = [System.Text.UTF8Encoding]::new($false)
```

Windows PowerShell 5.1：

```powershell
[Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding           = New-Object System.Text.UTF8Encoding($false)
```

注意：`$OutputEncoding` 影响 PowerShell 与外部程序通信，不等于文件保存编码。保存文件仍必须显式 `-Encoding`。

---

## 7. .editorconfig

仓库根目录应包含：

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{md,markdown}]
trim_trailing_whitespace = false

[*.{ps1,psm1,psd1}]
charset = utf-8
end_of_line = lf

[*.bat]
end_of_line = crlf

[*.cmd]
end_of_line = crlf
```

---

## 8. .gitattributes

仓库根目录应包含：

```gitattributes
* text=auto eol=lf

*.bat text eol=crlf
*.cmd text eol=crlf

*.sh text eol=lf
*.ps1 text eol=lf
*.psm1 text eol=lf
*.psd1 text eol=lf
*.py text eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.js text eol=lf
*.jsx text eol=lf
*.json text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.md text eol=lf
*.txt text eol=lf
*.csv text eol=lf

*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.pdf binary
*.zip binary
*.7z binary
*.exe binary
*.dll binary
```

首次加入或调整后执行：

```bash
git add --renormalize .
git status
```

确认 diff 正常后再提交。

---

## 9. VS Code 建议

`.vscode/settings.json`：

```json
{
  "files.encoding": "utf8",
  "files.eol": "\n",
  "files.autoGuessEncoding": false,
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "editor.renderWhitespace": "boundary"
}
```

打开文件后，右下角应显示：

```text
UTF-8
LF
```

如显示 GBK、UTF-16 LE、CRLF，先转换后提交。

---

## 10. 检查脚本建议

`scripts/check-encoding.ps1`：

```powershell
param(
    [string]$Root = "."
)

$ErrorActionPreference = "Stop"

$TextExtensions = @(
    ".cs", ".java", ".py", ".js", ".jsx", ".ts", ".tsx",
    ".go", ".cpp", ".c", ".h", ".hpp",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".env",
    ".md", ".txt", ".csv",
    ".ps1", ".psm1", ".psd1", ".sh",
    ".xml", ".html", ".css", ".scss"
)

$BadFiles = @()

Get-ChildItem -Path $Root -Recurse -File |
    Where-Object {
        $_.FullName -notmatch "\\.git\\" -and
        $TextExtensions -contains $_.Extension.ToLowerInvariant()
    } |
    ForEach-Object {
        $Bytes = [System.IO.File]::ReadAllBytes($_.FullName)

        if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) {
            $BadFiles += "$($_.FullName) : UTF-16 LE BOM"
            return
        }

        if ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF) {
            $BadFiles += "$($_.FullName) : UTF-16 BE BOM"
            return
        }

        if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) {
            $BadFiles += "$($_.FullName) : UTF-8 BOM"
            return
        }

        try {
            $Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
            [void]$Utf8Strict.GetString($Bytes)
        }
        catch {
            $BadFiles += "$($_.FullName) : Not valid UTF-8"
            return
        }

        if ($Bytes -contains 0x0D) {
            $BadFiles += "$($_.FullName) : CRLF/CR detected, expected LF"
            return
        }
    }

if ($BadFiles.Count -gt 0) {
    Write-Host "Encoding check failed:" -ForegroundColor Red
    $BadFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Encoding check passed: UTF-8 without BOM + LF" -ForegroundColor Green
```

运行：

```powershell
pwsh ./scripts/check-encoding.ps1
```

---

## 11. GBK 转 UTF-8 without BOM

PowerShell 7+：

```powershell
$Source = "old-gbk.txt"
$Target = "new-utf8.txt"

$Bytes = [System.IO.File]::ReadAllBytes($Source)
$Text = [System.Text.Encoding]::GetEncoding("GBK").GetString($Bytes)

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($Target, $Text, $Utf8NoBom)
```

Windows PowerShell 5.1：

```powershell
$Source = "old-gbk.txt"
$Target = "new-utf8.txt"

$Bytes = [System.IO.File]::ReadAllBytes($Source)
$Text = [System.Text.Encoding]::GetEncoding("GBK").GetString($Bytes)

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Target, $Text, $Utf8NoBom)
```

---

## 12. Agent 编码提交要求

Agent 修改或生成文件后必须确认：

```text
UTF-8 without BOM
LF
无乱码
无异常不可见字符
无真实密钥
无机器私有路径
```

验证命令：

```bash
npm run check:encoding
```

如果没有项目脚本，运行本文件建议的 PowerShell 检查脚本。
