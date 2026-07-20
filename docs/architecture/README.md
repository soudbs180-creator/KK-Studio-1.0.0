Status: reference

# 核心架构规范 (docs/architecture/README.md)

本目录定义了 KK Studio 的 **底层架构分层、模块所有权边界、数据库物理与逻辑拓扑结构、多设备 UI 适配规范以及模型路由器适配器协议**。这是项目逻辑的核心物理框架。

## 📁 目录文件清单

1. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) —— 项目职责划分**
   - **职责**：定义 `apps/web/`、`apps/mobile/`、`packages/shared/`、`packages/api-client/`、`packages/ui/` 和 `server/` 的物理职责边界。提供本地与云端 API 的升级路径。
   - **适用场景**：重构组件依赖关系、定义新的跨端 DTO 时。

2. **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) —— VPS 数据库表结构**
   - **职责**：VPS PostgreSQL 自建运行时的数据库表物理设计（含 `profiles`、`user_credits`、`credit_transactions`、`admin_credit_models` 等）。
   - **适用场景**：执行数据库表结构的增量迁移（编写 `migrations/` 中的 SQL）。

3. **[DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md) —— 数据库访问与计费原则**
   - **职责**：规范数据访问代理、充值扣费一致性。规定任务失败时必须在服务端执行退款交易审计并回滚余额。
   - **适用场景**：编写或修改模型生成接口、积分变动事务代码。

4. **[DEVICE_UI_ARCHITECTURE.md](DEVICE_UI_ARCHITECTURE.md) —— 多端 UI 分层规范**
   - **职责**：规范 React Web 端和 Expo (React Native) 移动端的 UI 界面拆分、共享逻辑设计（采用 React Context 与设备路由分层机制）。
   - **适用场景**：开发复杂的新组件，或修改需要在手机和桌面端展示不同版面的 UI。

5. **[ADAPTER_ROUTING.md](ADAPTER_ROUTING.md) —— 模型适配器路由协议**
   - **职责**：详细定义 Google 官方原生接口协议与 OpenAI 兼容适配器（包括 SiliconFlow, gpt-best 等第三方中转和本地代理）之间的路由逻辑与参数映射。
   - **适用场景**：新增大模型对接、修改图片长宽比及分辨率参数时。

6. **[DESIGN.md](DESIGN.md) —— 画布优先的工作台视觉规范**
   - **职责**：规定安静、低对比度、语义 Token 驱动的浅色/深色工作台，以及不阻断画布的 AI 计划、任务和验证布局。
   - **适用场景**：界面重构、基础组件迁移、响应式和无障碍验收。

7. **[ACTIVE_UI_SURFACES.md](ACTIVE_UI_SURFACES.md)**, **[CANONICAL_DATA_REGISTRY.md](CANONICAL_DATA_REGISTRY.md)**, **[VISIBILITY_MATRIX.md](VISIBILITY_MATRIX.md)**
   - **职责**：活动界面、数据类型注册表与渲染矩阵的架构定义。

## 🏛️ 架构铁律

- **完全隔离**：`packages/shared/` 内绝对严禁引入平台专有（如 DOM, RN, Node）的 API。
- **VPS 后端是唯一计费权威**：所有的计费、余额判定及退款必须在 `server/` 端闭环，前端绝不能拥有积分余额的修改权。
