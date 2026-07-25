# KK Studio 代码审查清单

> 每次 Pull Request 必须逐项完成以下检查，审查者签字确认后方可合并。

---

## CR-ARCH: 架构合规性

- [ ] **跨层顺序**: 修改是否遵循 `packages/shared` → `services/api` → `apps/web` / `apps/mobile` → `tests` → `docs`？
- [ ] **废弃隔离**: 是否确保没有引入对废弃目录的引用？（`src/`、`apps/admin/`、`apps/api/`、`root billing/`、旧版 payment 目录）
- [ ] **包边界**: 新增类型是否放在正确的包中？
  - DTO / 枚举 / 领域契约 → `packages/shared/`
  - API 调用封装 → `packages/api-client/`
  - 设计 Token / 基础组件 → `packages/ui/`
  - 页面 / 功能组件 → `apps/web/`
- [ ] **禁止前端直连**: 前端代码是否避免了直接引用密钥、数据库、支付状态？
- [ ] **Provider 合规**: 是否遵循 Provider → ProviderConnection → Model → Capability 的领域分离？

## CR-TYPE: 类型安全

- [ ] **any 使用**: 是否避免使用 `any`？如使用，是否有 `// 简体中文：原因说明` 注释？
- [ ] **shared 包纯度**: `packages/shared/` 是否保持纯 TypeScript？（零 React/DOM/Node 专属导入）
- [ ] **类型导出**: 跨包使用的类型是否有显式的 `export`？
- [ ] **命名清晰**: interface / type / enum 是否有描述性命名？
- [ ] **空值处理**: 是否使用 `??` 而非 `||` 处理 null/undefined？
- [ ] **泛型约束**: 泛型是否有合理的约束条件（extends）？

## CR-PERF: 性能

- [ ] **复杂度**: 列表/集合操作是否避免了 O(n²)？（检查 `.find`/`.filter`/`.some` 的嵌套使用）
- [ ] **React 优化**: 
  - 纯展示组件是否使用 `React.memo`？
  - 复杂计算是否使用 `useMemo`？
  - 传递给子组件的回调是否使用 `useCallback`？
- [ ] **DOM 操作**: DOM 的读取和写入是否分离？（读在 rAF 前批量执行，写在 rAF 后统一提交）
- [ ] **不必要渲染**: 是否有因 props 引用变化导致的不必要重渲染？
- [ ] **大画布**: 画布操作是否经过 `CanvasMeasurementScheduler` 批处理？

## CR-SECURITY: 安全

- [ ] **硬编码密钥**: 是否扫描确认无新的硬编码 API Key / Token / Secret？
  - 检查命令：`grep -r "sk-[a-zA-Z0-9]" apps/web/src/` （示例）
- [ ] **敏感数据**: 是否确认前端无明文暴露用户凭据、支付状态、积分余额详情？
- [ ] **输入校验**: 用户输入（表单、URL 参数、文件上传）是否有服务端校验？
- [ ] **CORS / SSRF**: API 端点是否有限制跨域访问？内部请求是否防止 SSRF？
- [ ] **依赖安全**: `npm audit` 是否有新增的 moderate 及以上级别漏洞？

## CR-TEST: 测试

- [ ] **新增测试**: 新增功能/修复是否有对应的单元测试？
- [ ] **已有测试**: `npm run test` 是否全部通过？（当前基线 2,156 pass / 0 fail）
- [ ] **边界条件**: 是否测试了以下场景？
  - 空数据 / null / undefined
  - 网络异常 / 超时
  - 并发操作
- [ ] **契约测试**: 跨模块的接口变更有无契约测试？
- [ ] **性能测试**: 画布相关修改是否需要 `verify:canvas-performance`？

## CR-DOC: 文档与可维护性

- [ ] **公开 API**: 导出的函数 / 类 / Hook 是否有清晰的 JSDoc 或 `// 简体中文：` 注释？
- [ ] **复杂逻辑**: 非直观的算法/业务逻辑是否有注释说明意图？
- [ ] **TODO/FIXME**: 是否有未附带责任人和日期的 TODO？
- [ ] **Session Handoff**: 是否已在 `docs/development/session-handoff.md` 末尾追加本次修改记录？
  - 修改范围
  - 修改文件
  - 设计决策
  - 已/未运行验证
  - 风险与下一步
- [ ] **架构文档**: 是否需要在 `docs/governance/` 或 `docs/adr/` 中更新相关内容？

## CR-DIFF: 变更范围

- [ ] **最小变更**: 是否只修改了必要的文件？是否夹带了无关的格式化/重构？
- [ ] **破坏性变更**: 是否有 API 接口变更、类型定义变更、数据库 Schema 变更？是否已通知相关方？
- [ ] **文件大小**: 新增文件是否超过 300 行？如超过，是否需要拆分？

---

## 审查流程

1. **自审（提PR前）**: 提交者自行完成所有检查项
2. **互审（PR中）**: 至少 1 名同级或以上开发者独立审查
3. **架构审查**: 涉及 `packages/shared/` 或 `services/api/` 的变更需架构负责人审查
4. **合并条件**: 所有检查项确认 + `npm run verify:changes` 全绿
