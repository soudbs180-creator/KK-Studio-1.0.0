# AI 代理快速入口

本文档用于让 AI 代理在最短时间内决定：
- 先读哪个规则文件
- 当前任务属于哪一类
- 改动后需要跑哪些验证

如果你是第一次进入这个仓库，建议优先按下面顺序阅读。

---

## 30 秒阅读顺序

1. 先读 [README.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/README.md)
   - 了解项目基线、版本源文件、推荐验证命令
2. 再读 [SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/SKILL.md)
   - 了解总纲约束、通用硬规则、专项文件入口
3. 按任务类型跳到专项文件
   - Cadence SKILL： [cadence-skill/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/cadence-skill/SKILL.md)
   - 供应商路由： [vendor-routing/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/vendor-routing/SKILL.md)
4. 涉及 Gemini 官方协议时，再读 `docs/development/gemini-agent-guide.md`

---

## 遇到什么任务先看哪个文件

- 改 UI、交互、动效、颜色、布局：
  - 先看 [SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/SKILL.md)
- 输出 Cadence Virtuoso / CIW / OA 数据库脚本：
  - 先看 [cadence-skill/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/cadence-skill/SKILL.md)
- 改 `12AI`、`GPT Best`、`New Suxi AI`、多协议代理、模型探测、图片路由：
  - 先看 [vendor-routing/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/vendor-routing/SKILL.md)
- 改 Gemini 官方通道、Imagen、Veo、Gemini Native：
  - 先看 [SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/SKILL.md)
  - 再看 `docs/development/gemini-agent-guide.md`
- 改版本号、说明文档、项目基线：
  - 先看 [README.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/README.md)
  - 再看 [SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/SKILL.md)

---

## 最小执行清单

开始改动前：
- 确认任务类型属于哪一类
- 只读取相关专项文件，不要把所有规则全文都重新读一遍
- 如果任务涉及协议、计费、存储、支付、Supabase，默认检查前后端两侧
- 在 Windows PowerShell 读取中文规则文件时，优先使用 UTF-8 读取方式，避免 `cp936` 会话把 UTF-8 文本误显示成乱码

改动完成后：
- 默认跑 `npm run check:encoding`
- 代码改动默认跑 `npm run typecheck`
- 需要时跑 `npm run build`
- 文档或规则改动后，跑 `npm run governance:agent-docs`

---

## 不要这样做

- 不要把总纲当成唯一规则来源，忽略专项文件
- 不要把供应商路由规则和 Cadence 脚本规则混在一起理解
- 不要只改代码不改文档
- 不要只改文档不校验入口和版本一致性

---

## 快速判断

如果任务里出现这些关键词，优先跳专项：
- `CIW`、`Virtuoso`、`OA`、`layout script`、`SKILL`
  - 跳 [cadence-skill/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/cadence-skill/SKILL.md)
- `12AI`、`GPT Best`、`Suxi`、`Responses`、`Claude Native`、`Async Image`
  - 跳 [vendor-routing/SKILL.md](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/.agent/rules/skills/vendor-routing/SKILL.md)

---

## 一句话原则

先选对规则文件，再开始改代码。
