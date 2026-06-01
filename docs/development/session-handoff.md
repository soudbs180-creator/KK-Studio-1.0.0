# KK Studio Project Handoff (v1.5.1)

## 1. 项目概览
- 项目名称：KK Studio
- 当前稳定文档版本：`v1.5.1`
- 当前状态：版本口径、运行时真相表与默认验证链已同步，当前工作区重点集中在设置中心、后台链路、鉴权稳态与支付收口
- 定位：面向图像、多模态与提示词生产的可视化 AI 工作台，核心交互为无限画布、设置工作台与管理后台

## 2. 当前版本重点
- 版本统一：主应用、README、开发文档、工作区包与支付子服务版本已同步到 `1.5.1`
- 当前补丁重点：修复本地用户路由代理启动链、账单余额 hydrate 误判、Canvas 本地持久化与验证门禁漂移
- 设置中心升级：设置页采用更清晰的工作台式导航结构，总览、存储、日志与后台管理的边界更明确
- 本地化底座：通过 `LocaleProvider` 与 localized views 为设置页引入中英双语表达能力
- 后台与鉴权收口：服务端 Supabase 配置解析更集中，认证数据访问与管理员链路更易维护
- 运行时口径统一：当前在线前端仍以根目录 `src/` 为准，`apps/web/` 保持为迁移目标
- 支付链路收口：`apps/payment-sidecar/` 明确为主支付运行时，`payment-server/` 明确为过渡桥接层
- 验证链补强：集成测试、支付侧静态校验与 Hosted 预检已纳入默认治理口径
- 多供应商路由规划：已形成独立供应商、多协议面与 async task 的分层方案，作为后续 API 架构治理基线

## 3. 当前架构
- Frontend 技术栈：React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4
- 当前在线前端运行时：根目录 `src/`
- 目标前端运行时：`apps/web/`
- State：React Context + 本地状态 + IndexedDB / File System Access API
- Storage：浏览器缓存、本地文件夹与工作区维护动作共存
- Backend / Data：Supabase（Auth / Database / Edge Functions）+ `apps/api/` Node API
- 主支付运行时：`apps/payment-sidecar/`
- 迁移桥接层：`server/`、`api/`、`payment-server/`
- 说明：`payment-server/` 仍是过渡桥接层，不应再被描述为唯一的支付主运行时

当前在线前端运行时：根目录 `src/`
目标前端运行时：`apps/web/`
主支付运行时：`apps/payment-sidecar/`
`payment-server/` 仍是过渡桥接层

## 4. 当前版本的事实基线
- 版本源以 `package.json`、`src/config/appInfo.ts`、`payment-server/package.json` 与 `packages/*/package.json` 为准
- 文档基线以 `README.md`、`docs/development/progress.md`、本文件为准
- AI 规则基线以 `.agent/README.md` 与 `.agent/rules/skills/SKILL.md` 为准
- Runtime truth: `src/` remains the live frontend runtime.
- Runtime truth: `apps/web/` remains the target frontend runtime.
- Runtime truth: `apps/payment-sidecar/` is the canonical payment runtime.
- Runtime truth: `payment-server/` remains a transitional bridge.

## 5. 建议优先检查项
- 设置页：检查 Dashboard、Storage、System Logs、Admin Console 的路由与空状态是否一致
- 鉴权侧：继续验证管理员登录、会话恢复、权限判断与回退逻辑
- 部署侧：核对 Vercel、Netlify 与本地环境下 Supabase 服务端配置是否一致，并确认 Hosted 环境不会落入本地或内存降级仓储
- 支付侧：确认 Hosted 支付运行时在缺失持久化或结算凭证时会 fail closed
- 资源侧：继续关注重型设置页与图标资源带来的构建体积
- 供应商侧：按 `docs/development/multi-vendor-provider-architecture.md` 先处理 GPT Best 鉴权覆盖、Suxi 图片路由冲突与 12AI 模型列表漂移

## 6. 推荐验证命令
```bash
npm run typecheck
npm run test
npm run check:encoding
npm run build
```

## 7. 交接备注
- 历史文档中的旧版本号仅用于追溯，不代表当前发布基线
- 路径示例继续优先使用 `<project-root>`，避免目录名与版本号耦合
- 当前工作区仍有较多进行中的业务改动；如果准备发布，建议把设置、后台、登录与支付链路做完整回归
- 多供应商相关修改优先遵循 `.agent/rules/skills/vendor-routing/SKILL.md` 与新增架构方案文档，不要直接在业务层追加供应商特判

## 版本与构建治理说明
- `config/release-manifest.json` 作为主版本源
- `src/config/appInfo.ts` 作为运行时只读导出
- `release/publish/stable/manifest.json` 作为 portable stable 发布清单

