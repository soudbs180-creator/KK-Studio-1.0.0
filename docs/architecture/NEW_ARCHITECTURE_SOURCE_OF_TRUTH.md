# KK Studio Architecture Source of Truth (v1.5.9)

Last Updated: 2026-06-26
Project Version: 1.5.9

本文档定义了 KK Studio 目前最新的真实物理架构事实与技术规格，供 AI 助手、代码审查与 CI 脚本做强一致校验。任何后续开发必须以此文档记录的实际实现为准。

---

## 1. 画布高性能渲染渲染链路 (Canvas Performance Abstraction)

KK Studio 的无限画布针对 1000+ 节点卡片的场景进行了专门的轻量化重构，核心优化机制由以下组件共同构成：

### 1.1 空间索引网格桶 (Canvas Spatial Index)
* **实现类**：[CanvasSpatialIndex](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/canvas/CanvasSpatialIndex.ts)
* **规格**：使用 1000px 桶大小 of Grid Bucket 算法缓存卡片与组的位置几何。
* **主要 API**：
  * `updateNode(id, bounds)`: 注册或更新节点位置。
  * `removeNode(id)`: 移除节点。
  * `query(left, top, right, bottom)`: 快速检索与视口网格相交的桶内全部节点 ID 集合。
  * `getNodeBounds(id)`: 检索节点最新的 bounds 缓存。

### 1.2 二次精确裁剪过滤 (Precise Viewport Culling)
* **实现 Hook**：[useVisibleCanvasItemsNew](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/app/useVisibleCanvasItems.ts)
* **规则**：
  1. 通过 `spatialIndex.query()` 找出网格桶粗筛候选集。
  2. 针对粗筛的每个节点，使用 `rectIntersect` (即 `!(bounds.x + bounds.width < vLeft || bounds.x > vRight || bounds.y + bounds.height < vTop || bounds.y > vBottom)`) 执行精确二次裁剪，过滤假阳性（视口外但在相交桶内的多余卡片）。
  3. **强制可见保护**：交互中的 `draftNodeId` 节点及 `selectedNodeIds` 节点不论是否相交均强制保留渲染，防 Unmount 导致的状态或焦点丢失。

### 1.3 批量测量高度调度器 (Measurement Scheduler)
* **实现类**：[CanvasMeasurementScheduler](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/canvas/CanvasMeasurementScheduler.ts)
* **规格**：
  * 将零星、高频的 DOM 变化（例如卡片高度变更）合流至统一的 RAF 周期进行批量处理，消除 Layout Thrashing（DOM 读写交替造成的排版级联卡顿）。
  * 包含 DOM 读阶段（批量获取 offsetHeight）与 React 写状态阶段。
  * **全局交互锁**：拖拽或缩放画布时激活全局锁 `locked`，挂起一切非交互高度测算，保障核心动画流畅度。

---

## 2. API 生成智能路由决策 (ProviderRouteEngine)

* **实现类**：[providerRouteEngine.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/generation/providerRouteEngine.ts) 与 [routePolicies.ts](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/features/generation/routePolicies.ts)
* **路由行为**：
  * **桌面端优先本地**：检测到桌面端设备且本地 runner 可达并拥有有效本地 API 密钥时，默认路由至 `local-runner`。
  * **云端补位/海外代理**：本地失败或无 VPN 网络可达时，允许走云端加密用户 Key (`cloud-user-key`) 或走平台代理和积分积分模式 (`cloud-platform-key`)。
  * **手机端云端优先**：手机端默认直接路由至云端，不支持强制本地化存储。

---

## 3. 安全敏感边界 (Security Boundaries)

* **严禁硬编码**：禁止在前端源码中硬编码 VPS IP 串、sslip 域名及任何第三方提供商（如 OpenAI、Gemini）的明文 API 密钥。
* **fallback 机制**：VPS fallback 地址必须通过 `VITE_KK_API_FALLBACK_URL` 环境变量动态读取与配置，防硬编码泄露。
* **数据存储**：手机端 IndexedDB 仅扮演数据缓存和离线 Pending 队列角色，登录用户的 Workspace 同步依靠 `syncService` 云端优先流程解决。
