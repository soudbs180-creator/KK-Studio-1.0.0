# KK Studio 产品核心宪章

> Status: current
> Owner: KK Studio AI Core Team
> Verifies: `openspec/changes/upgrade-ai-creation-core/proposal.md`
> Last verified: 2026-07-21

---

## 1. 产品定义

KK Studio 是面向多模态 AI 创作、无限画布资产管理、多模型智能路由、用户自主密钥（BYOK）与商业化积分计费审计的一体化 AI 工作台。

**一句话目标**：让用户在一个画布上，用自然语言驱动 AI 完成从研究、生成、编辑到交付的完整创作流程，同时确保平台与用户密钥、平台积分与 BYOK 配额在资金与权限上绝对隔离。

---

## 2. 产品原则

### 2.1 权威源唯一

- **云端服务端**是 Job、Run、报价、账本、Agent Session 和确认授权的唯一权威源。
- 浏览器、移动端和本地缓存只持有**状态投影**与**离线降级视图**。
- 任何业务事实（费用、任务状态、路由选择）不得在浏览器端最终裁定。

### 2.2 通道互斥

- BYOK、云端用户 Key、平台积分、用户网页会员是四条**互斥执行通道**。
- BYOK 只消耗用户 Provider 配额，**绝不扣平台积分**。
- 一条任务一旦选择通道并创建 Job，执行期间不可切换通道。

### 2.3 固定链路

所有创作任务必须走同一链路：

```text
Agent -> ToolRegistry -> DurableJob -> RouteEngine -> Billing -> Provider -> Asset -> Canvas -> Verification
```

禁止双轨执行；禁止 Agent Queue 与 GenerationEngine 并行存在。

### 2.4 可审计、可对账

- 每个 Job Item 必须有 reservation、ledger、providerTaskId 和 reconciliation 状态。
- 失败必须退款；重复请求必须幂等；重试只收费一次。
- 账本金额与确认卡金额必须一致。

### 2.5 可恢复、可重规划

- Agent Run 和 Job 必须支持页面关闭、Worker 重启、租约失效和跨设备登录后的恢复。
- 已完成步骤永不重复执行；未执行步骤最多允许三次受控重规划。

### 2.6 安全边界

- Browser Bridge 只执行业务白名单流程，禁止任意 RPA、任意 URL/Shell/公开发布。
- Grok 等内部编码 Worker 通过隔离 ACP Gateway 输出 patch，禁止访问计费、生成、数据库和发布。
- 真实 API 密钥、数据库连接串、Stripe 密钥不得进入 Git 或浏览器端代码。

### 2.7 可编辑优先

- PPT 默认目标是真正可编辑 Deck（文字层、图片层、图层保留），不是整页位图。
- UI 只消费领域状态投影，不拥有业务事实；关闭视觉 Flag 只回滚界面，不回滚业务数据。

---

## 3. 架构决策

| 决策 | 内容 | 不可回退点 |
|---|---|---|
| **后端权威** | Express 负责鉴权、报价、计费、Worker、状态、审计 | 一旦 Worker 上线，浏览器侧不得再发起 Provider 直接轮询 |
| **统一链路** | 所有媒体类型走同一 DurableJob -> RouteEngine -> Billing 链路 | 删除双轨 GenerationEngine / Agent Queue 后不可恢复旧路径 |
| **Quote 冻结** | 报价创建时冻结价格版本；同 quoteId 重发必须同价 | 价格漂移必须由新 quoteId 承载，不能静默修改 |
| **v3 Job** | 新任务统一使用 v3；v2 只读兼容 | v2 不再接收新创建，只允许只读查询与对账 |
| **服务端 Feature Flag** | 能力开关与视觉开关分离，Kill Switch 在服务端 | 编译期硬编码 Flag 必须全部迁移到服务端 |
| **Agent Session 服务端化** | 对话历史、摘要、工具结果、检查点持久化到服务端 | localStorage 不再作为 Agent Run 恢复源 |

---

## 4. 关键边界

### 4.1 浏览器端禁止

- 禁止直接扣减平台积分或修改账本。
- 禁止绕过 RouteEngine 直连 Provider（BYOK 除外，但 BYOK 也必须经 ToolRegistry 调度）。
- 禁止在浏览器端最终裁定任务状态或确认授权。

### 4.2 服务端禁止

- 禁止引入前端视图组件或 CSS 框架依赖。
- 禁止在 Git 提交中遗留真实私钥；读取特权环境变量失败时必须拒绝启动。
- 禁止 Job Worker 在没有明确租约的情况下执行提交或轮询。

### 4.3 数据流边界

- UI 只能读取 `packages/shared` DTO 和 `packages/api-client` 返回的数据结构。
- 业务状态变更只能由 ToolRegistry 调用 -> 服务端 API -> 数据库 -> SSE 广播 -> UI 投影。

---

## 5. 默认决策速查

- 云端服务端是权威源？**是**。
- 用户 Key 和网页会员能力是否与平台积分混合？**否**。
- Browser Bridge 是否做任意 RPA？**否**。
- PPT 默认是否可编辑 Deck？**是**。
- Grok 首期是否对全员开放？**否**（仅内部开发者和管理员）。
- v2 Job 是否破坏性迁移？**否**（只读兼容，新任务用 v3）。
- 关闭视觉 Flag 是否回滚业务数据？**否**（只回滚界面）。

---

## 6. 修订记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-07-21 | 1.0 | 根据 `upgrade-ai-creation-core` OpenSpec 建立产品核心宪章。 |
