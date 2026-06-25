---
name: diagnostics-and-debugging
description: 错误快速定位与排障自愈技能，在遇到编译错误（typecheck）、架构边界审查异常（UI Token、z-index、物理层级越界）、编码格式校验失败、或者运行期服务崩溃时，使用此技能快速定位到错误原因并执行自愈修复。
---

# 错误快速定位与排障自愈 Skill (diagnostics-and-debugging)

- **适用场景**: 发生静态类型报错、AST 架构边界校验阻断、版本事实冲突熔断、或是物理运行时拒绝启动。
- **前置条件**: 已阅读 `docs/governance/DIAGNOSTICS_AND_DEBUGGING.md` 中定义的排错逻辑。
- **执行步骤**:
  1. **运行静态校验**: 根据问题表象运行 `npm run architecture:check` 或 `npm run governance:check` 截获具体的异常错误。
  2. **快速排障定位**: 
     - *UI Token 校验失败*: 将内联硬编码颜色替换为 `packages/ui` 色彩 Token；若属于特例（如品牌 Logo 填充、Canvas 2D 绘图），在行尾追加 `// UI_TOKEN_EXCEPTION` 注释通过。
     - *Skills 规约校验失效*: 当 ToolRegistry 中有新增的 `confirm` / `dangerous` 工具时，自动在 `docs/ai-assistant/skills.md` 中补充引用说明。
     - *便携包哈希不一致*: 临时指定远程 API（如 `VITE_KK_API_BASE_URL`）并运行 `npm run package:portable` 和 `npm run publish:portable` 重新生成打包与哈希签名。
     - *Node / 换行乱码报错*: 使用 `UTF-8 without BOM` + `LF` 格式重新保存该文件，运行 `npm run check:encoding` 闭环。
  3. **成果提交**: 排错完成后，在 `docs/development/session-handoff.md` 末尾追加交接记录，并运行 `npm run agents:commit` 将工作成果固化为本地 Git 提交。
