Status: reference

# 单图生图 Skill (single-generate-to-canvas)

- **触发词**: “帮我画一张猫咪的图片” / “生成一张科爱的壁纸”
- **前置条件**: 用户给出了明确的出图提示词。
- **调用工具**:
  - `prompt.optimizeInput`
  - `provider.getModelCapabilities`
  - `generation.createBatchJob`
  - `generation.getJobStatus`
- **执行步骤**:
  1. 若用户说“生成一个...”且没有批量、文件夹、每张参考图等复杂约束，提取提示词主体；缺少决定性目标时先澄清。
  2. 可调用 `prompt.optimizeInput` 生成建议文本，但不得靠写入或模拟提交 PromptBar 发起生成。
  3. 从当前运行上下文读取模型、比例与参考图；需要时用 `provider.getModelCapabilities` 校验能力。
  4. 构造仅含一个 prompt item、`countPerPrompt=1` 的 `generation.createBatchJob` 计划。
  5. 展示模型、数量、费用与影响范围，获得与当前 owner、画布、选区、模型和输入完全绑定的确认授权后写入 `DurableGenerationQueue`。
  6. 通过持久 Job 状态验证完成结果，将生成的 ImageNode 挂载到对应 Prompt 节点并导入当前 `CanvasRuntimeState`。

## 🛠️ 安全防护与规约
- **确认保护**: AI 发起的单张和批量生成都使用 `generation.createBatchJob`，属于 `confirm` 风险级；实际执行前必须展示估算成本和影响范围并获得用户明确授权。`generation.submitComposer` 只保留给用户直接操作的兼容入口，不是 AI 自治生成路径。
- **幂等与验证**: Job 使用 Run/Step 幂等键，工具成功后仍须从 `DurableGenerationQueue` 验证对应持久任务，避免刷新或重试重复生成。
- **并发控制**: 单图任务自动受排队机制调度，最大并发为 3。
