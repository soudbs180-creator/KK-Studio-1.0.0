Status: reference

---
name: download-selected-originals
description: 框选原图打包下载技能，用于从画布中将选中的图像卡片（或 Prompt 卡片的子图片）根据 originalUrl -> apiResultUrl -> url -> storageId 优先级打包下载为带清单 (manifest.json) 的 ZIP 压缩文件。
---

# 框选原图打包下载 Skill (download-selected-originals)

- **触发词**: “下载选择的卡片” / “打包我框选的图片” / “下载当前选区原图”
- **前置条件**: 画布处于框选状态且有选中的卡片。
- **调用工具**:
  - `assets.zipOriginals`
  - `assets.resolveOriginals`
- **执行步骤**:
  1. 通过 `CanvasRuntimeState` 获取选中的 `selectedNodeIds`，去重后冻结到确认预览和工具输入。
  2. 如果 `selectedNodeIds` 为空，明确报错“当前没有选中的卡片，请在画布上进行选择”。
  3. 识别节点类型，如果包含 PromptNode，则将其子图像节点 `childImageIds` 全部收集。
  4. 调用原图解析引擎，按照 `originalUrl -> apiResultUrl -> url -> storageId (IndexedDB)` 优先级依次尝试拉取。
  5. 打包成功的文件存入 ZIP，失败的文件归档在 `failedItems` 并写入 `manifest.json`。
  6. 用户确认冻结的画布、选区、数量和文件副作用后，触发浏览器保存下载。

## 🛠️ 实现规约与规则
- **作用范围**: `selected_cards` 必须仅使用确认预览时冻结到输入的 `selectedNodeIds`，严禁在执行时替换为新选区、所有画布或全部图片；节点已不存在时 fail closed。
- **确认权限**: `assets.zipOriginals` 是 `confirm` 工具，授权必须绑定 owner、Run、Plan、Step、画布、选区和输入。
- **子图解析**: 选中的提示词卡片会自动展开并收集子图片（通过 `childImageIds` 和 `parentPromptId`），然后根据图像节点 ID 进行去重。
- **原图解析优先级**: `originalUrl -> apiResultUrl -> url -> storageId -> localFile`。
- **ZIP 打包规范**: 无论成功与否，必须在 ZIP 包中包含 `manifest.json`。如果全部下载失败，应返回只包含清单的 ZIP 包并在 `failedItems` 记录原因。

## 🧪 测试覆盖
- 单元测试: `tests/unit/zip-selected-originals.test.ts`
