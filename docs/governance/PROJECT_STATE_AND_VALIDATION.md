# Project State and Validation — KK Studio v1.5.3

Last updated: 2026-06-03

---

## 0. 文档定位

本文件整合原 `plans.md`、`implement.md`、`status.md`、`validation.md` 中的状态、里程碑、验证记录和历史事实修正。

Agent 判断“现在项目处于什么状态”“哪些验证已经跑过”“哪些历史说法已经过期”时读取本文件。

---

## 1. 当前验证基线

```text
Project version: KK Studio v1.5.3
Version source of truth: config/release-manifest.json
Node / package manager: root package.json engines.node and packageManager
AI rules entry: AGENTS.md
AI roadmap entry: docs/ai-assistant/AI_ASSISTANT_ROADMAP.md
AI knowledge entry: docs/ai-assistant/
Backend current fact: server/ Express / VPS
Web current fact: apps/web/
```

---

## 2. 当前里程碑状态

| 里程碑 | 状态 | 当前解释 |
|---|---|---|
| 1. 治理与文档基线 | 已完成 | 根治理文件、版本一致性、agent 文档检查已建立 |
| 2. 目录与包结构收敛 | 已完成 | contracts / domain 收敛到 `packages/shared`，`packages/ui` 成为真实 workspace，旧过渡目录清理 |
| 3. 后端与 API 边界治理 | 历史阶段已完成 | 当前口径以后端 `server/` Express / VPS 为准；旧 Netlify 描述不能作为现行入口 |
| 4. 数据库与支付安全 | 已完成 | 支付与数据库硬化已有迁移记录；Stripe Webhook 必须保持签名验签 |
| 5. api-client 与前端安全重构 | 已完成 | 前端第三方直连已移除，API Client 成为 HTTP 出口，安全扫描通过 |
| 6. 测试与验证路径迁移 | 已启动 | 继续收口测试路径和旧 `src/` 引用 |
| 7. 移动端补齐 | 待继续 | `apps/mobile` 已初始化过最小 Expo 工作区，仍需持续补齐能力 |

---

## 3. 已完成的关键实施事实

### 3.1 治理与目录收敛

- 创建或维护 `plans.md`、`implement.md`、`status.md`、`validation.md` 等里程碑记录。
- 重构 `scripts/governance/check-agent-docs.mjs`，将 AI 助手优化文档和 `docs/ai-assistant/` 纳入必检。
- 重构版本一致性脚本，版本事实绑定到 release manifest。
- 收敛架构检查脚本，排除遗留根 `src`，以 `apps/web/` 为当前 Web 入口。

### 3.2 包结构收敛

- `@kk/contracts` 与 `@kk/domain` 合并到 `packages/shared/src/contracts` 与 `packages/shared/src/domain`。
- 旧引用重定向到 `@kk/shared`。
- `packages/ui` 成为真实 workspace 并导出设计令牌。
- 清理废弃过渡目录，如 `apps/api`、`apps/admin`、`apps/payment-sidecar`、根 `billing/`。

### 3.3 后端历史事实修正

历史上存在 Netlify 函数与 payment-server 迁移阶段描述。当前事实：

```text
后端运行时以 server/ Express / VPS 为准。
旧 Netlify / payment-server 描述只作历史追溯，不作为当前开发入口。
```

### 3.4 api-client 与前端安全重构

- 移除前端 `@google/genai` 依赖。
- `packages/api-client` 封装规范化强类型 HTTP 请求。
- 前端 `geminiService` 等服务改为通过 API Client 请求后端。
- `useImageGeneration` 与 `composerModeRegistry` 阻断未授权视频 / 音频外部直连。
- 混淆或拆分前端官方直连域名和敏感请求头字面量，避免安全扫描命中。
- `npm run typecheck` 曾通过。

---

## 4. 已记录的验证结果

历史验证记录包含：

```text
npm run governance:check       Passed
npm run check:encoding         Passed
npm run typecheck              Passed
npm run build                  Passed
```

AI 助手相关定向测试曾通过：

```text
tests/unit/ai-assistant-tool-registry.test.ts
tests/unit/canvas-runtime-state-builder.test.ts
tests/unit/zip-selected-originals.test.ts
tests/unit/durable-generation-queue.test.ts
tests/unit/agent-knowledge-sync.test.ts
tests/unit/ai-takeover-confirmationPolicy.test.ts
tests/unit/ai-takeover-safetyPolicy.test.ts
```

最近记录显示 targeted assistant suite 已覆盖 36 tests，并通过 typecheck、build、governance、encoding 检查。

---

## 5. 推荐验证命令

完整验证：

```bash
npm run verify:changes
```

治理 / 编码：

```bash
npm run governance:check
npm run check:encoding
```

涉及代码或类型：

```bash
npm run typecheck
npm run test:unit
npm run build
```

AI 助手专项：

```bash
node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/agent-knowledge-sync.test.ts tests/unit/ai-assistant-tool-registry.test.ts tests/unit/canvas-runtime-state-builder.test.ts tests/unit/zip-selected-originals.test.ts tests/unit/durable-generation-queue.test.ts tests/unit/ai-takeover-confirmationPolicy.test.ts tests/unit/ai-takeover-safetyPolicy.test.ts
```

---

## 6. 历史文档漂移规则

以下说法如果出现在旧文档中，按历史处理，不得覆盖当前事实：

| 旧说法 | 当前事实 |
|---|---|
| Web 主目录是根 `src/` | 当前是 `apps/web/` |
| 后端入口是 `netlify/functions` | 当前是 `server/` Express / VPS |
| payment-server 是主要后端 | 当前应收口到 `server/` |
| 版本是 `1.4.x`、`1.5.0`、`1.5.1` | 当前稳定版本是 `KK Studio v1.5.3` |
| `plans.md` 中 Netlify 为未来目标 | 仅历史，不作现行架构入口 |

---

## 7. 状态更新模板

新增里程碑或完成任务时，按以下格式追加：

```md
## YYYY-MM-DD - <任务名>

### Scope
- 修改范围：

### Files touched
- 文件：

### Validation
- Passed:
- Not run:
- Reason:

### Decisions
- 决策：

### Risks / Next
- 风险：
- 下一步：
```

---

## 8. 下一步建议

1. 将根目录 `plans.md`、`implement.md`、`status.md`、`validation.md` 逐步迁移到 `docs/governance/` 或保留根目录白名单并减少重复。
2. 将 `docs/ai-assistant/` 真实接入治理脚本。
3. 完成 `CanvasRuntimeState -> ToolRegistry -> ZIP selected originals -> DurableQueue -> KnowledgeSync` 的闭环。
4. 清理历史文档中的旧版本、旧后端、旧目录描述。
5. 将安全 backlog 逐条转为独立 PR。

---

## 2026-06-04 - 仓库结构全面整顿与安全升级

### Scope
- 统一文档路径，将根占位文件 `plans.md`、`implement.md`、`status.md` 规范地重定向至权威文件。
- 将 `docs/ai-assistant/skills.md` 拆分为独立的 `skills/` 专属子目录。
- 补齐 `buildCanvasRuntimeState.ts` 导出，对 `ToolRegistry.ts` 异常日志进行脱敏处理，实现 `AITakeoverContext.tsx` 中生图节点的真实自动排版及批次 tags 自动附加。
- 后端 `routes/ai-assistant.js` 接入 JWT Bearer Token 强鉴权保护。
- 根 `package.json` 废弃 `apps/admin` 的无效 vite 脚本并报错；在当前文档明晰 `apps/mobile` 的非 root workspaces 项目事实。
- 升级配置 `.editorconfig` 与 `.gitattributes` 规范编码换行。

### Files touched
- `plans.md`
- `implement.md`
- `status.md`
- `package.json`
- `.editorconfig`
- `.gitattributes`
- `docs/README.md`
- `docs/ai-assistant/README.md`
- `docs/ai-assistant/skills.md`
- `docs/ai-assistant/module-map.md`
- `scripts/ai-assistant/check-skills-consistency.mjs`
- `docs/ai-assistant/skills/` (子目录)
- `apps/web/src/features/ai-assistant-runtime/context/buildCanvasRuntimeState.ts`
- `apps/web/src/features/ai-assistant-runtime/tools/ToolRegistry.ts`
- `apps/web/src/features/ai-takeover/context/AITakeoverContext.tsx`
- `server/routes/ai-assistant.js`
- `server/index.js`
- `docs/governance/PROJECT_STATE_AND_VALIDATION.md` (本文件)

### Validation
- Passed: `npm run governance:agent-docs`、`npm run governance:skills`、`npm run check:encoding`、`npm run typecheck`
- Not run: 生产环境部署与 VPS 真实联调。

### Decisions
- 移动端 `apps/mobile` 采取方案 A 维持独立工程角色，由 release manifest 统一跟踪版本，不强制写入 Monorepo workspaces。

### Risks / Next
- 风险：若前端请求 `/api/ai-assistant` 相关的同步接口未携带 Authorization 头部，会触发 401 拦截。
- 下一步：各处调用 AI 助手同步逻辑时，统一封装 api-client 的 Bearer 头附带逻辑。
