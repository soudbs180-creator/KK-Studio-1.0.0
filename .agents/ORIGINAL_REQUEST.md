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
