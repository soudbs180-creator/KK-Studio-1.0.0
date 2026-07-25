# KK Studio 团队技术能力提升方案

> 版本：v1.0 | 制定者：资深开发工程师 | 日期：2026-07-25
> 适用范围：KK Studio v1.6.0 全栈开发团队

---

## 一、现状诊断总结

经过对 KK Studio v1.6.0 代码库的全面体检，以下是核心结论：

### 优势领域

| 领域 | 评分 | 说明 |
|------|------|------|
| 架构治理 | ⭐⭐⭐⭐⭐ | 32/32 架构检查 + 12/12 治理检查 100% 通过，业界一流 |
| 类型安全 | ⭐⭐⭐⭐⭐ | 全栈 TypeScript 零类型报错，shared 包 100% 纯 TS 隔离 |
| 测试覆盖 | ⭐⭐⭐⭐⭐ | 571 个测试文件、2,156 项通过，local-runner 14 项安全测试全覆盖 |
| 性能优化 | ⭐⭐⭐⭐⭐ | CanvasMeasurementScheduler 批量调度、SpatialIndex O(1) 查找、10K 节点大画布 0.14-0.30ms 帧渲染 |
| 代码清洁度 | ⭐⭐⭐⭐⭐ | 996 个活跃文件零废弃目录引用、1043 文件物理脱敏零明文 Secret |

### 待提升领域

| 领域 | 评分 | 问题描述 |
|------|------|----------|
| 编码规范文档化 | ⭐⭐ | 缺少显式的团队编码规范文件，约定散落在治理脚本和 AGENTS.md 中 |
| 代码审查流程 | ⭐⭐ | 无标准化 CR Checklist，审查依赖个人经验 |
| 架构决策记录 (ADR) | ⭐ | 设计决策仅出现在 handoff 文件中，缺少结构化 ADR |
| 知识传承体系 | ⭐⭐ | 215 条 session handoff 时间线过长（3273 行），新人难以快速上手 |
| 安全依赖管理 | ⭐⭐⭐ | react-router 存在 1 项高风险漏洞 (GHSA-qwww-vcr4-c8h2) 待修复 |
| 持续集成可视化 | ⭐⭐ | 验证链完整但缺少 CI/CD 流程文档化描述 |

---

## 二、提升路线图

```
Phase 1 (本周): 规范化基础建设
  ├── [P0] 编码规范文档化
  ├── [P0] 代码审查 Checklist
  └── [P0] 安全依赖修复

Phase 2 (2周内): 架构与知识沉淀
  ├── [P1] 架构决策记录 (ADR) 模板与流程
  ├── [P1] 新人入职指南
  └── [P1] Session Handoff 归档优化

Phase 3 (1个月内): 流程自动化与持续改进
  ├── [P2] CI/CD 流程文档化
  ├── [P2] 技术分享机制
  └── [P2] 代码质量度量仪表盘
```

---

## 三、Phase 1: 规范化基础建设（本周）

### 3.1 编码规范文档化

#### 3.1.1 TypeScript 规范

```typescript
// ✅ 正确：清晰的类型命名 + JSDoc
/** OCR 识别结果，包含置信度与边界框 */
interface OcrResult {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

// ❌ 错误：模糊的命名 + 无文档
interface Result {
  t: string;
  c: number;
  b: any;
}
```

**核心原则：**

1. **类型优先**: 禁止使用 `any`（除非有明确注释说明原因）。优先使用 `unknown` + 类型守卫
2. **导出类型**: 跨包共享的类型必须放在 `packages/shared/src/` 中，遵循 DTO 命名惯例（如 `GenerationJobDto`）
3. **接口 vs 类型**: 对象形状用 `interface`，联合/交叉/映射类型用 `type`
4. **泛型命名**: 单字母用描述性前缀，如 `TItem`、`TResponse`，而非裸 `T`
5. **空值处理**: 使用 `??` 而非 `||`，避免 `0`/`''`/`false` 被误判为空

#### 3.1.2 React 组件规范

```tsx
// ✅ 正确：清晰的 props 接口 + 职责单一
interface PromptNodeComponentProps {
  nodeId: string;
  isCanvasTransforming: boolean;
  onHeightChange: (id: string, height: number) => void;
}

export const PromptNodeComponent: React.FC<PromptNodeComponentProps> = ({
  nodeId,
  isCanvasTransforming,
  onHeightChange,
}) => {
  // 组件逻辑
};

// ❌ 错误：props 内联类型 + 职责混杂
export const PromptNode = (props: any) => {
  // 巨型组件，什么都做
};
```

**核心原则：**

1. **Props 接口**: 所有组件必须有显式的 props 接口定义，放在组件文件顶部
2. **单一职责**: 组件不超过 200 行，复杂逻辑抽取为自定义 Hook
3. **命名规范**: 组件用 PascalCase，Hook 用 `use` 前缀，事件处理用 `handle` 前缀
4. **memo 使用**: 纯展示组件默认为 `React.memo`，有复杂计算 props 的配合 `useMemo`/`useCallback`
5. **副作用管理**: 所有 `useEffect` 必须写清楚依赖数组的意图注释

#### 3.1.3 注释规范

本项目已建立**中英文双语注释**惯例，应继续坚持：

```typescript
// 简体中文：在拖拽/缩放期间锁定调度器，忽略所有后续的测量并在锁定瞬间取消待处理测量
static setLocked(locked: boolean) {
  this.isLocked = locked;
  if (locked) {
    this.cancel();
  }
}
```

**格式要求：**
- 公开 API / 类 / 关键方法：`// 简体中文：描述`（注释说明意图，变量名保持英文）
- 复杂算法：使用多行 `/* */` 块注释，描述算法步骤
- TODO/FIXME/HACK: 必须附带负责人和日期，如 `// TODO(yckhw, 2026-08-01): 迁移至 Worker 模式`

#### 3.1.4 文件组织规范

```
apps/web/src/
├── features/          # 功能模块（按业务领域划分）
│   ├── ai-takeover/
│   └── ai-assistant-runtime/
├── canvas/            # 画布引擎（纯逻辑，无 React 依赖）
│   ├── CanvasMeasurementScheduler.ts
│   ├── CanvasSpatialIndex.ts
│   └── canvasCoordinates.ts
├── components/        # 可复用 UI 组件
│   ├── canvas/        # 画布相关组件
│   └── image/         # 图片相关组件
├── context/           # React Context 定义
├── hooks/             # 自定义 Hook
└── pages/             # 页面级组件
```

**规则：**
- `canvas/` 目录文件必须是纯逻辑模块，不依赖 React
- `features/` 按业务领域组织，每个 feature 内部可自包含 components/hooks/context
- `components/` 只放可复用的通用 UI 组件

### 3.2 代码审查 Checklist

实施**强制性代码审查清单**，每次 PR 必须逐项确认：

#### CR-ARCH: 架构合规

- [ ] 修改是否遵循跨层顺序？（`packages/shared` → `services/api` → `apps/web` → tests）
- [ ] 是否引入了对废弃目录（`src/`、`apps/admin/`、`root billing/`）的引用？
- [ ] 类型定义是否放在正确的包中？（DTO 在 shared，UI 类型在 ui）
- [ ] 是否直接在前端引用了后端专属依赖？

#### CR-TYPE: 类型安全

- [ ] 是否避免使用 `any`？如果使用，是否有明确注释说明？
- [ ] `packages/shared` 是否保持纯 TypeScript？（无 React/DOM/Node 专属类型）
- [ ] 新增的 interface/type 是否有清晰的命名和 JSDoc？
- [ ] 空值处理是否使用 `??` 而非 `||`？

#### CR-PERF: 性能

- [ ] 大列表/画布操作是否避免了 O(n²) 复杂度？
- [ ] 是否合理使用了 `useMemo`/`useCallback`/`React.memo`？
- [ ] DOM 读写是否分离？（避免 Layout Thrashing）
- [ ] 是否有不必要的重渲染？

#### CR-SECURITY: 安全

- [ ] 是否引入了新的硬编码密钥/Token/凭据？
- [ ] 敏感数据是否在前端代码中物理脱敏？
- [ ] API 端点是否有适当的权限校验？
- [ ] 用户输入是否有适当的校验和转义？

#### CR-TEST: 测试

- [ ] 新增功能是否包含对应的单元测试？
- [ ] 修改是否导致已有测试失败？
- [ ] 关键路径是否有契约测试覆盖？
- [ ] 是否有边界条件测试（空值、异常、超时）？

#### CR-DOC: 文档

- [ ] 公开 API 是否有清晰的注释？
- [ ] 复杂算法是否有注释说明意图？
- [ ] Session Handoff 是否已追加本次修改记录？
- [ ] 是否需要在架构文档中更新相关内容？

### 3.3 安全依赖修复

当前已知问题：`react-router` 存在 GHSA-qwww-vcr4-c8h2 高风险漏洞。

**立即行动：**
```bash
# 升级 react-router 至修复版本
npm update react-router@^8.3.0

# 验证无破坏性变更
npm run typecheck
npm run test
npm run build
```

---

## 四、Phase 2: 架构与知识沉淀（2周内）

### 4.1 架构决策记录 (ADR)

在 `docs/adr/` 目录下建立结构化 ADR，模板如下：

```markdown
# ADR-NNN: [决策标题]

- **状态**: [proposed | accepted | deprecated | superseded]
- **日期**: YYYY-MM-DD
- **决策者**: [姓名]
- **相关**: [关联的 ADR 编号]

## 背景

描述需要做架构决策的业务场景和技术约束。

## 决策

描述我们选择了什么方案，以及为什么。

## 备选方案

| 方案 | 优点 | 缺点 | 为何不选 |
|------|------|------|----------|
| A    |      |      |          |
| B    |      |      |          |

## 影响

- 正面影响：
- 负面影响：
- 迁移路径（如有）：

## 相关证据

- 测试结果 / 性能 Benchmark
- 参考实现或相关资料
```

**已有关键决策中值得补充 ADR 的主题（从 session handoff 提取）：**

| 编号 | 决策主题 | 来源 |
|------|----------|------|
| ADR-001 | CanvasMeasurementScheduler 批量读写分离架构 | Session #10 |
| ADR-002 | O(n²)→O(1) 画布节点查找优化 | Session #8-9 |
| ADR-003 | Generation v3 Quote → Job → Billing 链路设计 | Phase 1 |
| ADR-004 | Capability Graph 与 Provider Connection 解耦 | Phase 2 |
| ADR-005 | Agent Run 权威源上移至 VPS 的架构决策 | Phase 3+ |

### 4.2 新人入职指南

创建 `docs/onboarding/QUICK_START.md`：

```markdown
# KK Studio 新人入职指南

## 第一天：环境搭建
1. 克隆仓库并安装依赖：`npm install`
2. 确认 Node 24.x 环境
3. 运行 `npm run governance:current` 确认环境正确
4. 运行 `npm run typecheck && npm run build` 确认编译正常

## 第一周：代码库认知
1. 阅读 `AGENTS.md`（必读！）
2. 阅读 `docs/governance/PROJECT_STATE_AND_VALIDATION.md`
3. 阅读 `docs/governance/PRODUCT_CORE_CHARTER.md`
4. 浏览 `docs/adr/`（架构决策记录）
5. 完成一个小型 Bug 修复来熟悉提交流程

## 关键架构概念（按学习顺序）
1. **Monorepo 结构**: packages/ → apps/web → services/api
2. **数据流**: DTO (shared) → API Client → Server → React State
3. **画布引擎**: CanvasMeasurementScheduler → SpatialIndex → Virtualization
4. **AI 能力**: IntentGate → Planner → ToolRegistry → RouteEngine → Provider
5. **安全边界**: 密钥只存在于 VPS，前端只持有投影

## 提交流程
1. 创建 feature 分支
2. 编码并自测（运行 `npm run test:unit` 验证）
3. 运行 `npm run architecture:check` 确认架构合规
4. 追加 session handoff 记录
5. 提交 PR 并通过 CR Checklist
6. 合并后运行 `npm run agents:commit` 同步状态
```

### 4.3 Session Handoff 归档优化

当前 `session-handoff.md` 已累积 215 条记录（3273 行），虽然提供了完整的历史追溯，但长度已超出日常使用效率。

**优化方案：**

1. **按月归档**: 将 30 天前的记录按月份归档到 `docs/archive/sessions/YYYY-MM.md`
2. **保留摘要索引**: 在主 handoff 文件顶部添加按月的决策关键词语法索引
3. **当前文件只保留最近 30 天的详细记录**

具体执行：
```bash
# 脚本化归档（创建 scripts/maintenance/archive-session-handoff.mjs）
npm run archive:handoff
```

---

## 五、Phase 3: 流程自动化与持续改进（1个月内）

### 5.1 CI/CD 流程文档化

在 `docs/ci/` 下创建 CI/CD 流程图和验证链说明：

```
开发者提交 PR
    │
    ▼
┌─────────────────────────────┐
│ 1. typecheck                │ ◄── TypeScript 类型检查
│ 2. architecture:check (32)  │ ◄── 架构边界合规
│ 3. governance:check (12)    │ ◄── 治理规则校验
│ 4. test (2156+ tests)       │ ◄── 自动化测试套件
│ 5. build                    │ ◄── 生产构建验证
│ 6. audit:dependencies       │ ◄── 安全依赖审计
└─────────────────────────────┘
    │
    ▼
 全部通过 → 允许合并
```

### 5.2 技术分享机制

建立双周技术分享制度：

| 周次 | 主题类型 | 示例 |
|------|----------|------|
| 第1周 | 架构深入 | Canvas 虚拟化渲染原理、Agent 执行协议剖析 |
| 第3周 | 工程实践 | 从 session handoff 中提取的性能优化案例分析 |
| 第5周 | 外部技术 | Web Worker 在画布计算中的应用、Edge Computing 趋势 |
| 第7周 | 代码审查回顾 | 过去一个月最佳 CR 评论精选 |

分享记录归档在 `docs/tech-talks/`。

### 5.3 代码质量度量仪表盘

建议引入以下度量指标，纳入日常开发流程：

| 指标 | 当前基线 | 目标 | 监控方式 |
|------|----------|------|----------|
| TypeScript 严格模式覆盖率 | 100% | 保持 | `tsc --noEmit` |
| 架构边界合规率 | 32/32 | 保持 | `architecture:check` |
| 测试用例通过率 | 99.86% | 保持 ≥99% | `npm run test` |
| 大画布渲染性能 | 0.14-0.30ms | <1ms/帧 | `verify:canvas-performance` |
| 废弃引用数 | 0 | 保持 0 | `architecture:check` |
| 明文 Secret 数 | 0 | 保持 0 | `governance:security` |
| Session Handoff 遗漏率 | — | ≤5% | 人工审查 |

---

## 六、技能树建议

根据 KK Studio 当前技术栈，建议团队成员按以下路径提升：

### 初级 → 中级

1. **TypeScript 高级类型**: 条件类型、模板字面量类型、映射类型实战
2. **React 性能优化**: Profiler 使用、渲染优化、React 19 新特性
3. **前端测试**: 从单元测试到契约测试的完整方法论
4. **Canvas API**: 2D Context、requestAnimationFrame、离屏渲染

### 中级 → 高级

1. **Monorepo 架构**: pnpm workspace、依赖管理策略、跨包类型安全
2. **性能分析**: Chrome DevTools Performance Panel、Layout Thrashing 识别与修复
3. **状态管理架构**: Context vs Zustand vs Jotai 的选型分析
4. **Node.js 后端**: Express 中间件设计、数据库迁移策略、事务处理

### 高级 → 资深

1. **架构设计**: 领域驱动设计 (DDD)、事件驱动架构、CQRS 模式
2. **分布式系统**: 幂等设计、消息队列、最终一致性
3. **安全架构**: API Key 管理、RBAC、SSRF 防护、Secret 脱敏设计
4. **AI 工程化**: LLM Agent 协议设计、Tool 注册与路由、Prompt 工程

---

## 七、执行跟踪

| 编号 | 行动项 | 负责人 | 截止日期 | 状态 |
|------|--------|--------|----------|------|
| A1 | 完成编码规范文档 | 待分配 | T+3天 | ⬜ |
| A2 | 实施 CR Checklist | 待分配 | T+3天 | ⬜ |
| A3 | 修复 react-router 安全漏洞 | 待分配 | T+1天 | ⬜ |
| A4 | 创建首批 ADR（5篇） | 待分配 | T+7天 | ⬜ |
| A5 | 编写新人入职指南 | 待分配 | T+7天 | ⬜ |
| A6 | Session Handoff 按月归档 | 待分配 | T+14天 | ⬜ |
| A7 | CI/CD 流程图文档化 | 待分配 | T+21天 | ⬜ |
| A8 | 组织首次技术分享 | 待分配 | T+14天 | ⬜ |

---

## 八、附录

### A. 关键参考文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| 项目总指导 | `AGENTS.md` | 所有 Agent 和开发者的第一参考 |
| 项目状态与验证 | `docs/governance/PROJECT_STATE_AND_VALIDATION.md` | 当前架构事实与验证入口 |
| 产品核心宪章 | `docs/governance/PRODUCT_CORE_CHARTER.md` | 产品方向和不可妥协的原则 |
| 源码能力矩阵 | `docs/governance/SOURCE_CAPABILITY_MATRIX.md` | 全栈能力覆盖与证据坐标 |
| 文档索引 | `docs/governance/DOCUMENTATION_INDEX.md` | 262 份规范文档索引 |
| Session 交接 | `docs/development/session-handoff.md` | 所有修改的完整历史记录 |
| 当前升级计划 | `openspec/changes/upgrade-ai-creation-core/` | 活动升级任务跟踪 |

### B. 推荐外部学习资源

1. **[TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)** — TypeScript 深入指南
2. **[React Performance Optimization](https://react.dev/learn/escape-hatches)** — React 官方性能优化章节
3. **[Web Performance 101](https://web.dev/learn/performance)** — Google Web 性能最佳实践
4. **[Canvas API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)** — Canvas 官方教程
