# KK Studio 编码规范

> 版本：v1.0 | 生效日期：2026-07-25 | 适用范围：全栈 TypeScript 代码

---

## 1. TypeScript 核心规范

### 1.1 类型定义

```typescript
// ✅ 正确：清晰的接口命名 + JSDoc 文档
/** 画布节点的空间坐标与尺寸描述 */
interface CanvasNodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ✅ 正确：联合类型用于有限的状态枚举
type NodeStatus = 'idle' | 'loading' | 'error' | 'transforming';

// ✅ 正确：泛型使用描述性前缀
interface ApiResponse<TData> {
  data: TData;
  error: string | null;
}

// ❌ 错误：模糊的命名
interface Data {
  d: any;
}

// ❌ 错误：裸 any（除非有明确注释）
function process(data: any) { }

// ⚠️ 例外：必要时可使用 any，但必须加注释
function legacyAdapter(data: any /* 简体中文：兼容旧版非结构化数据，待 v2.0 移除 */) { }
```

### 1.2 空值处理

```typescript
// ✅ 正确：使用 ?? 处理 null/undefined
const height = nodeHeight ?? DEFAULT_HEIGHT;
const name = userName ?? '未命名';

// ✅ 正确：可选链 + 空值合并
const color = node?.style?.color ?? '#000000';

// ❌ 错误：|| 会把 0/''/false 误判为空
const count = items.length || 10; // 如果 length 为 0 会被替换成 10！
```

### 1.3 类型守卫

```typescript
// ✅ 正确：自定义类型守卫
function isCanvasNode(obj: unknown): obj is CanvasNode {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'bounds' in obj
  );
}

// 使用
if (isCanvasNode(data)) {
  // 此处 data 类型自动收窄为 CanvasNode
  console.log(data.bounds.x);
}
```

### 1.4 枚举

```typescript
// ✅ 优先：const enum（零运行时开销）
export const enum GenerationStatus {
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

// ✅ 备选：字符串字面量联合（用于跨包共享）
export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';
```

---

## 2. React 组件规范

### 2.1 函数组件结构

```tsx
// ✅ 标准组件模板
import { memo, useState, useCallback, useEffect, type FC } from 'react';

// 简体中文：Props 接口定义在组件文件顶部
interface PromptNodeProps {
  nodeId: string;
  isTransforming: boolean;
  onHeightChange: (id: string, height: number) => void;
}

// 简体中文：组件使用 React.memo 避免不必要重渲染
export const PromptNode: FC<PromptNodeProps> = memo(({
  nodeId,
  isTransforming,
  onHeightChange,
}) => {
  // 简体中文：状态声明区
  const [isExpanded, setIsExpanded] = useState(false);

  // 简体中文：事件处理器以 handle 前缀命名
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // 简体中文：副作用必须声明依赖意图
  useEffect(() => {
    if (isTransforming) return; // 简体中文：变换期间跳过测量
    // 测量逻辑...
  }, [isTransforming /* 简体中文：变换状态变化时触发补偿测量 */]);

  return (
    <div className="prompt-node">
      {/* 简体中文：渲染逻辑 */}
    </div>
  );
});

PromptNode.displayName = 'PromptNode';
```

### 2.2 组件拆分原则

| 行数 | 建议 |
|------|------|
| ≤ 80 行 | 良好，保持 |
| 80–150 行 | 检查是否有可抽取的 Hook |
| 150–200 行 | 必须抽取，至少拆出一个 Hook |
| > 200 行 | 禁止，必须重构拆分 |

### 2.3 Hook 命名

```typescript
// ✅ 正确：use 前缀 + 描述性名称
useCanvasViewport()      // 画布视口管理
usePromptGroupLayout()   // Prompt 组布局计算
useImageCardMetrics()    // 图片卡片测量

// ✅ 回调 Hook 以 handle 前缀区分
const handleNodeDrag = useCallback(...)
const handleCanvasZoom = useCallback(...)
```

---

## 3. 注释规范

### 3.1 公开 API 注释

```typescript
// 简体中文：统一测量调度器，将高频测高读取进行批处理，防止强制同步排版 (Layout Thrashing)
export class CanvasMeasurementScheduler {
  // 简体中文：在拖拽/缩放期间锁定调度器，忽略所有后续的测量并在锁定瞬间取消待处理测量
  static setLocked(locked: boolean): void { }

  // 简体中文：请求批量测量某个 DOM 元素
  static request<T>(
    id: string,
    element: HTMLElement,
    measureFn: (el: HTMLElement) => T,
    callback: (val: T) => void
  ): void { }
}
```

### 3.2 TODO 规范

```typescript
// ✅ 正确：责任人 + 日期 + 描述
// TODO(yckhw, 2026-08-15): 迁移至 generation-v3 Worker 模式后移除此适配器

// ❌ 错误：无责任人和日期的 TODO
// TODO: fix this later
```

### 3.3 性能关键路径注释

```typescript
// 简体中文：此处为热路径，O(n) 遍历 10K 节点，已通过 SpatialIndex 优化至 O(log n)
for (const node of spatialIndex.queryInViewport(viewport)) {
  // ...
}
```

---

## 4. 文件与目录规范

### 4.1 文件命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| React 组件 | PascalCase | `PromptNodeComponent.tsx` |
| 自定义 Hook | camelCase + use 前缀 | `usePromptGroupLayout.ts` |
| 工具/纯逻辑模块 | camelCase | `canvasCoordinates.ts` |
| 类型定义文件 | camelCase | `generationTypes.ts` |
| 测试文件 | 同源文件 + .test.ts | `CanvasMeasurementScheduler.test.ts` |
| 配置文件 | kebab-case | `release-manifest.json` |

### 4.2 导入顺序

```typescript
// 1. Node 内置模块
import { readFile } from 'node:fs/promises';

// 2. 第三方库
import React, { memo, useState } from 'react';
import { z } from 'zod';

// 3. 项目内包
import type { GenerationJobDto } from '@kk-studio/shared';
import { apiClient } from '@kk-studio/api-client';

// 4. 相对路径导入（按层级从远到近）
import { CanvasMeasurementScheduler } from '../../canvas/CanvasMeasurementScheduler';
import { useCanvasState } from '../../context/CanvasContext';
import { ImageCard } from '../image/ImageCard';
import { NODE_DEFAULTS } from './constants';
```

---

## 5. 错误处理规范

### 5.1 服务端

```typescript
// ✅ 正确：结构化错误响应
try {
  const job = await createJob(params);
  res.json({ data: job });
} catch (error) {
  if (error instanceof QuoteExpiredError) {
    res.status(400).json({
      error: 'QUOTE_EXPIRED',
      message: '报价已过期，请重新获取报价',
      quoteId: error.quoteId,
    });
    return;
  }
  // 未知错误脱敏返回
  console.error('[createJob]', error);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误',
  });
}
```

### 5.2 前端

```typescript
// ✅ 正确：错误边界 + 用户友好提示
try {
  await apiClient.createJob(params);
} catch (error) {
  if (error.code === 'QUOTE_EXPIRED') {
    showToast('报价已过期，正在重新获取...');
    await refreshQuote();
    return;
  }
  showToast('操作失败，请稍后重试');
  console.error('[createJob]', error);
}
```

---

## 6. 性能规范

### 6.1 DOM 操作

```typescript
// ✅ 正确：读写分离，避免 Layout Thrashing
// DOM Read Phase
const measurements = elements.map(el => el.getBoundingClientRect());

// DOM Write Phase（在 rAF 回调中）
requestAnimationFrame(() => {
  measurements.forEach((rect, i) => {
    elements[i].style.transform = `translate(${rect.x}px, ${rect.y}px)`;
  });
});
```

### 6.2 数据查找

```typescript
// ✅ 正确：使用 Map 实现 O(1) 查找
const nodeMap = new Map(nodes.map(n => [n.id, n]));
const node = nodeMap.get(targetId);

// ❌ 错误：O(n) 查找（在大列表中性能灾难）
const node = nodes.find(n => n.id === targetId);
```

---

## 7. 测试规范

### 7.1 测试结构

```typescript
// 简体中文：测试 CanvasMeasurementScheduler 的批量调度行为
describe('CanvasMeasurementScheduler', () => {
  // 简体中文：每个测试用例独立，不依赖执行顺序
  beforeEach(() => {
    CanvasMeasurementScheduler.setLocked(false);
  });

  describe('request', () => {
    it('should batch multiple measurements into single rAF', () => {
      // Arrange
      const element = document.createElement('div');
      const callback = vi.fn();

      // Act
      CanvasMeasurementScheduler.request('test-1', element, el => el.offsetHeight, callback);

      // Assert — 在实际 rAF 触发前不应调用 callback
      expect(callback).not.toHaveBeenCalled();
    });

    it('should skip measurement when locked', () => {
      // Arrange
      CanvasMeasurementScheduler.setLocked(true);
      const callback = vi.fn();

      // Act
      CanvasMeasurementScheduler.request('test-1', element, el => el.offsetHeight, callback);

      // Assert
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
```

---

## 8. Git 提交规范

### 8.1 提交信息格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Type 类型：**

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `perf` | 性能优化 |
| `refactor` | 重构（非功能变更） |
| `test` | 测试相关 |
| `docs` | 文档更新 |
| `chore` | 构建/工具/依赖变更 |
| `governance` | 治理脚本/架构检查相关 |

**示例：**
```
perf(canvas): O(n²)→O(1) 画布节点查找 — Map 索引替代线性扫描

在 CanvasContext 启动恢复大循环中，将 resolvePromptChildImageIds
的嵌套线性查找替换为预构建的 imageNodeById Map，消除 O(n×m) 复杂度。

Related: session-handoff #9
```

---

## 附录 A: ESLint / Prettier 配置参考

> 当前项目未强制 ESLint/Prettier，如需引入可与现有 `architecture:check` 治理脚本集成。

推荐配置优先级：
1. `@typescript-eslint/strict-type-checked` — 类型安全规则
2. `react-hooks/exhaustive-deps` — Hook 依赖完整性
3. `import/order` — 导入顺序
