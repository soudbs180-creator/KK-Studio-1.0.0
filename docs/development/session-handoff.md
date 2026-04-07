# KK Studio Project Handoff (v1.4.0)

## 1. 项目概览
- **项目名称**：KK Studio
- **当前稳定文档版本**：`v1.4.0`
- **当前状态**：版本口径已同步，当前工作区重点集中在设置中心、后台链路与鉴权稳态
- **定位**：面向图像、多模态与提示词生产的可视化 AI 工作台，核心交互为无限画布 + 设置工作台 + 管理后台

## 2. 当前版本重点
- **版本统一**：主应用、README、开发文档、`.agent` 规则与支付子服务版本已同步到 `1.4.0`
- **设置中心升级**：设置页采用更清晰的工作台式导航结构，总览、存储、日志与后台管理的边界更明确
- **本地化底座**：通过 `LocaleProvider` 与 localized views 为设置页引入中英双语表达能力
- **后台与鉴权收口**：服务端 Supabase 配置解析更集中，认证数据访问与管理员链路更易维护
- **用户与运营细节**：默认头像、用户资料、供应商管理、成本估算与日志体验继续收口

## 3. 当前架构
- **Frontend**：React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4
- **当前在线前端运行时**：根目录 `src/`
- **目标前端运行时**：`apps/web/`
- **State**：React Context + 本地状态 + IndexedDB / File System Access API
- **Storage**：浏览器缓存、本地文件夹与工作区维护动作共存
- **Backend / Data**：Supabase（Auth / Database / Edge Functions）+ `apps/api/` Node API
- **主支付运行时**：`apps/payment-sidecar/`
- **迁移桥接层**：`server/`、`api/`、`payment-server/`

## 4. 当前版本的事实基线
- 版本源以 `package.json`、`src/config/appInfo.ts`、`payment-server/package.json` 为准
- 文档基线以 `README.md`、`docs/development/progress.md`、本文件为准
- AI 规则基线以 `.agent/README.md` 与 `.agent/rules/skills/SKILL.md` 为准

## 5. 建议优先检查项
- **设置页**：检查 Dashboard、Storage、System Logs、Admin Console 的路由与空状态是否一致
- **鉴权侧**：继续验证管理员登录、会话恢复、权限判断与回退逻辑
- **部署侧**：核对 Vercel / Netlify / 本地环境下 Supabase 服务端配置是否一致
- **资源侧**：继续关注重型设置页与图标资源带来的构建体积

## 6. 推荐验证命令
```bash
npm run typecheck
npm run check:encoding
npm run build
```

## 7. 交接备注
- 历史文档中的旧版本号仅用于追溯，不代表当前发布基线
- 路径示例继续优先使用 `<project-root>`，避免目录名与版本号耦合
- 当前工作区仍有较多进行中的业务改动；如果准备发布，建议把设置、后台和登录链路做完整回归
