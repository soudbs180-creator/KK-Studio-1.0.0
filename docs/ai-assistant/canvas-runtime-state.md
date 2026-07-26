# 画布运行态协议 (Canvas Runtime State)

画布运行态是 AI 助手精准感知当前工作区的桥梁。生成辅助建议或发起 Agent 规划时，助手会将当前页面、视口、框选对象及近期事件的脱敏摘要组装为状态；执行期间 ToolRegistry 还会在每一步重新读取运行态，从而避免模型或工具依赖过期快照。

## Source evidence

- CanvasRuntimeState builder: `apps/web/src/features/ai-takeover/core/canvasRuntimeStateBuilder.ts`
- Runtime context assembly: `apps/web/src/features/ai-assistant-runtime/context/buildCanvasRuntimeState.ts`
- Runtime snapshot types: `packages/shared/src/contracts/dto/ai-assistant.ts`
- Canvas context integration: `apps/web/src/context/CanvasContext.tsx`

当前构建器写入 `projectVersion: '1.6.1'`；版本更新时必须与 `config/release-manifest.json` 同步。

## 1. 运行态状态定义

以下是 `CanvasRuntimeState` 的完整接口结构定义：

```typescript
import type {
  CanvasCardKind,
  CanvasLayoutMode,
  CanvasSceneBounds,
} from '@kk/shared';

type AssistantWorkspaceSurface =
  | 'canvas'
  | 'library'
  | 'favorites'
  | 'settings'
  | 'agent'
  | 'unknown';

export interface CanvasRuntimeState {
  projectVersion: string;
  currentPage: AssistantWorkspaceSurface;
  canvas: {
    id: string;
    name: string;
    promptCount: number;
    imageCount: number;
    groupCount: number;
    noteCount: number;
    workflowPanelCount: number;
    cardKinds: Partial<Record<CanvasCardKind, number>>;
    layoutModes: CanvasLayoutMode[];
    bounds?: CanvasSceneBounds;
    lastModified?: number;
  };
  viewport: {
    x: number;
    y: number;
    scale: number;
    center: { x: number; y: number };
    rect?: { width: number; height: number };
  };
  selection: {
    selectedNodeIds: string[];
    promptNodeIds: string[];
    imageNodeIds: string[];
    childImageNodeIdsFromSelectedPrompts: string[];
    groupIds: string[];
    noteNodeIds: string[];
    workflowNodeIds: string[];
    bounds?: CanvasSceneBounds;
    capabilities: {
      canArrange: boolean;
      canConvertDrawingsToNote: boolean;
      canCreateCard: boolean;
      canCreateWorkflowPanel: boolean;
    };
    count: number;
  };
  groups: Array<{
    id: string;
    label?: string;
    hidden: boolean;
    collapsed: boolean;
    color?: string;
    nodeCount: number;
    tags?: string[];
  }>;
  selectedNodes: {
    prompts: Array<{
      id: string;
      prompt: string;
      status: 'idle' | 'queued' | 'generating' | 'failed' | 'done';
      childImageIds: string[];
      tags?: string[];
    }>;
    images: Array<{
      id: string;
      parentPromptId?: string;
      urlPresent: boolean;
      originalUrlPresent: boolean;
      apiResultUrlPresent: boolean;
      storageIdPresent: boolean;
      tags?: string[];
    }>;
    notes: Array<{
      id: string;
      title: string;
      elementCount: number;
    }>;
    workflowPanels: Array<{
      id: string;
      title: string;
      status: string;
      enabledStepCount: number;
      outputCount: number;
    }>;
  };
  promptBarInput?: {
    prompt: string;
    mode: string;
    referenceImagesCount: number;
  };
  recentEvents: Array<{
    id: string;
    type: string;
    targetIds?: string[];
    timestamp: number;
    summary: string;
  }>;
}
```

## 2. 选区推导与定位核心规则

1. **选中图片节点**: 当 `selection.imageNodeIds` 不为空时，如果用户说“下载这些图”，代表仅下载这些选中的图片。
2. **选中 Prompt 节点**: 当选中 Prompt 节点时，自动在 `childImageNodeIdsFromSelectedPrompts` 中装载其子图 ID，供打包下载解析使用。
3. **坐标投影**: 在执行“定位卡片”或“在该处建卡”等工具时，画布中的坐标通过 `viewport.scale` 与中心做映射计算，保证聚焦精确无偏。
4. **分组摘要**: `groups` 记录每个 `CanvasGroup` 的名称、隐藏/收纳状态、内发光颜色、节点数和标签。AI 助手可用它理解“刚刚那组”“隐藏这个组”“把这个分组展开”等指令。
5. **隐藏与收纳**: `hidden=true` 只代表视觉模糊隐藏，卡片仍在画布渲染和连接线逻辑中；`collapsed=true` 才代表收纳成条并从普通卡片渲染队列中过滤成员节点。
6. **批量输出追踪**: 批量任务创建的分组应带 `automation` 与 `batch:<jobId>` 标签，`color` 默认 `#ffffff`，用于后续恢复、重排、隐藏或下载该批次。

## 3. 三态协作中的消费规则

| 协作模式 | 如何使用运行态 | 是否直接执行 |
| :--- | :--- | :--- |
| `direct` | 画布原生交互持续更新同一个 `CanvasContext`；普通聊天可读取必要上下文 | 不因模式本身触发 Agent 工具 |
| `assist` | 使用 `currentPage`、selection、selectedNodes、capabilities 和失败状态派生下一步建议 | 点击建议只预填输入；可执行计划先预览并确认 |
| `takeover` | 将脱敏运行态送入 IntentGate / Planner，并作为每步工具上下文 | 低风险按策略执行，高风险或广泛影响步骤确认 |

`library` 与 `favorites` 是页面 surface，不是独立画布副本。辅助建议可以基于这些页面提出“整理到画布”或“用收藏创建方案”，真正写入仍经由共享 `CanvasContext` 和 ToolRegistry。

## 4. 新鲜度与并发规则

1. **规划快照**：规划开始时构造一份脱敏 `CanvasRuntimeState`，用于理解目标和生成可审核计划。
2. **步骤前刷新**：ToolRegistry 在每个 handler 前调用 `getActiveCanvas`、`getSelectedNodeIds` 和 `getCanvasRuntimeState`，读取用户直接操作后的最新状态。
3. **验证前刷新**：handler 完成后、verification 开始前再次解析运行态，使验证基于实际画布结果而不是 handler 前的对象引用。
4. **明确目标优先**：工具输入中已经确认的目标 ID 仍是该步骤的作用范围；刷新上下文不是把步骤悄悄扩大到新选区。
5. **安全脱敏**：提示词、输入框、分组标签和近期事件进入建议或模型上下文前继续执行既有密钥、Bearer token、base64 与超长内容脱敏。
