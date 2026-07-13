# Browser Assistant Hub Specification (v1.6.0)

Last Updated: 2026-06-26
Project Version: 1.6.0

## 1. 简介 (Introduction)
Browser Assistant Hub 是 KK Studio 中为本地优先而设计的桌面端浏览器助手核心。在保障用户 Cookie/Session 隐私、无额度池化及桌面端安全隔离的前提下，通过 `Local OpenCLI Bridge` 桥接用户本地浏览器已登录的会员及 API 能力，支持多网站适配器（Site Adapters）的扩展，并通过 `BrowserActionRouter` 统一调度。

## 2. 核心架构与派发拓扑 (Core Topology)
Browser Assistant 模块分为以下几个核心部分：
* **BrowserAssistantService**：顶层服务层，负责自然语言任务的解析（通过 `BrowserTaskPlanner`），检验本地运行环境健康度（`OpencliHealthCheck`），经过 `BrowserActionRouter` 安全路由，并在必要时请求用户授权（`BrowserAssistantPermissionModal`）。
* **BrowserActionRouter**：动作路由器，对中高风险任务进行安全审查，同时如果是生成类（生图/生文）任务，调用 `ProviderRouteEngine` 决定究竟走本地、云端加密 key 还是平台积分路线。
* **SiteRegistry & Adapters**：多站点注册表，用于基于 URL 或是任务意图去匹配并派发至具体站点的适配器（如 `googleSearchAdapter`、`xiaohongshuAdapter`、`chatgptAdapter.experimental` 等）。
* **BrowserResultMapper**：结果解析映射层，将适配器返回的提取结果，通过 `CustomEvent('takeover-create-prompt-cards')` 统一投递回 `WorkspacePage` 并在画布中转化为 PromptNode / ImageNode。

## 3. Local Runner / OpenCLI 桥接协议 (Bridge Protocol)
本地通信强制遵循以下原则：
1. **握手与凭证隔离**：网页前端请求 `localhost:9099` 必须携带从本地生成的 `Authorization: Bearer <localToken>`。
2. **同源保护 (OriginGuard)**：Local Runner 必须验证 Host 头为 `localhost` 或 `127.0.0.1`，拒绝一切非同源的跨站 CORS 请求，防范 DNS rebinding 攻击。
3. **命令白名单 (Command Allowlist)**：不允许直接执行任意 Shell 命令，仅限特定指令集（如 `extract_product`、`inspect_page`、`generate_external` 等）。
4. **敏感日志脱敏**：所有的 OpenCLI 日志与 Trace 必须在序列化前对 `Bearer`、`sk-`、`cookie`、`session` 等字段执行模糊化脱敏，防范敏感凭证泄漏到本地日志。
