# Original User Request

## 2026-07-25T01:42:29Z

基于 KK Studio v1.6.0 全栈交付产物，开展针对 packages/shared 领域契约、services/api 后端 API 网关、apps/web 桌面端控制台与 apps/mobile 移动端全套代码的自动化测试、质量治理审查与跨层类型连通性验证。

Working directory: d:\KK Studio
Integrity mode: demo

## Requirements

### R1. 全栈领域契约与类型一致性
验证 `packages/shared/` 的领域 DTO 与 Schema 定义无平台专属依赖，确保 `services/api`、`apps/web` 与 `apps/mobile` 零 TypeScript 类型报错。

### R2. 治理规范与修改边界审计
执行架构与治理规则检查，确保无历史废弃目录依赖 (如根 `src/`, `apps/admin/` 等)，确保环境凭据与敏感信息完全脱敏。

### R3. API 网关与前端集成校验
校验 CLIProxyAPI 网关的 Loopback/SSRF 防护逻辑，以及 Web/Mobile 控制台组件对 shared 契约与 UI Token 的正确消费。

## Acceptance Criteria

### 类型与治理门禁
- [ ] 零 TypeScript 类型错误 (`npm run typecheck`)
- [ ] 100% 通过项目架构边界与治理审查 (`npm run architecture:check` / `npm run governance:check`)

### 契约与安全性
- [ ] 所有代码物理脱敏，无硬编码秘钥与机器私有路径
- [ ] 追加更新 `docs/development/session-handoff.md` 记录审计与验证结论

## Follow-up — 2026-07-24T18:45:21Z

依据 KK Studio v1.6.0 《全栈工程落地任务拆分、质量审查与协作流程规范》及 Implementation Plan，按四个阶段开展 Shared 契约、数据库迁移、后端 CLIProxyAPI 网关、Web 暗黑玻璃拟态控制台与 Mobile 应用的深入落地测试、架构验证与集成交付。

Working directory: d:\KK Studio
Integrity mode: demo

## Requirements

### R1. 共享契约与数据库持久化 (阶段一)
校验并完善 `packages/shared/src/domain/modules/` 中的 `brandMemory`、`imageEditing` 与 `skillRegistry` 纯 TypeScript 契约，确保零 DOM/React/Node 平台依赖；验证 `infrastructure/database/migrations/025_brand_memory_and_design_assets.sql` 的幂等表结构与索引定义。

### R2. 后端网关与 Durable Queue 调优 (阶段二)
审查与校验 `services/api/lib/gateway/cliProxyApiAdapter.js`，确保 CLIProxyAPI Sidecar 多 Provider 代理适配具备 100% Loopback 与 SSRF 防护；验证 Durable Worker 租约处理与幂等结算。

### R3. 桌面端无限画布控制台集成 (阶段三)
验证部署 `apps/web/src/components/canvas/NewInfiniteCanvasConsole.tsx` 主控制台，连通 `ImagePostProcessingToolbar`（智能去背、4K 放大、矢量化）与后端队列，确保挂载 `BrandVIFlowModal` 与 `SkillManagerPanel`。

### R4. 移动端同频路由与细节适配 (阶段四)
校验 `apps/mobile/src/app/` 的 `brand-vi.tsx`、`skills.tsx`、`canvas.tsx` 与 `settings.tsx` 页面路由流畅度，确保触控体验符合 44px+ 规范，完全复用 shared 领域模型与视觉 Token。

## Acceptance Criteria

### 质量与编译门禁
- [ ] 100% 通过全局 TypeScript 严格类型检查 (`npm run typecheck`)
- [ ] 100% 通过项目架构边界与治理审查 (`npm run architecture:check` / `npm run governance:check`)
- [ ] 全栈 2,159 项单元与集成测试保持 0 报错通过

### 安全与交付记录
- [ ] 代码库 100% 物理脱敏，无硬编码 Secret 与机器私有路径
- [ ] 追加更新 `docs/development/session-handoff.md` 记录全阶段验证履历

