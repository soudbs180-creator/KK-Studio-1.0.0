Status: reference

# KK Studio Architecture Source of Truth (v1.6.0)

Last Updated: 2026-07-13
Project Version: 1.6.0

本文档定义了 KK Studio 目前最新的真实物理架构事实与技术规格，供 AI 助手、代码审查与 CI 脚本做强一致校验。任何后续开发必须以此文档记录的实际实现为准。

---

## 1. 画布高性能渲染渲染链路 (Canvas Performance Abstraction)

KK Studio 的无限画布针对 1000+ 节点卡片的场景进行了专门的轻量化重构，核心优化机制由以下组件共同构成：

### 1.1 空间索引网格桶 (Canvas Spatial Index)
* **实现类**：[CanvasSpatialIndex](../../apps/web/src/canvas/CanvasSpatialIndex.ts)
* **规格**：使用 1000px 桶大小 of Grid Bucket 算法缓存卡片与组的位置几何。
* **主要 API**：
  * `updateNode(id, bounds)`: 注册或更新节点位置。
  * `removeNode(id)`: 移除节点。
  * `query(left, top, right, bottom)`: 快速检索与视口网格相交的桶内全部节点 ID 集合。
  * `getNodeBounds(id)`: 检索节点最新的 bounds 缓存。

### 1.2 二次精确裁剪过滤 (Precise Viewport Culling)
* **实现 Hook**：[useVisibleCanvasItems](../../apps/web/src/app/useVisibleCanvasItems.ts)
* **规则**：
  1. 通过 `spatialIndex.query()` 找出网格桶粗筛候选集。
  2. 针对粗筛的每个节点，使用 `rectIntersect` (即 `!(bounds.x + bounds.width < vLeft || bounds.x > vRight || bounds.y + bounds.height < vTop || bounds.y > vBottom)`) 执行精确二次裁剪，过滤假阳性（视口外但在相交桶内的多余卡片）。
  3. **强制可见保护**：交互中的 `draftNodeId` 节点及 `selectedNodeIds` 节点不论是否相交均强制保留渲染，防 Unmount 导致的状态或焦点丢失。

### 1.3 批量测量高度调度器 (Measurement Scheduler)
* **实现类**：[CanvasMeasurementScheduler](../../apps/web/src/canvas/CanvasMeasurementScheduler.ts)
* **规格**：
  * 将零星、高频的 DOM 变化（例如卡片高度变更）合流至统一的 RAF 周期进行批量处理，消除 Layout Thrashing（DOM 读写交替造成的排版级联卡顿）。
  * 包含 DOM 读阶段（批量获取 offsetHeight）与 React 写状态阶段。
  * **全局交互锁**：拖拽或缩放画布时激活全局锁 `locked`，挂起一切非交互高度测算，保障核心动画流畅度。

---

## 2. API 生成路由权威与浏览器投影

* **服务端权威实现**：`services/api/lib/generation-v3/routeEngine.js` 冻结 Provider、Model、Channel、Adapter Version 与 Connection route；Quote、Job、Billing 和 Worker 都消费同一 route snapshot。
* **浏览器兼容投影**：[ProviderRouteEngine.ts](../../apps/web/src/core/routing/ProviderRouteEngine.ts) 与 [routePolicies.ts](../../apps/web/src/core/routing/routePolicies.ts) 继续负责设备能力、用户偏好和 setup-required 的交互建议。
* **边界规则**：浏览器路由只提供交互投影，不拥有最终 Provider、计费或 Job 决策；实际提交必须由服务端重新校验并使用冻结 route snapshot。
* **当前兼容行为**：
  * 桌面端可优先建议 `local-runner`，但未通过安全 gate 的 Local Runner 仍是 experimental。
  * 云端用户 Key 与平台积分由服务端按互斥 Channel 执行，浏览器不能自行切换或扣费。
  * 手机端默认建议云端能力，不把本地 Runtime 当作必需依赖。
* **Worker 状态**：image Durable Worker 代码基础位于 `services/api/lib/generation-v3/worker/`，默认 flag 为 `off`；migration rehearsal、internal 灰度和恢复 E2E 通过前不得描述为线上权威执行路径。

---

## 3. 安全敏感边界 (Security Boundaries)

* **严禁硬编码**：禁止在前端源码中硬编码 VPS IP 串、sslip 域名及任何第三方提供商（如 OpenAI、Gemini）的明文 API 密钥。
* **fallback 机制**：VPS fallback 地址必须通过 `VITE_KK_API_FALLBACK_URL` 环境变量动态读取与配置，防硬编码泄露。
* **数据存储**：手机端 IndexedDB 仅扮演数据缓存和离线 Pending 队列角色，登录用户的 Workspace 同步依靠 `syncService` 云端优先流程解决。
