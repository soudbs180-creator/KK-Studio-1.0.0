# AGENTS

本文件是仓库级 AI 代理总入口。

如果你是第一次进入此仓库，开始任何实质性改动前，按下面顺序阅读：

1. [AI 代理快速入口](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/AGENT-QUICKSTART.md)
2. [.agent 说明](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/README.md)
3. [总纲规则](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/SKILL.md)

按任务类型继续下钻：
- Cadence Virtuoso / CIW / OA 数据库 / SKILL 脚本：
  - 读 [cadence-skill/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/cadence-skill/SKILL.md)
- `12AI`、`GPT Best`、`New Suxi AI`、多协议代理、模型探测、协议回退：
  - 读 [vendor-routing/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/vendor-routing/SKILL.md)
- Gemini 官方协议、Imagen、Veo、Gemini Native：
  - 先读 [总纲规则](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/SKILL.md)
  - 再读 `docs/development/gemini-agent-guide.md`

执行要求：
- 涉及代码改动时，默认跑 `npm run typecheck`
- 涉及文档 / 规则改动时，默认跑 `npm run governance:agent-docs`
- 所有改动完成后，至少跑 `npm run check:encoding`

一句话原则：
- 先选对规则文件，再开始改代码。
