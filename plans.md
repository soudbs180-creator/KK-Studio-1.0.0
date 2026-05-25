# 项目收敛计划 (plans.md)

本文件是 AGENTS 明确规定的根目录例外文件。记录项目收敛架构的总体规划。

## 收敛目标
根据严格 AGENTS 路线，将整个项目收敛为：
- `apps/web`：桌面端前端 (Vite + React + TS)
- `apps/mobile`：手机端前端 (Expo Managed + expo-router)
- `packages/shared`：两端共用包 (包含原 contracts 与 domain)
- `packages/api-client`：唯一前端 HTTP 出口
- `packages/ui`：跨端设计令牌基础 UI 包
- `netlify/functions`：无服务器短任务后端 API
- `payment-server`：仅处理 Stripe 支付 webhook 例外
- `migrations`：数据库迁移
- `scripts`：构建与 CI 脚本
- `docs`：中文规范文档
- `config`：配置目录 (包含 config/deploy)
- `tests`：测试用例
- `.claude`：Claude Agent 配置

## 里程碑划分
1. 治理与文档基线：创建根目录例外文件，修正治理及一致性脚本。
2. 目录与包结构收敛：清理过渡目录，合并 contracts/domain 进 shared，补齐 ui 工作区。
3. Netlify 后端 API 中转：编写 netlify/functions 下的 6 个 API 端点。
4. 数据库与支付安全：服务端计费与限流硬化，防御前端额度篡改。
5. 前端安全重构：彻底移除前端直连、浏览器 API 密钥，改由 api-client 请求后端。
6. 测试与验证路径迁移：修复 430+ 个测试对 src 的依赖，建立路径映射支持。
7. 移动端补齐：初始化 Expo 最小应用，安全存储 token。
