# 画布运行态协议 (Canvas Runtime State)

画布运行态是 AI 助手精准感知画布的桥梁。每次会话发起时，助手会将当前视口位置、框选对象及近期事件脱敏摘要后组装为状态发送给模型，从而避免模型靠猜测做出规划。

## 1. 运行态状态定义

以下是 `CanvasRuntimeState` 的完整接口结构定义：

```typescript
export interface CanvasRuntimeState {
  projectVersion: '1.6.0';
  currentPage: 'canvas' | 'settings' | 'agent' | 'unknown';
  canvas: {
    id: string;
    name: string;
    promptCount: number;
    imageCount: number;
    groupCount: number;
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
