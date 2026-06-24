# Canvas Performance Refactor Plan

> 目标：把 KK Studio 画布从“效果优先、局部优化”收口到“交互优先、分层渲染、可度量、可回滚”的轻量化架构，确保多卡片场景下点击、拖拽、平移、缩放、选择菜单和分组操作保持跟手。

## 1. 背景与当前状态

当前 hotfix PR 已经完成第一轮低风险优化，主要集中在减少持续动画、CSS 合成成本、拖拽高频事件和常见数组扫描。它能明显降低多卡片场景下的主线程和合成线程压力，但这仍属于“热区止血”。

要做到完整落地，后续需要把画布主链路重构成以下模型：

```txt
输入事件 -> 轻量交互层 -> live scene/DOM transform -> 帧级调度 -> 状态提交 -> 后台一致性修复
                              |
                              +-> viewport index / visible items / detail level
                              +-> connector scheduler
                              +-> measurement scheduler
```

核心原则：

1. 拖拽、缩放、平移期间不做重 React render。
2. 高频路径只写 transform，不写 layout 属性。
3. 画布只渲染视口附近内容，不渲染全量卡片。
4. 非关键视觉效果在交互期间降级或关闭。
5. 所有昂贵计算必须可缓存、可分片、可跳过。
6. 性能目标必须自动化检测，不能只靠主观感受。

## 2. 性能目标

### 2.1 交互体验目标

| 场景 | 目标 |
| --- | --- |
| 单卡拖拽 | 指针到 DOM 视觉更新延迟 < 16ms |
| 20 张卡片内拖拽 | 持续接近 60fps，低端设备允许 30fps 但不能断触 |
| 100 张卡片画布平移 | 不触发全量卡片 React rerender |
| 100 张卡片缩放 | 卡片可降级显示，但画布必须跟手 |
| 多选菜单打开 | 计算时间 < 20ms |
| 分组/取消分组 | 不阻塞拖拽或缩放主路径 |
| 收藏切换 | 不出现 selected × favorites 级别扫描 |

### 2.2 技术预算

| 指标 | 预算 |
| --- | --- |
| pointermove handler | 单次 < 2ms |
| wheel handler | 单次 < 3ms |
| requestAnimationFrame callback | 单帧 JS < 6ms |
| forced layout | 拖拽/缩放期间 0 次 |
| full React commit | 拖拽/缩放期间尽量 0 次 |
| visible render items 计算 | < 8ms |
| selection menu 派生计算 | < 10ms |
| connector update | 每帧批量，不能每节点同步刷 DOM |

## 3. 最终目标架构

### 3.1 分层渲染

画布应拆成 5 层：

```txt
CanvasRoot
├── BackgroundLayer        # 可暂停、可降级、不可影响交互
├── GridLayer              # 静态或低频更新，不跟随 cursor 做高成本效果
├── ConnectorLayer         # SVG/Canvas 连接线，统一帧调度
├── CardLayer              # 虚拟化卡片，只渲染可见/近可见节点
└── InteractionLayer       # 拖拽框、选择框、hover、菜单、指针反馈
```

要求：

- `BackgroundLayer` 不读取卡片状态。
- `GridLayer` 只依赖 transform，不依赖 pointermove。
- `ConnectorLayer` 不在每张卡内部各自更新，应集中调度。
- `CardLayer` 只接收已裁剪后的 render items。
- `InteractionLayer` 可以使用独立 store，避免牵动主画布树。

### 3.2 数据分层

需要将 canvas 状态拆成三类：

| 类型 | 说明 | 更新频率 | 存储建议 |
| --- | --- | --- | --- |
| Persisted state | 真实业务数据，如节点位置、内容、图片、分组 | 低频 | React/Zustand/context |
| Live interaction state | 拖拽中的临时坐标、hover、transforming 状态 | 高频 | external store + refs |
| Derived render state | visible items、bounds、layout、detail level | 中频 | memoized selector + scheduler |

原则：拖拽过程中更新 live state；鼠标释放时才 commit persisted state。

## 4. 必须重构的关键模块

## 4.1 `WorkspacePage.tsx` 主渲染路径

这是后续最大的瓶颈。当前许多派生计算集中在页面组件内，容易因为 `canvasTransform`、selection、height map、live version 变化而引发大范围重算。

### 目标

把 WorkspacePage 拆成容器 + selector hooks + presentation components：

```txt
WorkspacePage
├── useWorkspaceCanvasData
├── useCanvasSpatialIndex
├── useVisibleCanvasItems
├── useCanvasRenderItems
├── useCanvasInteractionState
└── WorkspaceCanvasView
```

### 改造步骤

1. 提取 `useCanvasSpatialIndex(activeCanvas)`。
2. 提取 `useVisibleCanvasItems(index, viewport, overscan)`。
3. 提取 `useCanvasRenderItems(visibleItems, livePositions, detailLevel)`。
4. 把 selection、hover、transforming 状态从 render items 主计算中拆出。
5. 对 Prompt/Image/Workflow 三类节点分别建立轻量 render item。
6. 卡片组件只接收必要 props，不传入会频繁变化的大对象。

### 目标代码形态

```ts
const spatialIndex = useCanvasSpatialIndex(activeCanvas);
const visibleItems = useVisibleCanvasItems({
  spatialIndex,
  viewportBounds,
  overscan,
});
const renderItems = useCanvasRenderItems({
  visibleItems,
  livePositionStore,
  cardHeightStore,
  detailLevel,
});
```

### 验收标准

- 平移/缩放时不重新 sort 全量 prompt/image/workflow。
- 只对可见节点生成 render item。
- 100 张卡片时，画布平移不触发所有卡片 React rerender。

## 4.2 空间索引与视口裁剪

### 问题

仅靠数组 filter/sort 对大画布不可扩展。每次 transform 或 live position 变化都可能重新扫描全量节点。

### 方案

第一阶段使用 grid bucket index，不需要直接上 quadtree：

```ts
interface CanvasSpatialIndex {
  bucketSize: number;
  buckets: Map<string, CanvasNodeRef[]>;
  nodeBoundsById: Map<string, CanvasNodeBounds>;
}
```

bucket key：

```ts
const key = `${Math.floor(x / bucketSize)}:${Math.floor(y / bucketSize)}`;
```

查询：

```ts
function queryViewport(index, viewportBounds, overscan) {
  // 只遍历 viewport 覆盖到的 bucket
}
```

### 细节

- bucketSize 建议 800～1200 canvas units。
- 节点 bounds 更新只在节点位置/尺寸真实提交时发生。
- 拖拽中的 live position 不更新空间索引，只在视觉层应用 transform。
- 如果节点被拖出当前可见区域，保留 dragging node 强制可见。

### 验收标准

- 1000 节点查询可见项 < 5ms。
- viewport 变化只查询 bucket，不遍历全量节点。

## 4.3 拖拽架构：live preview 与 commit 分离

### 当前问题

部分拖拽路径仍会在移动过程中调用业务状态更新，导致 React/context 下游重新计算。

### 目标

所有拖拽路径统一为：

```txt
pointerdown -> capture start snapshot
pointermove -> rAF write live transform only
pointerup   -> one commit to persisted state
```

### 接口建议

```ts
interface DragController {
  begin(nodeIds: string[], pointer: Point): void;
  update(pointer: Point): void; // rAF throttled
  commit(pointer: Point): void;
  cancel(): void;
}
```

### 分组拖拽建议

`CanvasGroupComponent` 应拆分：

```ts
onGroupDragFrame(delta, nodeIds)   // 只更新 live position / DOM transform
onGroupDragCommit(delta, nodeIds)  // 只在 mouseup 后更新真实 canvas state
```

不要在 `onGroupDragFrame` 内调用 `moveSelectedNodesImmediate`。

### 验收标准

- pointermove 不 dispatch 持久化 canvas state。
- mouseup 只 commit 一次。
- 拖拽 100 节点时，React commit 次数显著下降。

## 4.4 卡片轻量化与 detail level

### 问题

卡片内容复杂，包含图片预览、按钮、标签、模型信息、收藏状态、计时器、动画、ResizeObserver 等。多卡片下全量渲染成本高。

### 方案

引入 3 档 detail level：

| Level | 使用场景 | 内容 |
| --- | --- | --- |
| full | idle + 近距离 + 选中/hover | 完整卡片 |
| compact | idle + 中距离 | 标题、缩略图、关键状态 |
| ghost | dragging/zooming/panning 或远距离 | 纯 shell + 缩略占位 |

### 规则

```ts
function resolveCardDetailLevel({
  scale,
  isCanvasTransforming,
  distanceToViewportCenter,
  isSelected,
  isHovered,
}) {
  if (isCanvasTransforming) return 'ghost';
  if (isSelected || isHovered) return 'full';
  if (scale < 0.45) return 'ghost';
  if (scale < 0.75) return 'compact';
  return 'full';
}
```

### 优化点

- ghost 模式不挂 ResizeObserver。
- ghost 模式不渲染复杂按钮组。
- compact 模式不渲染长文本/复杂 footer。
- full 模式只给可见且交互中的卡片。

### 验收标准

- 缩放/拖拽期间卡片不触发高度测量。
- 大画布远距离缩放不会渲染完整卡片 DOM。

## 4.5 Measurement Scheduler

### 问题

多个卡片各自 ResizeObserver + offsetHeight 可能引发 layout thrashing。

### 方案

统一测量调度器：

```ts
class CanvasMeasurementScheduler {
  request(nodeId: string, element: HTMLElement): void;
  flush(): void; // requestAnimationFrame or requestIdleCallback
}
```

规则：

- 拖拽/缩放期间不测量。
- 一帧内批量读取 DOM。
- DOM read 和 DOM write 分离。
- 高度变化 <= 1px 忽略。
- 对不可见节点不测量。

### 验收标准

- Performance profile 中无连续 forced reflow。
- ResizeObserver callback 不直接 set React state。

## 4.6 Connector Scheduler

### 问题

连接线如果由卡片组件各自触发更新，容易造成大量 DOM 查询和 SVG path 写入。

### 方案

集中调度：

```ts
connectorScheduler.request(promptId, imageId);
connectorScheduler.flushFrame();
```

内部维护：

- pending connector set
- path cache
- node position cache
- card height cache
- missing DOM cleanup

规则：

- 默认 rAF 批处理。
- 只在 path 字符串变化时写 `d` 属性。
- 拖拽时最多每帧写一次。
- 连接线多到一定数量时切到 Canvas renderer。

### 验收标准

- 拖拽时 connector update 不随 mousemove 次数线性增长。
- SVG path `setAttribute` 次数不超过每帧连接线数量。

## 4.7 Selection 与 Favorite 派生数据

### 问题

多选、收藏、菜单、分组常见 `array.includes`、`find`、`some` 重复扫描。

### 方案

统一派生索引：

```ts
const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
const promptById = useMemo(() => new Map(promptNodes.map(n => [n.id, n])), [promptNodes]);
const imageById = useMemo(() => new Map(imageNodes.map(n => [n.id, n])), [imageNodes]);
const favoriteIndex = useMemo(() => buildFavoriteIndex(favoriteItems), [favoriteItems]);
```

规则：

- 任何多选路径不允许 `selectedNodeIds.includes` 出现在循环里。
- 任何 favorite 判断不允许 `selected × favorites` 的嵌套扫描。
- 菜单派生结果应 memoized。

### 验收标准

- lint rule 或 code review checklist 禁止热路径 includes/find/some 嵌套。

## 4.8 背景、视觉效果与 CSS 合成策略

### 原则

交互期间优先帧率，不优先视觉效果。

### 策略

| 状态 | 背景 | 卡片特效 | 网格 | 连接线 |
| --- | --- | --- | --- | --- |
| idle | 正常低成本 | 可完整 | 静态 | 正常 |
| panning | paused/throttled | 关闭 filter/backdrop | 静态 | 批处理 |
| zooming | paused/throttled | ghost/compact | 静态 | 批处理或隐藏 |
| dragging | paused/throttled | 只 transform | 静态 | rAF 批处理 |

### 禁止项

- pointermove 中更新 CSS blur/mask/blend。
- 拖拽中改变 width/height/top/left。
- 拖拽中触发复杂 box-shadow/filter/backdrop-filter。

## 5. 实施路线图

## Phase 0：性能基线与守护

目标：先建立可度量基线，防止越改越玄学。

任务：

- 增加 dev-only performance marks。
- 记录 pointermove、wheel、rAF flush、visible query、render item build 时间。
- 增加 dense canvas seed fixture：20、100、500 节点。
- 增加 Playwright 性能脚本或手动 profile checklist。

产出：

- `docs/canvas-performance-profile.md`
- `scripts/perf/canvas-dense-workspace.ts`

## Phase 1：WorkspacePage 拆分

目标：降低主页面复杂度。

任务：

- 提取 canvas data selectors。
- 提取 visible/render item hooks。
- 提取 interaction state hooks。
- 卡片 props 最小化。

验收：

- `WorkspacePage.tsx` 明显变薄。
- render items 构建不依赖无关 UI 状态。

## Phase 2：空间索引与虚拟化

目标：从全量渲染切到视口渲染。

任务：

- 实现 grid bucket index。
- query viewport + overscan。
- dragging/selected/hover 节点强制保留。
- 引入 detail level。

验收：

- 500 节点下 DOM 数接近可见节点数，而非全量节点数。

## Phase 3：拖拽系统重构

目标：拖拽期间不更新持久化状态。

任务：

- 实现 DragController。
- 统一 prompt/image/group/workflow drag。
- live position external store。
- mouseup 一次 commit。

验收：

- pointermove 不触发 canvas context state commit。
- 分组拖拽不卡顿。

## Phase 4：测量与连接线调度

目标：消除 layout thrash 和同步 SVG 写入。

任务：

- MeasurementScheduler。
- ConnectorScheduler。
- connector path cache。
- card height cache。

验收：

- 拖拽中无 forced reflow。
- connector updates frame-bounded。

## Phase 5：卡片组件轻量化

目标：降低每张卡 DOM 和 hook 成本。

任务：

- PromptCard full/compact/ghost。
- ImageCard full/compact/ghost。
- 收藏、计时器、复杂按钮延迟加载或只 full 渲染。
- ResizeObserver 只在 full + visible + idle 下启用。

验收：

- 缩放远景 DOM 显著减少。
- idle 恢复时逐步升级 detail level，不阻塞交互。

## Phase 6：自动化验收与回归保护

目标：长期保证不卡。

任务：

- Playwright dense drag benchmark。
- Lighthouse/React Profiler profile 存档。
- CI 中加入性能阈值检查。
- PR checklist 增加 canvas hot path 检查。

验收：

- 性能退化能在 PR 阶段被发现。

## 6. 代码规范与禁用清单

### 6.1 高频路径禁止

以下代码不能出现在 pointermove、wheel、drag frame、visible render build 等路径：

```ts
array.includes(id) // 当 array 可能超过少量元素时
array.find(...)
array.some(...)
array.sort(...)
element.offsetHeight
getBoundingClientRect()
setState(...)
localStorage.setItem(...)
pathEl.setAttribute(...) // 未经 scheduler
```

### 6.2 推荐替代

```ts
const idSet = new Set(ids);
const byId = new Map(items.map(item => [item.id, item]));
requestAnimationFrame(flush);
requestIdleCallback(nonCriticalWork);
externalStore.setLivePosition(id, pos);
```

## 7. 验收 Checklist

### 基础交互

- [ ] 单卡拖拽跟手。
- [ ] 20 张卡片拖拽跟手。
- [ ] 100 张卡片平移不明显掉帧。
- [ ] 100 张卡片缩放不卡死。
- [ ] 多选后右键菜单即时出现。
- [ ] 分组/取消分组无明显长任务。
- [ ] 收藏/取消收藏选区不卡顿。

### Performance 面板

- [ ] 拖拽期间没有明显 forced reflow。
- [ ] pointermove handler 平均 < 2ms。
- [ ] rAF JS 平均 < 6ms。
- [ ] long task 数量显著下降。
- [ ] React commit 不在每个 pointermove 出现。

### 移动端

- [ ] 触摸拖拽跟手。
- [ ] pinch/zoom 不触发完整卡片重渲染。
- [ ] 背景处于 throttled 或 paused。
- [ ] 卡片 detail level 能正确降级。

### 回归

- [ ] 图片生成后仍自动布局。
- [ ] 手动移动后的布局不会被错误修复。
- [ ] 连接线位置正确。
- [ ] 选区菜单位置正确。
- [ ] 分组边界正确。
- [ ] 收藏状态正确。

## 8. 推荐落地顺序

最推荐的顺序：

1. 先合并当前 hotfix PR，解决立即卡顿。
2. 新开 `refactor/canvas-render-pipeline` 分支。
3. 先做 performance baseline 和 dense fixture。
4. 拆 `WorkspacePage.tsx`。
5. 引入 spatial index + visible render items。
6. 重构拖拽系统。
7. 做 MeasurementScheduler 和 ConnectorScheduler。
8. 做 full/compact/ghost 卡片轻量化。
9. 增加性能 CI。

不要一口气把所有东西塞进一个 PR。建议拆成 5～7 个 PR，每个 PR 都能独立验证和回滚。

## 9. 风险与回滚策略

| 风险 | 处理 |
| --- | --- |
| 虚拟化导致节点突然消失 | dragging/selected/hover 强制保留 |
| detail level 导致功能按钮不可用 | 选中/hover 强制 full |
| 连接线延迟一帧 | 拖拽节点使用 live position，视觉一致优先 |
| 测量延迟导致边界不准 | idle 后补偿更新，拖拽中使用 stable bounds |
| 空间索引 stale | 只在 persisted position commit 后更新 index |
| 低端设备仍卡 | 增大 ghost/compact 覆盖范围，暂停背景和连接线 |

## 10. 结论

当前 hotfix PR 解决的是最明显的即时卡顿来源。完整落地需要继续做架构级收口：

- `WorkspacePage` 变薄。
- 空间索引负责可见性。
- 拖拽系统只做 live preview，mouseup 后 commit。
- 卡片按 detail level 渲染。
- 测量和连接线统一调度。
- 所有性能目标可度量、可回归检测。

完成这些后，画布性能不再依赖“少放卡片”或“用户设备好”，而是靠架构保证大画布、多卡片、多选、拖拽、缩放都保持轻量和可控。
