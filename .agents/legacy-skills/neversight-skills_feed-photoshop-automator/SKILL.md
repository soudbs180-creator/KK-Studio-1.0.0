---
name: photoshop-local-automation
description: "本地 Adobe Photoshop 自动化后端，适用于基于 COM 和 ExtendScript 的桌面自动化。仅在 `adobe-workbench` 选中 Photoshop 路线后，或用户明确要求 Photoshop 脚本与动作自动化时使用。"
metadata:
  {
    "openclaw":
      {
        "requires": { 
          "bins": ["cscript", "osascript"], 
          "os": ["windows", "macos"],
          "env": [], 
          "config": [] 
        }
      }
  }
---

# Photoshop 自动化技能（v1.2.4）

这是一个后端技能。除非你已经确定要走本地 Photoshop 自动化路线，否则请先从 `adobe-workbench` 开始。

这个技能为 Adobe Photoshop（vCS6 - 2026+）提供高性能自动化桥接，可在 Windows 和 macOS 上通过 VBScript 或 AppleScript 驱动 ExtendScript（JSX）引擎。

## 命令

- **runScript**：执行原始 ExtendScript（ES3）代码，适用于复杂文档操作。
- **updateText**：按图层名称定位文本图层并立即更新内容。
- **createLayer**：创建新的图层，并设置透明度和混合模式。
- **applyFilter**：对当前活动图层应用高斯模糊等滤镜。
- **playAction**：按动作名称和动作组播放已录制的 Photoshop 动作（`.atn`）。
- **export**：把当前文档导出为高质量 PNG 或 JPEG。

## 🛠 AI Protocol

### 1. Technical Constraints (Strict)
- **ES3 Syntax Only**: Photoshop's ExtendScript engine uses **ECMAScript 3 (ES3)**. 
    - ❌ **DO NOT USE**: `const`, `let`, arrow functions `() => {}`, template literals `` `${}` ``, or `Map`/`Set`.
    - ✅ **USE**: Only `var`, standard `function` declarations, and string concatenation (`'a' + b`).
- **Assume Active Document**: Commands operate on the *active* document. If none is open, scripts will fail unless they call `app.documents.add()`.

### 2. Security & Side Effects
- **Filesystem Access**: The `runScript` command allows execution of arbitrary ExtendScript. This engine has **direct access to the host filesystem**.
- **Side Effects**: Scripts can create, modify, or delete files on the local machine via the `File` and `Folder` objects.
- **Verification**: Always review dynamically generated scripts before execution to prevent unintended document or filesystem modifications.

### 3. Error Handling
- **GUI Blocks**: If Photoshop has a modal dialog open (e.g., Save As window, error popup), COM operations will hang or fail. Direct the user to close any open dialogs.
- **Layer Presence**: If `updateText` fails, ensure the layer name provided matches exactly (case-sensitive) with the layer in the PSD.

## Setup

Ensure Adobe Photoshop is installed on the host system. The skill automatically uses the registered COM server.

---
Developed for the OpenClaw community by [Abdul Karim Mia](https://github.com/abdul-karim-mia).
