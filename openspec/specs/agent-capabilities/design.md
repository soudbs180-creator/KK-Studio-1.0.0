Status: historical

# Capability Design: agent-capabilities

AI 助手控制能力的技术实现与接口规范。

## 架构组成
AI 助手的多维控制能力基于以下模块的深度打通：
1. **CanvasRuntimeState Builder**：实时抽取画布节点、选区、视口几何坐标，并在 SanitizedProjectContext 中作为 `runtime` 字段传递给云端规划器（LLMBrain）。
2. **Intent Gate (意图门控)**：对用户的控制与排版意图（`arrange_nodes`）、打包意图（`download_outputs`）进行快速正则分析，提取模式参数，提供给本地脑或直接处理。
3. **ToolRegistry (工具注册表)**：通过注册统一的工具句柄（如 `canvas.arrangeNodes`、`assets.zipOriginals`、`generation.createBatchJob`），桥接 ActionExecutor 的 legacy 别名并执行实际的前后端交互。

## 关键接口定义

### 整理画布接口 payload 规范
```typescript
interface ArrangeNodesPayload {
  nodeIds: string[];
  mode?: 'grid' | 'row' | 'column';
  preset?: 'grid' | 'row' | 'column' | 'compact-grid';
  columns?: number;
  gap?: number;
}
```

### 打包下载原图接口 payload 规范
```typescript
interface ZipOriginalsPayload {
  scope: 'selected_cards' | 'latest_batch' | 'all_canvas_outputs';
  selectedNodeIds?: string[];
}
```
