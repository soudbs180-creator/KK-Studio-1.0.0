# 增加新 AI 助手 Tool 规约 (add-new-agent-tool)

- **适用场景**: 开发人员或助手在系统中开发和挂载新 API / 动作能力。
- **调用工具**:
  - `skills.upsertSkill`
- **步骤**:
  1. 在 `apps/web/src/features/ai-assistant-runtime/tools/` 目录下按命名空间（如 `canvasTools.ts`）新增 Tool 定义。
  2. 在 Tool 定义中配置 `name`, `description`, `permission`（`safe` / `confirm` / `dangerous` / `forbidden`）及 `inputSchema`。
  3. 通过 `ToolRegistry.ts` 对其进行集中注册。
  4. 为该 Tool 在 `docs/ai-assistant/skills/` 下同步编写对应的可执行 Skill 规约。
  5. 运行 `npm run governance:skills` 校验 Tool 声明与 Skill 规约的一致性。
