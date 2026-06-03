# Project Progress Report - KK Studio v1.5.3

## 状态
**Current Status**: Active / Documentation Baseline Synced

## 1. 已完成

### 1.1 版本与说明统一
- [x] 主项目版本统一为 `1.5.3`
- [x] 画布展示版本继续以 `src/config/appInfo.ts` 集中管理
- [x] README、开发进度、交接文档、移动端报告同步到 `v1.5.3`
- [x] 支付子服务与 `packages/*` 版本元信息同步到 `1.5.3`
- [x] 修复 Node/ESM 启动链、用户路由云回退、账单 hydrate 误判与 Canvas 本地持久化问题
- [x] 构建版本清单补充 `releaseDate / releaseNotes`，便于后续发布与更新校验
- [x] 重构移动端设置页顶栏布局，删除中英文按钮，使文案居中，规范左侧返回和右侧关闭逻辑

### 1.2 文档表达升级
- [x] README 按“项目定位、优势、核心能力、版本说明”结构重写（中文版）
- [x] 项目优势从单纯界面描述，升级为“创作编排 + 模型接入 + 运维闭环”表达
- [x] `AGENTS.md` 与 `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md` 同步当前版本与最近一次文档基线更新时间

### 1.3 当前工作区反映的版本重点
- [x] 设置中心持续重构，导航结构与页面职责更清晰
- [x] 设置页补齐本地化底座，开始支持 `zh-CN / en-US`
- [x] 管理员与鉴权链路继续收口，服务端 Supabase 配置解析更集中
- [x] 用户资料、默认头像、日志与存储相关体验继续打磨

## 2. 当前重点
- **稳定优先**：在不破坏既有使用路径的前提下，继续把设置、后台和鉴权链路做稳
- **部署一致性**：继续降低本地与线上环境差异，尤其是服务端配置与会话相关行为
- **文档一致性**：今后所有“当前版本”说明以 `1.5.3` 为基线
- **多供应商架构方案**：已补充独立供应商 / 多协议面 / surface 路由的分层改造方案，详见 `docs/development/multi-vendor-provider-architecture.md`
- **验证链补强**：集成测试、支付侧静态校验与 Hosted 预检继续纳入默认回归口径
- **运行时口径一致**：当前桌面 Web 主运行时以 `apps/web/` 为准，后端过渡代理与 VPS 路由以 `server/` 为准，版本事实以 `config/release-manifest.json` 为准

## 3. 待继续项
- [ ] 对设置中心、管理后台和登录注册链路做一轮完整回归
- [ ] 继续压缩重型设置页面与首屏无关资源
- [ ] 继续核对 Supabase 迁移链与运行时依赖是否完全一致
- [ ] 为双语设置页补齐更多实际入口与边界验证
- [ ] 按多供应商架构方案推进 Phase 1，先修正鉴权覆盖、图片路由冲突与模型列表漂移

## 4. 已知观察
- 当前工作区仍有较大规模的业务改动在进行中，版本文档已同步，但仍建议做完整验证
- `@lobehub/icons` 与部分设置页面相关资源体积仍值得继续关注
- 历史文档保留旧版本号仅用于追溯，不代表当前发布基线
- 当前多供应商接入能力已覆盖大多数行业请求方法，但供应商事实、协议面和执行逻辑仍需进一步解耦
- Hosted 发布链路已经开始收紧 fail-closed 语义，后续发布前应继续验证支付、鉴权和工作区同步不会落入危险的降级路径

## 5. 推荐回归检查
```bash
npm run typecheck
npm run check:encoding
npm run build
```

---
## 6. Refresh Coordination
- [x] Billing refresh keeps background sync silent and limits blocking loading to unresolved bootstrap.
- [x] Admin model catalog auto-refresh now shares one cooldown policy across focus, visibility, timer, and broadcast triggers.
- [x] API settings keep snapshot-backed views interactive while cloud reconciliation runs in the background.
- [x] Third-party provider management now scopes busy states to the active action instead of locking the whole page behind one loading flag.
*Report Updated: 2026-06-01*

## 版本与构建治理说明
- `config/release-manifest.json` 是本项目的版本真相
- `apps/web/src/config/appInfo.ts` 作为运行时只读导出
- `release/publish/stable/manifest.json` 作为 stable 发布清单
