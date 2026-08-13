Status: current

# KK Studio 1.7.0 Gate 0 进入基线

日期：2026-08-13  
基线提交：`4a54a1dc`  
稳定发布版本：`1.6.1`  
目标版本：`1.7.0`  
用途：记录 Gate 0 开始前可复跑的当前事实，不作为 1.7.0 完成或发布证明。

## 1. 证据边界

本记录只陈述本机可观察的源码、静态门禁、构建和本地 Chromium smoke：

- 浏览器 smoke 的 API 服务未启动，Vite proxy 返回连接不可用，因此只证明前端 fallback 路径，不证明生产 API、Provider、OAuth、支付或多用户隔离。
- 当前仓库没有 `apps/desktop`，也没有 Tauri/WebView2 产物；任何 Desktop 性能、安装、更新或签名结论均为 `not_observed`。
- 当前没有 Gate 0 mixed-media smoke；内存、GPU 和 object URL 长期增长均为 `not_observed`，不能由现有 10K 图片 fixture 代替。
- 现有 smoke 通过只代表现有断言通过；下文明确列出的假绿点仍是 Gate 0 缺口。

## 2. 环境

| 项目 | 观察值 | 说明 |
|---|---:|---|
| OS | Windows NT 10.0.26200.0 | Windows 本地基线 |
| PowerShell | 5.1.26100.8972 | 启动器当前使用的宿主 |
| Node.js | 24.19.0 | Codex bundled runtime |
| pnpm | 11.19.0 | 可用，但仓库依据 `package-lock.json` 仍以 npm 为主包管理契约 |
| npm | `not_observed` | 当前 shell 没有系统 npm；以下 npm 聚合命令按其 package script 逐项直接执行 |
| Playwright Chromium | revision 1228 | browser preflight 通过 |
| WebView2 Runtime | `not_observed` | 标准 registry key 未返回版本，Gate 1 必须在目标 Windows 矩阵重新探测 |

记录中不保存用户名、用户目录、Token、prompt、Asset 内容或私有文件名。

## 3. 发布与构建基线

`config/release-manifest.json`、root/server/workspace package、Web app info、Portable metadata 和文档当前一致为 `1.6.1`。

生产构建结果：

| 项目 | 结果 |
|---|---:|
| shared build | 通过，bundle 约 128.3 kB |
| UI build | 通过 |
| API client build | 通过 |
| Web Vite build | 通过，2,623 modules transformed |
| Web build duration | 约 4.84 s |
| app-version channel | `stable` |
| app-version deployment target | `production` |
| app-version source commit | `4a54a1dc` |

Gate 0 必须保持这些 1.6.1 stable projections，同时用新的 manifest parser 额外派生 1.7.0 candidate provenance。

## 4. 静态质量基线

| 门禁 | 结果 | 观察范围 |
|---|---|---|
| `architecture:check` | 通过 | 33/33 architecture guards |
| `governance:check` | 通过 | 12/12 governance commands；276 Markdown、0 conflicts |
| root TypeScript | 通过 | root `tsc --noEmit` |
| architecture TypeScript | 通过 | `tsconfig.architecture.json` |
| server syntax | 通过 | 121 files |
| tests semantic typecheck | 通过 | 641 test files |
| production build | 通过 | shared、UI、API client、Web |

当前热点 ratchet 仍报告以下事实，Gate 0 不借机做无关重构：

- `PromptBar.tsx` 约 6,610 行；
- `WorkspacePage.tsx` 约 6,395 行；
- `ChatSidebar.tsx` 约 3,997 行；
- `CanvasContext.tsx` 约 3,411 行；
- `ToolRegistry.ts` 约 1,339 行。

Gate 2 只能沿新 Spatial composition 需要的行为边界拆分这些热点，Gate 0 不做顺手重构。

## 5. Canvas benchmark 基线

`tests/benchmark/canvas-performance.test.ts`：3/3 tests 通过，测试执行约 9 ms，完整 Vitest invocation 约 0.72 s。

当前机器门禁包括：

- dense 500-node insert `<= 25 ms`；
- spatial query `<= 3 ms`；
- culling `<= 8 ms`；
- measurement `<= 10 ms`；
- connector queue `<= 10 ms`；
- synthetic 10K selection `<= 4 ms`；
- media scheduling `<= 6 ms`。

这些是数据结构/调度预算，不等于完整 10K DOM、mixed media、GPU 或 WebView2 体验。

## 6. 10K 浏览器 smoke 基线

`scripts/test/verify-large-canvas-10k-smoke.mjs` 在 Chromium 中通过，fixture 实际为 11,103 nodes：1,101 prompts 和 10,002 images。

| 指标 | 初始视口 | 缩放视口 | 当前是否阻断 |
|---|---:|---:|---|
| visible surfaces | 29 | 139 | 是，当前阈值 `<= 700` |
| visible prompt surfaces | 1 | 16 | 记录 |
| visible image surfaces | 28 | 123 | 记录 |
| minimap rects | 0 | 0 | 是，当前阈值 `<= 450`，但 0 也需要确认语义 |
| total DOM elements | 948 | 6,142 | 否，仅记录；1.7.0 目标 `<= 1,305` 当前明确不满足 |
| image elements | 7 | 10 | 记录 |
| prompt shell text count | 0 | 0 | 当前硬编码为 0，不能作为真实通过证据 |
| nearest connector distance | - | 约 0.55 px | 当前通过，但脚本容差为 120 px |

已有行为断言：

- prompt 拖动后子图片跟随；
- connector 在本次 fixture 中跟随；
- viewport culling 只渲染局部项目；
- smoke 总耗时约 18.4 s。

现有假绿点：

1. `promptShellTextCount` 由 helper 硬编码为 0，没有真实查询重复 shell 文本。
2. connector endpoint 为空时可直接通过。
3. connector 距离阈值为 120 px，不满足 1.7.0 的 `< 1 px` live geometry 要求。
4. `totalElements` 只记录不失败；缩放态 6,142 已超过 Gate 0 目标 1,305。
5. 本次 API proxy 不可用并出现 localStorage quota 错误，不能外推到完整前后端健康。

Gate 0 Task 14 必须先用故障注入证明这些断言会失败，再优化产品或渲染结构使新预算通过；不得只修改报告数值。

## 7. 启动与布局基线

`verify-startup-runtime-banner-centering` 通过：

| viewport | banner center | usable anchor center | delta |
|---:|---:|---:|---:|
| 1,600 px | 718.0 px | 717.5 px | 0.5 px |
| 1,280 px | 558.0 px | 557.5 px | 0.5 px |

可见文案为“工作区已可用，正在完成后台预热…”。这证明当前浏览器启动 banner 的局部居中，不证明 Gate 2 Dock/Composer/Task Center 的新布局。

## 8. Local Runner 基线

Local Runner TypeScript 与 22/22 Node tests 通过，总测试约 1.93 s。覆盖：

- oversized JSON、loopback Origin/Host、private/unregistered target 拒绝；
- secret/prompt/query redaction；
- pinned executable 与默认禁用 provider runtime；
- local authentication、OAuth secret-free projection；
- LocalToken 强随机持久化与写入失败 fail closed；
- paired runtime heartbeat/claim/execute/complete 现有 read-only 路径。

这不证明签名 sidecar、自启动、崩溃恢复、Desktop broker 或 mutation fencing；这些属于 Gate 1/3。

## 9. Windows 启动器已知缺陷

现有 dev 日志观察到 repo path 在 PowerShell `-File` 参数处被截断到第一个空格，脚本路径从 `...\KK Studio\...` 退化为 `...\KK`，随后被报告为非 `.ps1` 文件。

源码风险点：

- `scripts/dev/dev-launch.ps1` detached PowerShell；
- 同文件 detached Node/Vite；
- 同文件 API preflight；
- `scripts/release/portable-launch.ps1` Node server path。

现有 unit 只检查脚本文本，不启动真实含空格/中文路径的子进程。Gate 0 Task 2 必须建立实际 argv marker regression。

## 10. AI 执行权进入基线

当前事实：

- `AgentExecutionTargetSchema` 已有 `local-desktop | paired-desktop | cloud`，不得新建第二套枚举。
- Web `AgentRunStore` 的本地 authority 使用负向排除 paired target；本地产生的 cloud Run 理论上可能被浏览器误判为可执行。
- paired runtime v1 只有 lease token/expiry/attempt，缺单调 fencing token、checkpoint 和 authoritative confirmation grant。
- 当前 confirmation 绑定 owner/plan/tool/input/target/Quote 并有 5 分钟 expiry，但仍是客户端 fingerprint + Session metadata projection，不是一次性 server authority。
- Task Center 混合多个 source，并以字符串推断部分 setup error；它不是且不得变成执行真相。

Gate 0 Task 3、5、7、8 必须用 fail-closed shared schema、exact target authority、server fencing 和一次性 grant 消除这些边界。

## 11. 迁移与媒体资源进入基线

当前持久化分散在：

- Canvas localStorage `kk_studio_canvas_state`；
- Asset IndexedDB `kk_studio_db/images`，可选 OPFS 镜像；
- folder handle 独立 IndexedDB；
- 用户目录 `project.json` 与 originals/thumbnails/refs；
- Chat Session localStorage；
- Agent Run owner-scoped localStorage；
- Generation Queue localStorage + IndexedDB projection。

当前没有统一 Workspace Migration Package。用户目录现有加载路径会 consolidate/move legacy 数据，不能用于只读 exporter；Canvas snapshot 会主动清除媒体 URL，因此也不能单独代表 Asset 数据。

当前没有机器门禁证明：

- 1K mixed image/video/audio 只 hydration viewport + overscan；
- 三轮 import/delete 后 JS heap/DOM/GPU 增长 `<= 10%`；
- object URL overwrite/delete/clear/rehydrate 后回落；
- JSZip 大包 preflight、取消和内存峰值；
- migration 中断、幂等、owner mismatch、secret/handle/authority 排除。

这些项目状态均为 `not_observed`，由 Gate 0 Task 10、11、12、15 补齐。

## 12. Gate 0 进入判定

当前 1.6.1 静态门禁与本地浏览器主路径可继续发布，但 Gate 0 尚未通过。必须先关闭以下机器可验证缺口：

1. candidate 版本没有统一 schema/parser；
2. Windows 含空格/中文路径启动缺陷；
3. Web cloud Run authority 误判风险；
4. paired/cloud 缺 server fencing 与一次性 confirmation consumption；
5. 1.6.1 migration package 不存在；
6. capability parity 不是机器真相；
7. 10K DOM/connector/duplicate shell 假绿；
8. mixed-media、内存、GPU 和 object URL 生命周期未观测。

任何一项仍为 `not_observed` 或仅有文档声明，都不能进入 Gate 1。

## 13. 本轮命令与未运行项

已执行：

```text
agents:status direct Node equivalent
architecture:check 33 direct commands
governance:check 12 direct commands
root + architecture + server + tests typecheck equivalents
shared + UI + API client + Web production build equivalents
vitest run tests/benchmark/canvas-performance.test.ts
node scripts/test/verify-large-canvas-10k-smoke.mjs
node scripts/test/verify-startup-runtime-banner-centering.mjs
Local Runner typecheck + 22 tests
```

未执行：

- 完整 `verify:changes`：当前 shell 无系统 npm；本轮先记录进入基线并逐项执行关键等价命令，没有把部分等价执行描述为完整聚合门禁。
- dependency audit、mobile typecheck/build、全部 unit/integration/E2E：Task 0 不修改运行时代码，后续每个 Gate 0 task 先跑 targeted，Task 17 再运行完整门禁。
- PostgreSQL migration、Provider、OAuth、支付、生产 Web、真实 Portable 更新：需要相应服务或发布环境。
- Tauri/WebView2、安装器、签名 updater、Desktop SQLite/CAS：实现尚不存在，状态为 `not_observed`。
