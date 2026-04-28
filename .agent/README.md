# .agent 文件夹

此目录用于存放 **KK Studio 项目级 AI 修改规则**，目标是让任何代理或代码助手在修改本项目时，都能优先遵循统一的工程、UI、版本与验证规范。

## 当前项目基线
- **项目版本**：`1.4.2`
- **最后更新**：`2026-04-29`
- **仓库级入口**：`AGENTS.md`
- **AI 快速入口**：`.agent/AGENT-QUICKSTART.md`
- **规则主文件**：`.agent/rules/skills/SKILL.md`
- **Cadence 专项补充**：`.agent/rules/skills/cadence-skill/SKILL.md`
- **供应商路由专项补充**：`.agent/rules/skills/vendor-routing/SKILL.md`

## 规则作用
- 统一 UI / 交互 / 文案风格
- 统一版本号维护方式
- 统一文档与代码同步策略
- 统一提交前验证动作
- 统一 Gemini 多协议开发时的判断方式，避免把 Google 官方协议与兼容协议混写

## 修改时必须同步的版本口径文件
当项目版本发生变化时，优先同步以下文件：
- `config/release-manifest.json`（版本真相）
- `package.json`
- `src/config/appInfo.ts`（运行时只读导出，必须继续派生自 `config/release-manifest.json`）
- `README.md`
- `.agent/README.md`
- `docs/development/session-handoff.md`
- `docs/development/progress.md`
- `release/publish/stable/manifest.json`（portable stable 发布清单）
- `payment-server/package.json`
- `packages/*/package.json`

## 修改时必须遵守的原则
1. **不要手写分散版本号**：UI 中展示版本时应优先读取统一常量。
2. **不要使用版本化绝对路径**：文档示例优先写 `<project-root>`，避免目录名与版本号绑定。
3. **不要只改代码不改文档**：涉及行为、结构、版本时必须同步说明文件。
4. **不要只改一个端**：影响前后端协议、支付、Supabase、存储时，要检查关联端。

## 推荐验证
```bash
npm run governance:version
npm run governance:agent-docs
npm run typecheck
npm run check:encoding
npm run build
```

## 编码读取提示
- 本仓库文档与规则文件统一按 UTF-8 保存。
- 在 Windows PowerShell 默认 `cp936` 会话里，`Get-Content` 可能把中文显示成乱码；优先使用 `Get-Content -Encoding UTF8`、`[System.IO.File]::ReadAllText(..., [System.Text.Encoding]::UTF8)` 或直接运行仓库治理脚本验证。

## 说明
`SKILL.md` 是详细规则总纲；本 README 负责说明当前基线版本和“修改时必须同步什么”。
- 对支持仓库级入口约定的 AI 代理，优先从 `AGENTS.md` 进入。
- 对需要更快定位规则的代理，优先读 `.agent/AGENT-QUICKSTART.md`。
- 涉及 Cadence Virtuoso / CIW / OA 数据库相关的 `SKILL` 脚本时，优先同时参考 `.agent/rules/skills/cadence-skill/SKILL.md`。

## 规则拆分
- 总纲：`.agent/rules/skills/SKILL.md`
- Cadence SKILL 专项规则：`.agent/rules/skills/cadence-skill/SKILL.md`
- 供应商路由专项规则：`.agent/rules/skills/vendor-routing/SKILL.md`
- 当任务明确要求输出 Cadence Virtuoso / CIW / OA 数据库脚本时，优先遵循专项规则，再回到总纲查看通用要求。
- Cadence 专项规则已内置常用模板与任务型模板，可直接参考选择集处理、几何创建、对象清理、CIW 调试，以及批量移动 / 按图层删除 / 批量加 label / 从 selection 生成图形的脚本骨架。
- 当任务涉及 `12AI`、`GPT Best`、`New Suxi AI`、多协议代理、模型探测或协议回退时，优先遵循供应商路由专项规则，再回到总纲查看通用要求。

## Gemini 开发补充
- 涉及 Gemini 官方通道、Gemini 原生协议、OpenAI 兼容代理、Imagen、Veo 时，优先参考 `docs/development/gemini-agent-guide.md`
- 该文档会把官方 Gemini coding agent guidance 映射到本项目当前的 `providerStrategy`、`connectionTest`、`GoogleAdapter`、`GeminiNativeAdapter` 与 `geminiService` 分层
