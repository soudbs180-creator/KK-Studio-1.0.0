Status: reference

# KK Studio 文档文件速查索引 (docs/INDEX.md)

以下为当前 **v1.6.0** 架构下，所有有效核心文档的文件路径及其定位的速查表。

| 核心文件路径 | 职责定位 | 关联的模块修改 |
|---|---|---|
| **最高规范与核心** | | |
| [AGENTS.md](../AGENTS.md) | AI 与 Agent 行为最高准则、安全红线、完成定义 | 任意代码、AI 助手或流程重构 |
| [README.md](../README.md) | 项目总入口、技术栈、本地启动与开发说明 | 项目启动、环境准备 |
| [docs/README.md](README.md) | 文档库全局总控、路由导航与子目录职责划分 | 查找具体文档规则 |
| [governance/DOCUMENTATION_INDEX.md](governance/DOCUMENTATION_INDEX.md) | 全量 Markdown 的 current/history/conflict/pending-archive 分类与清洗状态 | 文档治理、归档和 CI 门禁 |
| **项目治理 (Governance)** | | |
| [governance/ENCODING_AND_POWERSHELL.md](governance/ENCODING_AND_POWERSHELL.md) | 编码格式红线、乱码防护、PowerShell 显式指定编码规范 | 所有新脚本及文件写操作 |
| [governance/SECURITY_AND_BACKLOG.md](governance/SECURITY_AND_BACKLOG.md) | 安全与后端整改积压项、API 密钥隔离、CORS、计费 | 后端接口鉴权、安全配置、积分 |
| [governance/PROJECT_STATE_AND_VALIDATION.md](governance/PROJECT_STATE_AND_VALIDATION.md) | 项目里程碑状态、验证指令和测试覆盖记录 | 版本升级发布、测试编写与校验 |
| **AI 助手 (AI-Assistant)** | | |
| [ai-assistant/AI_ASSISTANT_ROADMAP.md](ai-assistant/AI_ASSISTANT_ROADMAP.md) | 画布/任务级 Agent 目标路线与迭代 Sprint | AI 助手核心引擎升级 |
| [ai-assistant/RUNBOOKS.md](ai-assistant/RUNBOOKS.md) | 选中卡片原图打包下载、批量生成、整理卡片、添加工具的 Runbook | 执行复杂批量操作或添加新 Tool |
| [ai-assistant/tool-registry.md](ai-assistant/tool-registry.md) | ToolRegistry 声明规范、调用日志和权限矩阵 | 新增或修改 Agent 行为工具 |
| [ai-assistant/canvas-runtime-state.md](ai-assistant/canvas-runtime-state.md) | 结构化 CanvasRuntimeState 定义 | 画布状态通知与选区状态计算 |
| **核心架构 (Architecture)** | | |
| [architecture/PROJECT_STRUCTURE.md](architecture/PROJECT_STRUCTURE.md) | 真实模块所有权、桌面端与移动端分层界限、AI 升级路径 | 模块所有权调整、新增底层库 |
| [architecture/DATABASE_SCHEMA.md](architecture/DATABASE_SCHEMA.md) | VPS PostgreSQL 运行时 Schema 以及必需的数据表描述 | 数据表变更（配合 `migrations/`） |
| [architecture/DATABASE_STRUCTURE.md](architecture/DATABASE_STRUCTURE.md) | VPS 数据存取路由规范、服务端计费扣减与退款原则 | 积分扣减与退款的接口实现 |
| [architecture/DEVICE_UI_ARCHITECTURE.md](architecture/DEVICE_UI_ARCHITECTURE.md) | 桌面端与 Expo 移动端 UI 界面拆分、共享逻辑设计规范 | 适配多端交互的组件重构 |
| [architecture/ADAPTER_ROUTING.md](architecture/ADAPTER_ROUTING.md) | Google 官方协议与 OpenAI 兼容适配器路由与请求参数规范 | 对接新大模型或调整图片宽高比 |
| [architecture/DESIGN.md](architecture/DESIGN.md) | 画布优先、低对比度、语义 Token、浅色/深色和无障碍交互 | UI 重构、主题切换、响应式验收 |
| **API 接口与规格 (Specs)** | | |
| [specs/API_DOCS.md](specs/API_DOCS.md) | gpt-best API 绘图、视频和音频 v2 提交与查询格式规范 | 视频/音频生成及异步轮询逻辑 |
| [specs/NANO_BANANA.md](specs/NANO_BANANA.md) | 经过画图优化的 nano-banana 接口规格 | 绘图接口参数映射 |
| [specs/GEMINI_PRO_IMAGE.md](specs/GEMINI_PRO_IMAGE.md) | 官方 `gemini-3-pro-image` 的 OpenAPI spec 和 inline 格式 | 官方绘图参数兼容 |
| [specs/API_INTEGRATION_GUIDE.md](specs/API_INTEGRATION_GUIDE.md) | 当前类型化 KK API Client、服务端 Provider adapter 和动态计价边界 | 接口逻辑重构与安全审查 |
| [specs/API_USAGE_GUIDE.md](specs/API_USAGE_GUIDE.md) | 安全 API Client 调用、任务幂等和错误处理示例 | Web/Mobile API 接入 |
| **自发布部署 (Setup)** | | |
| [setup/GUIDE.md](setup/GUIDE.md) | VPS 及自建 PostgreSQL 的初始化和快速部署 | 物理机或 VPS 的部署上线 |
| [setup/SUPABASE_CLI.md](setup/SUPABASE_CLI.md) | 历史索引（不属于当前部署链路） | 仅追溯旧资料，不执行 |
| **开发实践 (Development)** | | |
| [development/session-handoff.md](development/session-handoff.md) | Agent 会话交接记录模板文件 | 执行会话交接 |
| [development/COMPLETE_DEVELOPMENT_GUIDE.md](development/COMPLETE_DEVELOPMENT_GUIDE.md) | KK Studio 核心系统架构与完整开发指南 | 梳理整体功能、模块分层与 AI 接管逻辑 |
| [development/multi-vendor-provider-architecture.md](development/multi-vendor-provider-architecture.md) | 多供应商架构的详细设计和开发实践说明 | 重构模型路由供应商底层 |
| **业务计划参考 (Superpowers)** | | |
| [archive/superpowers/plans/](archive/superpowers/plans/) | 历史业务功能开发计划（如局部重绘、个人版离线代理等） | 仅作历史参考；当前实现以 `AGENTS.md` 和源码为准 |
| **审计与优化报告 (Reports)** | | |
| [reports/root-notes/PERFORMANCE_OPTIMIZATION.md](reports/root-notes/PERFORMANCE_OPTIMIZATION.md) | 桌面端/画布的性能优化策略 | 画布渲染性能调优 |
| **归档历史 (Archive)** | | |
| [archive/](archive/README.md) | 已过时或与 v1.6.0 冲突的历史文档目录 | 🚫 **修改当前代码时严禁使用** |
