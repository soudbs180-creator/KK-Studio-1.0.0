# KK Studio 全栈架构审查与优化报告 (Architecture Review)

> 报告版本：v1.5.4-Rev1  
> 审查视角：全栈架构设计、高并发事务性、Web 渲染管线、AI 代理上下文读取效率

---

## 🧭 AI 路由与上下文窗口优化 (AI Context Windows & Indexing)

### 1.1 现状与痛点
当 AI 编程助手（如 Claude, Codex, Antigravity）面对数十万行的 Monorepo 源码时，极易因上下文信息过载（Context Overflow）而产生“幻觉”，或在冗余的文档中降低注意力。

### 1.2 苛刻审查
* 之前的设计将具体规范全塞入 `README.md`，导致每次 AI 检索 `README.md` 都会吞掉多余的 Token，且容易模糊掉“当前稳定事实”与“启动命令”等 P0 级核心数据。
* **物理分层路由虽然有效，但缺乏语义感知**。如果 AI 在不知道该去读哪份文档时，依然只能靠关键词全局 Grep，效率低下。

### 1.3 深度优化对策
> [!TIP]
> **建立 Markdown 语义锚点元数据（Semantic Anchor Metadata）**
在根目录 [README.md](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/README.md) 的第 3 节中，使用结构化、无冗余的链接语法。在各子规范 `.md` 文档的头部统一引入 `<!-- AI_ROUTING_KEY: ... -->` 注释标记，方便 AI 助手在语义检索阶段进行正则过滤或嵌入式匹配。

---

## 🏛️ 无限画布 Z-Index 图层与 Stacking Context 审查

### 2.1 现状与痛点
在 `Z_INDEX_GUIDE.md` 中规定了从 `1` 到 `1000+` 的图层区间，试图通过绝对数值保障不被遮挡。

### 2.2 苛刻审查
> [!CAUTION]
> **层叠上下文 (Stacking Context) 的致命缺陷**  
在现代浏览器渲染引擎中，`z-index` 的绝对数值只有在同一个层叠上下文（Stacking Context）中才有效。  
1. 如果卡片节点（`z-index: 10`）设置了 `transform`（用于画布缩放/平移）、`opacity` 小于 1、或 `filter: blur`，**该节点会隐式创建一个全新的层叠上下文**。
2. 此时，即使节点内部的下拉菜单或 Tooltip 设置了 `z-index: 1000`，它也**绝对无法**超越父级节点的边界，甚至会被父级的 `overflow: hidden` 物理截断。

### 2.3 深度优化对策
1. **统一 Portal 脱离上下文契约**：
   * 所有特权浮动组件（右键上下文菜单、Tooltip、Modal、悬浮通知）**禁止**直接嵌套在 Canvas Node DOM 树中。
   * 必须通过 React Portal 强制挂载至 `document.body` 根节点下（属于全局 Stacking Context 的顶层）。
2. **画布基底隔离（Canvas Layer Isolation）**：
   * 将 Canvas 拆分为 `CanvasLayer` 和 `UILayer` 两个同级容器。`CanvasLayer` 统一设置 `contain: layout style;` 属性以开启浏览器渲染管线的隔离优化，保障卡片拖拽与连线重绘仅在此上下文进行，绝不波及外围的浮动面板。

---

## ⚡ 视口裁剪与离线缓存自愈（渲染管线与内存泄露审查）

### 3.1 现状与痛点
在 `CANVAS_PERFORMANCE_AND_CACHE.md` 中规定了 Viewport Culling 和基于 IndexedDB 的图片自愈。

### 3.2 苛刻审查
> [!WARNING]
> **多并发 I/O 阻塞与 Blob 内存泄漏隐患**  
1. **I/O 竞争卡顿**：当用户平移画布引入大量被裁剪掉的卡片重新显现时，组件会并发从 IndexedDB 读取图片 Base64/Blob 数据。单线程的 IndexedDB 并发过多读取会阻塞主线程的 Javascript 执行，造成滑动画布时产生卡顿掉帧（Jank）。
2. **Blob URL 内存泄漏**：在执行图片自愈时，通常会通过 `URL.createObjectURL(blob)` 生成可读取的 src 链接。如果用户反复滚动或增删卡片，而这些临时 Blob URL 没有被及时释放，会导致浏览器内存占用呈线性飙升，最终导致 OOM（Out of Memory）崩溃。

### 3.3 深度优化对策
1. **分块批量加载与时间片空闲调度（Time-Slicing Hydration）**：
   * 引入 I/O 加载队列（Loading Queue）。限制并发从 IndexedDB 读取的通道数（例如 `MaxConcurrency = 4`），其余读取通过 `requestIdleCallback` 分配在浏览器空闲帧执行。
2. **严格的自愈生命周期管理 (Blob Revocation)**：
   * 渲染组件（如 `ReferenceThumbnail`）必须监听销毁生命周期。在 `componentWillUnmount` 或 `useEffect cleanup` 时，**显式调用** `URL.revokeObjectURL(currentBlobUrl)`，彻底切断内存泄漏。
   * 对于高频重绘组件，优先使用 IndexedDB 缓存直接转化为 `arrayBuffer` 数据缓存，由内存管理器统一调度生命周期。

---

## 🪙 API 网关与计费原子事务（分布式事务一致性审查）

### 4.1 现状与痛点
在 `API_ROUTING_AND_BILLING.md` 中规定了“预扣款 -> 调用 API -> 结算/失败退款”的事务机制。

### 4.2 苛刻审查
> [!IMPORTANT]
> **网络抖动与宕机状态下的最终一致性（Eventual Consistency）危机**  
1. **死锁与孤儿账单**：在典型的扣减事务中，如果预扣积分成功，但在向 Provider（如 Google Gemini）发起网络生成请求时网络超时挂起（Hanging），或后端 Node.js 进程突然 OOM 重启。此时退款逻辑由于宕机未能触发，会导致用户的积分为空扣，留下悬空账单。
2. **假退款漏洞**：若网络请求本身由于超时在服务端报失败并回滚了扣款，但由于 Provider 实际上已经接收并执行了该生图任务，会导致系统白白损失生成服务成本。

### 4.3 深度优化对策
1. **引入 Saga 二阶段任务补偿机制（Durable Queue Compaction）**：
   * 放弃纯内存式的扣减事务，改用持久化状态机。在数据库中创建任务单时状态为 `draft`，预扣积分时状态置为 `pending_deducted`。
   * 使用 **Durable Job Queue** 承载与 Provider 的通信。当任务因进程中断悬空时，启动后台的“收尾（Reconciliation）守护进程”，定时扫描未完结的任务，向 Provider 追溯 `requestId` 的最终执行状态，从而准确决定是「扣除」还是「退款」。

---

## 🔄 版本发布与真理源控制 (CI/CD Safety Gate)

### 5.1 现状与痛点
在 `VERSION_AND_RELEASE.md` 中规定以 `release-manifest.json` 为最高事实，package 依赖同步投影。

### 5.2 苛刻审查
* 仅仅在开发规范里口头或静态文档里约束“以 `release-manifest.json` 为真理源”是脆弱的。
* 只要没有物理性的 Git Hooks 或 CI 防线，开发者或外部 Agent 在发布新包时，直接手动修改子包 `package.json` 中的 `version` 即可轻易越权并导致发布后的包依赖产生版本退化（Version Regression）。

### 5.3 深度优化对策
1. **集成 Git Pre-Commit Hook 强硬校验**：
   * 使用 `husky` / `lint-staged` 在本地提交阶段执行校验脚本：
     ```bash
     node scripts/governance/check-version-consistency.mjs
     ```
     若子 package.json 的版本与主配置文件存在漂移，直接抛出 `exit 1` 强制中断提交。
2. **CI 发布强制覆盖契约**：
   * 在 Jenkins/GitHub Actions 构建管道的发布步骤（`npm publish` 之前），自动强制执行版本投影脚本，通过物理覆盖机制强行将子 package.json 的版本号复写为 `release-manifest.json` 所指定的全局一致性版本。
