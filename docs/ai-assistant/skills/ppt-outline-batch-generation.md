Status: reference

# Skill: PPT 大纲与批量生成排版 (ppt-outline-batch-generation)

## 触发场景 (Trigger)
- 用户要求生成一份演示文稿，如“帮我生成一个关于人工智能发展史的 PPT”。
- 用户在 PPT 编辑Lightbox/弹窗中，切换到大纲模式（Outline Mode）准备进行大纲修改或一键生成。

## 前置条件 (Preconditions)
- 用户的账户余额有足够的积分。
- 画布中已具备创建卡片以及批量排版（`canvasAutoArrange`）的接口。

## 调用工具 (Tools)
- `generation.createBatchJob`：创建一个持久化的批量生成队列任务，将每个 PPT Slide 的提示词作为任务项提交。
- `canvas.createPromptCards`：在画布上为每个 Slide 预先创建 placeholder 卡片占位。
- `canvas.arrangeNodes`：PPT 自动整理布局（例如 layout = 'row' 或 'grid'，配合 PPT 专有尺寸比例排版）。
- `ui.switchPptEditorMode`：切换 PPT 预览模式和 Outline 模式。

## 执行步骤 (Steps)
1. **生成大纲架构**：
   - AI 根据用户的文本请求，首先生成 PPT 页面大纲（JSON 结构），包含主题、总页数、以及每一页的主题和建议提示词（Per-slide prompt）。
2. **大纲编辑展示**：
   - 系统将编辑界面切换至 Outline 模式：
     - 最上方展示“共享提示词区域”（Shared prompt field），影响所有页面。
     - 下方一行行地展示每个 Slide 的主题、本页专有提示词（Editable field）、以及一个“生成选择框”（Checkbox）。
3. **批量任务派发**：
   - 用户点击一键生成后，获取所有被勾选的 Slide 列表。
   - 拼装每个 Slide 的最终提示词（“共享提示词” + “本页专有提示词”）。
   - 调用 `generation.createBatchJob` 创建批量任务，分配任务 ID (`batchId`)。
4. **画布占位与出图**：
   - 立即在画布的指定区域（例如空白处）按 PPT 卡片比例创建占位 Prompt 卡片，并显示 `queued` / `generating` 状态。
   - 随队列的并发进行，生图接口返回原图地址，更新画布对应的 Image 节点。
5. **网格排列整理**：
   - 在任务进行或完成后，调用 `canvas.arrangeNodes` 对这些幻灯片卡片及子图节点进行排列。
   - 统一打上 `ppt-deck` 和 `batchId` 标签，方便后续组合打包导出。

## 安全与成本规约 (Safety & Cost)
- **费用二次确认**：若勾选生图的 Slide 页数超过一定限制（如 10 页以上），必须显示成本预估并进行 `confirm` 拦截，提示用户即将扣除的积分额。
- **并发控制**：默认并发限制为 3，最大为 8，避免因并发过多导致请求失败。

## 验证方式 (Validation)
- **大纲切换验证**：点击 Outline 按钮，界面应该显示大纲列表并展示独立输入框。
- **批量生图验证**：勾选其中 3 页，点击生成，画布上应创建 3 对占位卡片，生图成功后自动在画布排列整齐。
