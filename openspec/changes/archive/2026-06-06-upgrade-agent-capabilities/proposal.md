Status: historical

# Change Proposal: upgrade-agent-capabilities

## 动机与背景
KK Studio 拥有丰富的 AI 助手底层能力（ToolRegistry、DurableGenerationQueue、CanvasRuntimeState）。但在实际的对话链路中，云端 Planner（LLMBrain）和本地脑（LocalAssistantBrain）未能深度融合这些高级能力。我们需要通过提示词重构和本地解析升级，让 AI 能够感知画布运行态，并合理地调用这些高级画布控制和文件打包工具。

## 变更影响
1. **llmBrain.ts**：扩展其系统提示词中的白名单 Action 和对 context.runtime 的理解。
2. **localBrain.ts**：在本地意图分析后，支持输出整理画布动作 `canvas.arrangeNodes` 和 ZIP 原图打包动作 `assets.zipOriginals`。

## 方案细节
- 云端 Planner 可以输出带有完整参数的高级工具对象。
- 保留别名兼容层，不改变原有的 legacy Action 运行，确保渐进式无缝升级。

## 状态
- **Status**: Archived
