# Gemini Coding Agent 对照指南

本文档用于把 Google 官方的 Gemini coding agent 指南，映射到 KK Studio 当前的实现方式上。

适用场景：
- 修改 Google 官方 Gemini 通道
- 修改 Gemini 原生协议与 OpenAI 兼容协议的路由逻辑
- 调整图片、视频、聊天、多模态请求结构
- 新增 Gemini Live / Interactions 相关能力前的方案评估

---

## 为什么这份文档对本项目有用

KK Studio 不是单一的 Gemini SDK Demo，而是一个同时支持以下路线的多通道项目：
- Google 官方 Gemini 协议
- OpenAI 兼容代理协议
- Claude 兼容协议
- 多供应商图片/视频模型路由

这种项目最容易出现的问题不是“不会调 API”，而是：
- 把 Google 官方字段错误发到 OpenAI 兼容通道
- 把 OpenAI 风格鉴权错误套到 Gemini 原生接口
- 在图片、视频、聊天之间复用错误的端点
- 让 AI 助手根据过期知识写出旧 SDK 或旧请求格式

Google 的 coding agent 指南和 `gemini-api-dev` skill，刚好就是为这种问题准备的。

---

## 当前项目里的 Gemini 代码落点

修改 Gemini 相关能力时，优先从这些文件判断职责，不要跨层随意补逻辑：

- `apps/web/src/services/api/providerStrategy.ts`
  负责供应商识别、协议家族选择、鉴权方式与 header/query 规则。

- `apps/web/src/services/api/connectionTest.ts`
  负责低成本验证连接是否走对协议，避免在测试阶段误触发计费型图片/视频任务。

- `apps/web/src/services/llm/providerAdapterRouter.ts`
  负责 Web 侧 Provider adapter 路由，不创建平行的 Gemini 专用入口。

- `server/lib/dispatcher/providerProfiles.js`
  负责 Google、Gemini 及兼容渠道的服务端画像事实。

- `server/lib/dispatcher/adapters/`
  负责服务端 Provider 执行、错误归一化和受保护凭据传输。

- `src/hooks/useImageGeneration.ts`
  负责 UI 层任务状态、成本、恢复与卡片数据拼装。

---

## 修改时的官方对齐原则

### 1. Google 官方通道，以官方 Gemini 协议为准

当供应商属于 Google 官方通道时：
- 模型列表优先对齐 `/v1beta/models`
- Gemini 文本/多模态生成优先对齐 `:generateContent`
- Imagen / Veo 这类模型优先对齐 `:predict` 或其官方长任务接口
- 鉴权优先对齐 `?key=` 或 `x-goog-api-key`

不要把 OpenAI 兼容格式误当成 Google 官方事实来源。

### 2. OpenAI 兼容通道，不发送 Google 专有字段

当请求走 OpenAI 兼容或代理通道时：
- 不要发送 `generationConfig.imageConfig`
- 不要发送 `responseModalities`
- 不要假设支持 `/v1beta/models/{model}:generateContent`
- 不要把 Google 的模型列表接口硬套给兼容供应商

是否走 Gemini 原生协议还是 OpenAI 兼容协议，先看 `providerStrategy.ts` 的运行时解析结果。

### 3. 协议判断优先看运行时，不靠模型名猜

本项目已经把“供应商识别 + 协议家族 + 鉴权方式”拆开了。
做 Gemini 相关修改时，优先复用既有运行时解析，而不是在业务层重复写：
- `if model.startsWith('gemini-')`
- `if baseUrl.includes('google')`
- `if provider === 'Google'`

模型名只能作为提示，不能代替协议解析。

### 4. 错误处理与体验文案，不要反向定义协议

`geminiService.ts` 里有大量错误归一化和用户提示，这些很重要，但它们应该建立在正确协议之上。

做法应该是：
1. 先确认端点、鉴权、请求体是对的
2. 再补错误映射、重试、fallback、提示文案

不要为了“让报错好看”去绕过协议事实。

### 5. 新增 Live / Interactions 能力前，先查官方最新方案

如果后续你要在 KK Studio 里加：
- 实时语音/视频输入
- 更强的 agent/tool calling
- 后台任务或多轮状态编排

不要直接在现有 `GoogleAdapter` 或 `GeminiNativeAdapter` 上堆字段。

建议顺序：
1. 先查官方 Gemini 文档或 `gemini-live-api-dev`
2. 评估是否应该新增独立 adapter / service
3. 最后再接入 UI 和任务编排

这样可以避免把实时链路和现有图片/聊天链路耦死。

---

## 对本项目最直接的帮助

结合 KK Studio 当前架构，这套官方 guidance 最直接能帮到你 4 件事：

1. 减少 AI 助手改坏 Gemini 路由
   这类仓库最怕助手把 Google 官方协议、代理协议、OpenAI 兼容协议混写。

2. 降低 Gemini 升级时的过时实现风险
   例如 SDK 名称、推荐接口、模型调用方式更新后，助手更容易跟上官方做法。

3. 给后续加 Live / Interactions 能力打基础
   现在你已经有聊天与多模态基础，后续往实时或 agent 能力扩展时，这份规则会很值钱。

4. 让连接测试、生成调用、UI 状态三层职责更稳定
   这能减少“为了修一个 Gemini 问题，顺手把其他供应商链路带崩”的概率。

---

## 推荐工作方式

以后凡是涉及 Gemini 相关改动，建议按下面顺序做：

1. 先判断本次改动落在哪一层
   是 `providerStrategy`、`connectionTest`、adapter，还是 UI 编排层。

2. 先判断当前请求走的是哪种协议
   Google 官方 Gemini、OpenAI 兼容、Claude 兼容，还是特定代理。

3. 只在协议层定义协议事实
   端点、header、query、payload 结构放在适合的 adapter / api 层。

4. 再在编排层补体验
   fallback、错误归一化、恢复、卡片展示、成本信息放在 service / hook 层。

5. 最后做低成本验证
   优先复用 `connectionTest.ts` 的思路验证路由和鉴权，再跑全量构建。

---

## 官方参考

- Google 文档：<https://ai.google.dev/gemini-api/docs/coding-agents>
- GitHub：<https://github.com/google-gemini/gemini-skills>
- 推荐 skill：`gemini-api-dev`

当前仓库若仅围绕现有聊天、图片、视频与多通道代理开发，默认优先使用 `gemini-api-dev` 即可。
