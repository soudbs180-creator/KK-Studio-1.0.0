# 框选原图打包下载 Skill (download-selected-originals)

- **触发词**: “下载选择的卡片” / “打包我框选的图片”
- **前置条件**: 画布处于框选状态且有选中的卡片。
- **调用工具**:
  - `assets.zipOriginals`
  - `assets.resolveOriginals`
- **执行步骤**:
  1. 通过 `CanvasRuntimeState` 获取选中的 `selectedNodeIds`。
  2. 如果 `selectedNodeIds` 为空，明确报错“当前没有选中的卡片，请在画布上进行选择”。
  3. 识别节点类型，如果包含 PromptNode，则将其子图像节点 `childImageIds` 全部收集。
  4. 调用原图解析引擎，按照 `originalUrl -> apiResultUrl -> url -> storageId (IndexedDB)` 优先级依次尝试拉取。
  5. 打包成功的文件存入 ZIP，失败的文件归档在 `failedItems` 并写入 `manifest.json`。
  6. 触发浏览器保存下载。

## 🛠️ 实现规约与规则
- **作用范围**: `selected_cards` 必须仅使用当前的 `selectedNodeIds`，严禁扩大至所有画布或全部图片。
- **子图解析**: 选中的提示词卡片会自动展开并收集子图片（通过 `childImageIds` 和 `parentPromptId`），然后根据图像节点 ID 进行去重。
- **原图解析优先级**: `originalUrl -> apiResultUrl -> url -> storageId -> localFile`。
- **ZIP 打包规范**: 无论成功与否，必须在 ZIP 包中包含 `manifest.json`。如果全部下载失败，应返回只包含清单的 ZIP 包并在 `failedItems` 记录原因。

## 🧪 测试覆盖
- 单元测试: `tests/unit/zip-selected-originals.test.ts`
