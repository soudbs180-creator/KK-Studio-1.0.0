# Change Proposal: upgrade-ai-creation-core

> Status: active / Phase 0
> Owner: KK Studio AI Core Team
> Source of truth: this OpenSpec change
> Last verified: 2026-07-21

---

## 1. 动机

KK Studio v1.6.0 已完成"AI 优先工作台"四大战略变更的代码落地，但 AI 创作核心的关键闭环仍未完成：

- 服务端是请求代理与计费网关，却不是生成任务的**权威控制面**；关闭浏览器后异步任务（视频/音频/批量）无人继续推进。
- 平台积分通道与用户 BYOK/云端 Key 通道混在浏览器侧执行，**报价、路由、队列、对账**没有统一事实源。
- Agent 运行时仅有当前指令和画布上下文，没有跨轮对话历史、摘要和工具结果回填， reload 后 running Run 被直接标记为失败。
- PPT 生成走 `handleSlides()` 旁路，把整页压成 AI 图片，与已有的可编辑 OpenXML 导出脱节。
- 文档生态已膨胀到 226 份 Markdown，其中 152 份被治理脚本标为 `current`，历史 Roadmap 与兼容占位文档仍被错误归类。

本 OpenSpec 把 KK Studio 从"功能集合"升级为"云端权威控制面 + 浏览器投影"的 AI 创作核心架构。

---

## 2. 目标

2.1 **Express 成为唯一权威控制面**
负责鉴权、报价(Quote)、计费、Worker 调度、状态持久化、审计和对账。浏览器仅消费状态投影、处理画布落卡、运行本地 Browser Bridge 守护进程。

2.2 **统一固定链路**
`Agent -> ToolRegistry -> DurableJob -> RouteEngine -> Billing -> Provider -> Asset -> Canvas -> Verification`
删除 Agent Queue 与 GenerationEngine 的双轨执行；同一路径服务生图、视频、音频、PPT 和网页自动化。

2.3 **互斥执行通道**
BYOK、云端用户 Key、平台积分、用户网页会员必须是四条互斥通道：
- BYOK 只消耗用户 Provider 配额，绝不扣平台积分。
- 平台积分由服务端 Quote -> Job -> Billing -> Provider 闭环处理。

2.4 **Agent 真正可连续运行**
对话历史、摘要、工具结果、token 预算、确认授权和检查点全部持久化到服务端；Worker 在页面关闭后继续执行，重新登录后跨设备恢复投影。

2.5 **PPT 作为可编辑 Deck**
把 `handleSlides()` 旁路替换为 `PptDeckPlan -> Slide Jobs -> Editable Deck`，每页独立失败、重试、编辑；导出保留文字、图片和图层。

2.6 **文档收敛到 15–25 份真 current**
建立产品核心宪章、源码验证能力矩阵和单一 OpenSpec；其余文档降级为 `reference`、`proposed` 或 `archive`。

---

## 3. 范围

### 3.1 在范围内

- 新增 DTO 与契约：GenerationQuoteDto、GenerationJobDto v3、AgentSessionDto、AgentContextSnapshotDto、AgentRunEventDto、PPT 契约。
- 新增服务端接口：报价、Job 创建/事件流/控制、Agent Session/Run 查询/确认/取消/恢复。
- 新增服务端 Worker 子系统：租约、心跳、提交、轮询、超时、取消、对账。
- 改造现有路由：/v1/generate、/v1/generate/async、图像/视频/音频 Provider Adapter 统一。
- 改造 Agent 运行时：Planner 输入结构化 Session Context、上下文裁剪、工具结果回填、Run 恢复与受控重规划。
- 改造 PPT 链路：PptDeckPlan -> Slide Jobs -> 可编辑 Deck 导出。
- 改造 Browser Bridge：站点能力清单、冻结目标、结构化结果，保留白名单/确认/审计。
- 改造 Feature Flag：编译期常量升级为服务端 Feature Flag，能力开关与视觉开关分离，提供管理员 Kill Switch。
- 文档治理：修复分类器、路径存在性检查、能力声明证据检查；归档历史占位文档。
- 测试与验收：Fake Provider 全通道、Quote/计费/并发/对账、Worker 续跑、跨设备恢复、PPTX OpenXML 回归、Browser Bridge 安全。

### 3.2 不在范围内

- 不替换 LLM 模型本身（Grok 仅作为内部编码 Worker）。
- 不开放 Browser Bridge 为任意网页 RPA。
- 不迁移运行中的 v2 Job 到 v3（v2 只读兼容，新任务用 v3）。
- 不新建第二套 AI 助手或平行 ToolRegistry。
- 不改动无限画布 V2 已收敛的渲染与性能基线。

---

## 4. 核心不变量

1. **云端服务端是 Job、Run、报价和账本权威源**；本地存储只做离线投影与降级。
2. **UI 只消费领域状态投影**，不拥有 Job、Run、账本或路由事实；任何新 UI 复用相同 DTO、ToolRegistry 和服务端状态。
3. **BYOK、云端用户 Key、平台积分、用户网页会员互斥**；BYOK 只消耗用户 Provider 配额，绝不扣平台积分。
4. **固定唯一业务链路**：Agent -> ToolRegistry -> DurableJob -> RouteEngine -> Billing -> Provider -> Asset -> Canvas -> Verification。
5. **Browser Bridge 只执行业务白名单流程**，不建设任意网页 RPA。
6. **PPT 默认目标是真正可编辑 Deck**，不是整页位图。
7. **Grok 首期仅内部开发者和管理员可用**，通过隔离 ACP Gateway 输出 patch/artifact，禁止访问计费、生成、数据库和发布。
8. **v2 Job 保持只读兼容并完成对账；新任务使用 v3，不对运行中的旧任务做破坏性迁移**。

---

## 5. 兼容性

- v2 生成 Job 数据库行与 API 响应保持只读兼容；v2 只支持已完成的只读查询和退款对账，不接收新创建。
- 新创建任务（无论生图/视频/音频/PPT/网页自动化）统一使用 v3 Job 契约和 Quote 流程。
- 前端旧代码中引用 v2 字段的内部调用可保留一个完整迭代，但新代码必须引用 v3。
- 服务端 Feature Flag 默认关闭新 Worker 流程，按管理员/受邀测试/全量三阶段灰度开启。

---

## 6. 成功标准

- 任何通道（BYOK、本地 Key、云端 Key、平台积分、setup-required）的 Fake Provider 测试覆盖提交、轮询、失败、取消。
- Quote 过期、余额不足、并发预扣、重复请求、失败退款、重试只收费一次全部通过；账本与确认卡金额一致。
- 关闭浏览器、Worker 重启、租约失效、跨设备登录后继续执行；已完成 Item 永不重复提交或换通道。
- Agent 多轮指代、上下文裁剪、工具结果回填、确认过期、owner/画布切换、崩溃恢复和最多三次受控重规划全部通过。
- PPTX 解包通过 OpenXML 校验，文字层、图片层、顺序和关系文件完整；PowerPoint/LibreOffice 可编辑。
- Browser Bridge 通过 SSRF、动态目标、敏感字段脱敏、二次确认、断连 setup_required 验收；无模拟成功。
- 每阶段跑 `architecture:check`、`governance:check`、`typecheck`、`build`、完整测试和 `verify:changes`。
- 文档治理后 current 文档压缩到 15–25 份，其余正确归类为 reference / proposed / archive。
