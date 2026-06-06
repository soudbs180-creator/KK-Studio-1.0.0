# Opentu 架构开发教训与治理规范 (docs/governance/OPENTU_ARCHITECTURAL_LESSONS.md)

本文件提炼并沉淀了来自 `opentu`（开图）平台在画布、多媒体、状态持久化及 Monorepo 治理等核心模块开发中的关键技术经验与教训 (Lessons Learned)，旨在指导 KK Studio 的后续架构迭代，防止引入同类设计缺陷。

---

## 1. 画布与交互教训

### 1.1 3D 旋转交互控制与状态抖动 (3D Rotation & State Jitter)
- **背景**：在对画布节点（如图片、视频卡片）引入 3D 旋转或透视变形时，由于频繁的 Pointer 移动事件和底层 CSS Matrix 计算，极易造成节点在交互时出现剧烈抖动或闪烁。
- **教训规规**：
  - 必须对拖拽和旋转事件引入 **指针锁定（Pointer Capture）** 机制，确保鼠标移出节点边界时事件仍能被捕获。
  - 采用 **四元数（Quaternion）** 或 **三维欧拉角缓存** 作为内存状态，在拖拽结束（`pointerup`）时才进行持久化 DTO 转换，禁止在每次 `pointermove` 时直接修改并同步底层 DDL/数据库字段。

### 1.2 画布持久化与静默合并 (Board Persistence & Debounced Merging)
- **背景**：画布卡片频繁创建和移动会导致极高的服务器 DDL/写入负载。若每次拖拽都立即发起 HTTP 请求，会导致严重请求拥堵，导致网络状态较差时卡片“位置回弹”。
- **教训规范**：
  - 对画布上普通节点的位置更新采用**防抖延迟合并（Debounced Merge）**：拖拽移动期间仅在 CanvasRuntimeState 进行主线程渲染同步，拖拽停止 800ms 内未发起新移动时，由后台批处理任务一次性写入持久化存储。
  - 用户手动保存或发起生图等关键事务前，必须强制执行一次同步（`Flush`），以保证生成队列拿到的视口与节点位置是最新的。

---

## 2. 状态与多缓存教训

### 2.1 双重缓存一致性 (Double Cache Consistency)
- **背景**：离线状态下用户进行的画布操作保存在本地 LocalStorage/IndexedDB，网络恢复后向后端同步时容易发生冲突或旧数据覆盖新数据。
- **教训规范**：
  - 本地缓存只能作为只读投影（Projection）和离线草稿，所有修改必须附带递增的 **版本逻辑时钟（Version / LastModified）**。
  - 后端写入数据时必须检查版本号，拒绝低于当前版本的脏写入，执行乐观锁冲突合并。

### 2.2 媒体资源缓存与大小检测 (Media Cache Integrity)
- **背景**：音频、大图等静态资源由于跨域（CORS）或 CDN 劫持导致返回大小不一致或文件损坏，SW 会将其存入 Cache Storage，导致页面持续显示“破损卡片”。
- **教训规范**：
  - Service Worker 填充缓存前，必须校验 HTTP 头中的 `content-length` 和 Response 实际体大小是否匹配，若不匹配（如中途断开）或返回 `status !== 200`，一律拒绝写入缓存。

---

## 3. 工程与依赖治理教训

### 3.1 规避 Monorepo 循环依赖 (Avoiding Cycle Dependency in Monorepo)
- **背景**：在 Nx/Pnpm 工作区中，跨包（如 `packages/shared` 与 `packages/api-client`、`apps/web`）的模糊边界极易导致循环 import，使得构建脚本报错或热更新失效。
- **教训规范**：
  - 严格遵守 `AGENTS.md` 第 4 节的单向修改链：`shared 契约 -> api-client -> server -> app 层`。
  - 严禁在 `shared` 包中引入任何 React 组件、Web DOM API 或客户端特定全局变量；`api-client` 不得绑定任何持久化具体平台存储（如 LocalStorage），必须由 App 层在运行时进行注入（Dependency Injection）。

---

## 4. 分析、监控与 SEO 教训

### 4.1 SEO 路由与同源优先 (SEO Routing & Same-Origin First)
- **背景**：由于 CDN 智能加载可能会无意中将入口文件（如 `index.html`、`sw.js`、`version.json`）代理到外部 CDN，导致搜索引擎抓取不到最新的发版内容，甚至出现跨域鉴权报错。
- **教训规范**：
  - 同源优先白名单：所有的主文档导航、SEO Meta 配置数据路由必须强绑定为源站（同源）拉取，严禁通过 CDN 动态回写偏好去代理此类基础资源。

### 4.2 Posthog 错误跟踪与元数据脱敏 (Posthog Redaction)
- **背景**：异常上报（如 Sentry, Posthog）在抛出错误栈时容易附带完整的 Request Payload，其中常包含用户的 API Key、JWT 令牌或商业简报，导致安全红线泄露。
- **教训规范**：
  - 必须在 Exception Handler 中挂载拦截净化器（Sanitizer）：对任何 error message、request header、URL query 进行正则校验，脱敏所有形如 `key`、`token`、`secret`、`password` 等随机长密钥串，确保上报日志的安全合规。
