# KK Studio Project Handoff (v1.4.1)

## 1. 项目概览
- **项目名称**：KK Studio
- **当前稳定文档版本**：`v1.4.1`
- **当前状态**：版本口径、运行时真相表与默认验证链已同步，当前工作区重点集中在设置中心、后台链路与鉴权稳态
- **定位**：面向图像、多模态与提示词生产的可视化 AI 工作台，核心交互为无限画布、设置工作台与管理后台

## 2. 当前版本重点
- **版本统一**：主应用、README、开发文档、工作区包与支付子服务版本已同步到 `1.4.1`
- **运行时口径统一**：当前在线前端仍以根目录 `src/` 为准，`apps/web/` 保持为迁移目标
- **支付链路收口**：`apps/payment-sidecar/` 明确为主支付运行时，`payment-server/` 明确为过渡桥接层
- **验证链补强**：集成测试、支付侧静态校验与 Hosted 预检已纳入默认治理口径

## 3. 当前架构
- **Frontend 技术栈**：React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4
- **当前在线前端运行时**：根目录 `src/`
- **目标前端运行时**：`apps/web/`
- **Backend / Data**：Supabase（Auth / Database / Edge Functions）+ `apps/api/` Node API
- **主支付运行时**：`apps/payment-sidecar/`
- **迁移桥接层**：`server/`、`api/`、`payment-server/`
- **说明**：`payment-server/` 仍是过渡桥接层，不应再被描述为唯一的支付主运行时

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
- **设置页**：检查 Dashboard、Storage、System Logs、Admin Console 的路由与空状态是否一致
- **鉴权侧**：继续验证管理员登录、会话恢复、权限判断与回退逻辑
- **部署侧**：核对 Vercel、Netlify 与本地环境下 Supabase 服务端配置是否一致，并确认 Hosted 环境不会落入本地或内存降级仓储
- **支付侧**：确认 Hosted 支付运行时在缺失持久化或结算凭证时会 fail closed

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
