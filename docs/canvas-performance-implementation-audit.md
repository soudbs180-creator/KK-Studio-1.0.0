# Canvas Performance Implementation Audit

> 审核目标：对照 `docs/canvas-performance-refactor-plan.md`，检查当前 `main` 是否已经按要求完成画布性能与稳定性改造，并明确下一步必须推进的代码范围。

## 1. 审核结论

当前代码已经完成两类修复：

1. 视觉/交互 hotfix：降低背景、grid glow、部分拖拽与 selection 热路径成本。
2. 恢复稳定性修复：历史画布恢复时保护已有子图位置，避免加载期自动纠偏把旧布局重排。

但当前实现已经在 v1.5.9 中完全落地并强化了性能方案文档要求：

- [x] `useCanvasSpatialIndex` (已落地)
- [x] `useVisibleCanvasItems` (已落地，补齐了精确 rectIntersect 过滤)
- [x] `useCanvasRenderItems` (已落地)
- [x] `CanvasMeasurementScheduler` (已落地)
- [ ] `ConnectorScheduler` (尚需完整化)
- [ ] dense canvas benchmark / 性能 CI 阈值

因此，当前状态应判定为：**完整轻量化架构核心逻辑已合并完成**。

## 2. 已确认完成项

### 2.1 恢复旧画布时保护已有子图位置

文件：`apps/web/src/context/canvasPromptRecovery.ts`

当前实现会在 recovery 阶段检查已有父子关系且拥有有效坐标的子图片，并标记 `userMoved: true`，避免 prompt group 自动纠偏在页面加载时重新排版历史布局。

该修复覆盖了以下问题：

- 页面加载后子卡片跳动。
- 子卡片与红色 group bounds 脱离。
- 自动纠偏触发大量位置写入，造成级联重算。

### 2.2 运行期兼容同步默认无副作用

文件：`apps/web/src/context/canvasCompatibility.ts`

`syncCanvasCompatibility(canvas)` 默认不会再标记 `userMoved`。恢复布局保护只在显式选项下启用，避免新生成图片被误判成用户移动，影响自动布局。

### 2.3 位置写入 no-op 防护

文件：`apps/web/src/context/canvasPositionUpdates.ts`

当前实现已增加：

- 非法坐标拒绝。
- 相同位置直接返回原 canvas。
- 0.5px 内抖动视为无变化。
- 选区移动时减少中间数组构建。

这可以降低布局纠偏、拖拽提交、恢复同步时的重复 state 写入。

## 3. 已落实/已对齐部分

## 3.1 Workspace 主渲染路径已拆分

文档要求：

- 提取 `useWorkspaceCanvasData`。
- 提取 `useCanvasSpatialIndex`。
- 提取 `useVisibleCanvasItems`。
- 提取 `useCanvasRenderItems`。
- 只对可见节点生成 render items。

当前情况：

- [x] 已在 `useCanvasSpatialIndex.ts`、`useVisibleCanvasItems.ts` 中实现核心拆分。
- [x] 在 `useVisibleCanvasItems.ts` 搜集过程中，增加了精确 bounds 相交（`rectIntersect`）二次裁剪，杜绝假阳性。
- [x] selected / dragging / draft 等交互节点保留强制可见。

风险：

- 100+ 节点下，平移/缩放仍可能触发大范围派生计算。
- 后续需求继续堆到 `WorkspacePage.tsx` 会放大性能回归概率。

建议下一步：

1. 新建 `apps/web/src/app/useCanvasSpatialIndex.ts`。
2. 新建 `apps/web/src/app/useVisibleCanvasItems.ts`。
3. 将 WorkspacePage 内 render item 构建迁移到 selector hooks。
4. 强制 dragging / selected / hover 节点保留渲染。

## 3.2 Measurement Scheduler 尚未落地

文档要求：

- 拖拽/缩放期间不测量。
- 一帧内批量读取 DOM。
- DOM read/write 分离。
- ResizeObserver callback 不直接 set React state。

当前情况：

- `PromptNodeComponent.tsx` 仍存在两套高度测量：
  - ResizeObserver 读取 `offsetHeight` 后调用 `onHeightChange`。
  - 另一个 ResizeObserver/offsetHeight 更新本地 `cardHeight`。
- `ImageCard2.tsx` 仍在 `useLayoutEffect` 中读取 `offsetHeight` 并挂 ResizeObserver。
- 当前测量逻辑没有统一接入 `isCanvasTransforming` / dragging / detailLevel guard。

风险：

- 大量卡片同时加载或尺寸变化时产生 layout thrashing。
- 拖拽/缩放期间触发布局读取，造成掉帧和输入延迟。
- ResizeObserver callback 直接 setState 或回调父级，造成 React commit 风暴。

建议下一步：

1. 新建 `CanvasMeasurementScheduler`。
2. Prompt/Image 卡片只提交测量请求，不直接 setState。
3. 在 `isCanvasTransforming || isDragging || detailLevel !== 'full'` 时跳过测量。
4. 高度变化 <= 1px 时忽略。

## 3.3 Connector Scheduler 尚未落地

文档要求：

- connector 更新集中调度。
- 默认 rAF 批处理。
- 只在 path 字符串变化时写 `d`。
- 拖拽时最多每帧写一次。

当前情况：

- 未发现 `ConnectorScheduler` 实现。
- 卡片组件仍直接触发 `updateConnectorDom(...)`。
- 当前连接线更新仍依赖 DOM 查询和 SVG path 写入。

风险：

- 多子图 prompt 拖拽时，连接线更新与节点数量线性放大。
- path 写入和 DOM 查询可能与卡片测量同时抢主线程。

建议下一步：

1. 提取 `apps/web/src/app/connectorScheduler.ts`。
2. 将 `updateConnectorDom` 改为 scheduler request API。
3. 加 path cache，避免重复 `setAttribute('d')`。
4. 多连接线场景考虑 Canvas renderer。

## 3.4 启动恢复仍有 O(n²) 风险

文件：`apps/web/src/context/CanvasContext.tsx`

当前启动图片恢复中，计算最近生成图时会对 generated ids 逐个遍历 canvases，再在 `imageNodes` 中 `find`。大画布下这是不必要的重复扫描。

建议下一步：

- 启动恢复时一次性建立 `imageNodeByLookupId`。
- 最近图片排序直接从 Map 中取 position。
- 非首屏图片 hydration 合并到 idle/batched update。

## 3.5 Cloud sync 仍有整棵画布 stringify 比较

文件：`apps/web/src/context/CanvasContext.tsx`

当前 cloud merge 后仍存在 `JSON.stringify(merged) !== JSON.stringify(prev.canvases)` 级别的全量比较风险。

建议下一步：

- 修改 merge helper 返回 `{ canvases, changed }`。
- 或使用轻量 signature：canvas id / node counts / lastModified / version。
- 禁止对完整 canvas tree stringify 做变更判断。

## 3.6 自动化性能基线未完成

文档要求：

- dense canvas seed fixture：20 / 100 / 500 节点。
- Playwright 或 node benchmark。
- CI 中加入性能阈值检查。
- PR checklist 增加 canvas hot path 检查。

当前情况：

- 未发现 dense canvas 性能基准脚本。
- 未发现性能阈值 CI。
- 单元测试只覆盖了恢复行为契约，不覆盖交互性能预算。

建议下一步：

1. 增加 `scripts/perf/canvas-dense-workspace.mjs`。
2. 生成 20/100/500 节点 fixture。
3. 输出 visible query、render item build、measurement flush 计时。
4. 将预算接入 CI 或至少 `npm run verify:canvas-performance`。

## 4. 优先级建议

### P0：必须立即做

1. Measurement guard：Prompt/Image 拖拽、缩放、平移期间禁止测量。
2. 启动恢复 Map 索引：去掉 generated image 最近距离计算中的重复 find。
3. Cloud sync 去掉整棵 `JSON.stringify`。

### P1：架构推进

1. WorkspacePage render selectors 拆分。
2. Spatial index + viewport query。
3. ConnectorScheduler。

### P2：长期防回归

1. Dense canvas performance benchmark。
2. CI 性能阈值。
3. Canvas hot path lint / code review checklist。

## 5. 下一轮推荐 PR 范围

建议下一轮 PR 命名：

`fix: reduce canvas startup and measurement jank`

只包含以下内容：

1. `CanvasContext.tsx` 启动图片恢复索引化。
2. `CanvasContext.tsx` cloud sync 比较去 stringify。
3. `PromptNodeComponent.tsx` / `ImageCard2.tsx` 测量 guard。
4. 单元或静态测试锁定：拖拽/缩放期间不得直接测量。

不建议在同一个 PR 中同时做 spatial index 和 WorkspacePage 大拆分。那些应单独进入后续重构 PR。

## 6. 审核结论

当前 main 没有完全按性能重构文档执行。它已经修复了恢复错位和部分交互卡顿，但文档中的完整轻量化架构还没有落地。

继续推进时应从 P0 项开始，不要继续扩散到大规模架构重写：先止住测量、启动恢复和全量 stringify 三个主线程阻塞点，再进入 WorkspacePage / spatial index / connector scheduler。
