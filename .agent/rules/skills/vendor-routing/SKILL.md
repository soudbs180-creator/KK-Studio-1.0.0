---
trigger: glob
description: 供应商路由专项规则，覆盖 12AI、GPT Best、New Suxi AI 的协议面、鉴权、探测与回退约束
---

# 供应商路由专项规则

本文档用于约束多供应商、多协议代理场景下的路由判断。
当任务涉及 `12AI`、`GPT Best`、`New Suxi AI`、`OpenAI / Gemini / Claude` 多协议代理时，本文件优先于总纲中的简版摘要。

---

## 适用范围

- 多供应商模型路由
- 同一供应商同时暴露 OpenAI / Gemini / Claude 协议面
- 供应商专属图片 / 视频 / 异步任务链路
- 连通性探测、模型列表探测、协议回退判断

---

## 使用原则

- 先识别供应商，再决定协议面。
- 不得因为模型名相似就跨供应商复用请求格式。
- 不得把供应商专属图片接口降级成泛化的 `/v1/images/generations` 假设。
- 只有文档明确存在的协议面才能写进实现；未核实的端点不要猜。
- 涉及供应商路由时，必须同时交叉检查：
  - `src/services/api/providerStrategy.ts`
  - `src/services/api/connectionTest.ts`
  - `src/services/llm/OpenAICompatibleAdapter.ts`

---

## 总体路由规则

- 先用 `providerStrategy` 识别供应商，再选择 `openai` / `gemini` / `claude` 协议面。
- 同一供应商的不同协议面必须分别处理，不得混成“普通 OpenAI 兼容”。
- 对 live docs 与本仓库实现不一致的地方，先标记 drift，再改代码；不要把仓库现状写成供应商事实。

---

## 实现文件映射

- `src/services/api/providerStrategy.ts`
  - 供应商识别
  - `supportedFormats`
  - 默认鉴权方式
  - 默认兼容模式
- `src/services/api/connectionTest.ts`
  - 低成本连通性验证
  - `/v1/models` 探测
  - 按协议面的最小请求探针
- `src/services/llm/OpenAICompatibleAdapter.ts`
  - 图片路由
  - Chat / Images 兼容层分流
  - 高风险回退控制
- `src/services/auth/keyManager.ts`
  - 渠道预设
  - provider 名与 slot 默认值
  - 兼容模式落库/回填
- `src/services/system/RegionService.ts`
  - 12AI 默认 base URL
  - 区域相关网关选择
- `src/services/api/openaiResponses.ts`
  - Responses API 偏好模型判定
  - Chat / Responses 切换策略

---

## 常见改动入口

- 新增供应商识别规则：
  - 先改 `providerStrategy.ts`
  - 再补 `connectionTest.ts`
  - 最后检查 `keyManager.ts` 预设是否需要同步
- 修正图片路由：
  - 先看 `OpenAICompatibleAdapter.ts`
  - 再看 `providerStrategy.ts` 的 `imageProfile` / `compatibilityMode`
- 修正模型列表探测：
  - 先看 `connectionTest.ts`
  - 再确认 `providerStrategy.ts` 的协议家族是否选对
- 修正 12AI 默认网关：
  - 先看 `RegionService.ts`
  - 再检查 12AI 在 `providerStrategy.ts` 的 host/basePatterns
- 修正 Responses 偏好模型：
  - 先看 `openaiResponses.ts`
  - 再检查 `connectionTest.ts` 和实际调用层是否一致

---

## 供应商识别顺序

1. 先看显式 provider 名称
2. 再看 base URL / host 命中规则
3. 最后再根据模型能力面做保守推断

优先避免：
- 因模型名里出现 `gemini`、`claude`、`gpt-image` 就误判供应商
- 因为是“兼容 OpenAI”就忽略供应商自己的多协议结构

---

## 12AI

### 12AI 识别条件
- 供应商名：`12AI`
- 常见域名：`cdn.12ai.org`、`new.12ai.org`、`hk.12ai.org`
- 本仓库默认基线由 `RegionService.get12AIBaseUrl()` 决定，但协议面仍要按文档拆开。

### 12AI 支持的协议面
- OpenAI Chat：`POST /v1/chat/completions`
- Claude Native：`POST /v1/messages`
- Gemini Native：`POST /v1beta/models/{model}:generateContent`
- Async Image：`POST /v1/images/async/generations`
- Async Image 查询：`GET /v1/images/async/generations/{task_id}`

### 12AI OpenAI Chat
- 鉴权：`Authorization: Bearer <API_KEY>`
- 端点：`POST {baseUrl}/v1/chat/completions`
- 仅用于 OpenAI Chat 兼容调用，不发送 Gemini 原生字段。

### 12AI Claude Native
- 鉴权：`Authorization: Bearer <API_KEY>`
- 必带头：`anthropic-version: 2023-06-01`
- 端点：`POST {baseUrl}/v1/messages`
- 文档提到 `x-api-key` 可选，但主示例是 Bearer；实现时以当前 live doc 为准。

### 12AI Gemini Native
- 鉴权：查询串 `?key=<API_KEY>`
- 端点：`POST {baseUrl}/v1beta/models/{model}:generateContent`
- 流式端点：`POST {baseUrl}/v1beta/models/{model}:streamGenerateContent?alt=sse&key=<API_KEY>`
- 仅在这个协议面发送：
  - `contents`
  - `system_instruction`
  - `tools`
  - `generationConfig`
  - `responseModalities`
  - `imageConfig`
- 多模态上传规则：
  - 图片、音频、视频、PDF 只支持 `inline_data` 的 base64 方式
  - 不支持 `file_data.file_uri` 或 File API
- 文档页存在字段命名混用：
  - 参数表和部分说明偏向 camelCase
  - 示例代码里也能看到 `inline_data`、`system_instruction`
- 改代码前必须对齐当前目标端点页面，不要跨示例混写字段名。

### 12AI Async Image
- 鉴权：`Authorization: Bearer <API_KEY>`
- 提交任务：`POST {baseUrl}/v1/images/async/generations`
- 查询任务：`GET {baseUrl}/v1/images/async/generations/{task_id}`
- 请求体关键字段：
  - `model`
  - `prompt`
  - `n`
  - `size`
  - `quality`
  - `image` 或 `images` 用于参考图
- 这是“提交任务 + 轮询结果”的异步链路，不是同步 Images API。

### 12AI 已知 drift 与实现注意事项
- 不要把 12AI Gemini Native 误写成 Bearer header + `/v1/chat/completions`
- 不要把 12AI Async Image 误写成同步 `/v1/images/generations`
- 不要把 Gemini 原生字段发到 12AI OpenAI Chat / Claude Messages

---

## GPT Best

### GPT Best 识别条件
- provider 名常见写法：`gpt-best`、`gpt best`、`gptbest`
- Base URL 以用户工作台或站点域名为准，不写死单一 host

### GPT Best Base URL 与鉴权
- 文档没有固定单一域名；`BaseURL` 以用户工作台或站点域名为准。
- 已确认鉴权方式：`Authorization: Bearer <API_KEY>`
- 当前已抓到的 live docs 没有证据支持 `?key=` 查询串鉴权。

### GPT Best Models 列表
- 端点：`GET {BASE_URL}/v1/models`
- 返回项包含 `supported_endpoint_types`
- 路由时必须尊重模型级能力面，不要默认所有模型同时支持 chat / image / video。

### GPT Best OpenAI Chat
- 文档明确写“所有对话模型均兼容 OpenAI 格式”
- 端点：`POST {BASE_URL}/v1/chat/completions`
- 鉴权：`Authorization: Bearer <API_KEY>`
- 请求体按标准 OpenAI Chat Completions 处理，不要混入 GPT Best 本地适配经验字段。

### GPT Best Claude 官方格式
- 文档确认“所有 OpenAI 格式 LLM 模型均支持 Claude 官方格式”
- 但当前已核实页面没有给出具体 endpoint / payload 示例
- 在实现前必须继续抓对应 API 明细页，不要主观套成某个固定 Claude endpoint。

### GPT Best 图片 / 视频 / 平台 API
- 文档索引显示其图片、视频、Kling、Fal.ai、Replicate、平台 API 等均为独立家族。
- 对 GPT Best 的图片或视频调用，不要默认走 `/v1/chat/completions`。
- `/v1/models` 的 `supported_endpoint_types` 应作为首选判定依据。

### GPT Best 已知 drift 与实现注意事项
- `providerStrategy.ts` 旧逻辑曾把 `gpt-best` 强制成 `query` 鉴权；live docs 已确认 Bearer 更可信。
- `OpenAICompatibleAdapter.ts` 里的 `gpt-best-extended` 图片参数和模型后缀映射属于本仓库本地适配经验，不应写成“GPT Best 官方统一契约”。

---

## New Suxi AI

### New Suxi AI 识别条件
- Base URL：`https://new.suxi.ai`
- provider 名常见写法：`suxi`、`new suxi`、`new-suxi-ai`

### New Suxi AI Base URL 与鉴权
- OpenAI 兼容面鉴权：`Authorization: Bearer <API_KEY>`
- 不能把它降级成 generic OpenAI-compatible，因为它同时公开了多套协议面。

### New Suxi AI Models 列表
- 端点：`GET https://new.suxi.ai/v1/models`
- 路由前优先拉模型列表，再决定 Chat / Responses / Claude / Gemini 图片面。

### New Suxi AI OpenAI Chat
- 端点：`POST https://new.suxi.ai/v1/chat/completions`
- 鉴权：`Authorization: Bearer <API_KEY>`
- 适用于普通 OpenAI Chat 兼容模型。

### New Suxi AI Responses
- 端点：`POST https://new.suxi.ai/v1/responses`
- 文档明确写：部分 OpenAI 模型仅支持 Responses，例如 `o3-pro`、`codex-mini-latest`
- 这类模型不要默认发到 Chat。

### New Suxi AI Claude Native
- 端点：`POST https://new.suxi.ai/v1/messages`
- 当前文档存在歧义：
  - 参数表写了 `x-api-key`
  - `securitySchemes` / `security` 又是 bearer
- 实现前必须再次核对 live doc 或实测；不要武断写死成单一头。

### New Suxi AI Gemini Native Banana Image
- 端点：`POST https://new.suxi.ai/v1beta/models/gemini-2.5-flash-image:generateContent`
- 鉴权：文档页示例为 `Authorization: Bearer <token>`
- 请求体关键字段：
  - `contents`
  - `generationConfig.responseModalities`
  - `generationConfig.imageConfig`
- 这是 Gemini 原生作图面，不是 OpenAI Images body。

### New Suxi AI OpenAI-format Banana Image
- 端点：`POST https://new.suxi.ai/v1/images/generations`
- 鉴权：`Authorization: Bearer <API_KEY>`
- 文档示例使用的是供应商自己的兼容层示例，请求体示例里直接出现了 `messages`
- 不要把这个面视为“严格 OpenAI Images API 等价物”。

### New Suxi AI 已知 drift 与实现注意事项
- `providerStrategy.ts` 需要完整覆盖 `openai`、`gemini`、`claude` 三个协议面。
- `defaultCompatibilityMode: 'chat'` 与 `imageProfile: 'chat-preferred'` 只能作为本地默认，不足以代表 live docs 的多协议结构。
- 图片路由不能只押注 Chat；必须保留 `/v1/images/generations` 与 Gemini Native 两条链。

---

## 供应商级能力探测

### 12AI 探测
1. 先识别是否命中 12AI 域名。
2. OpenAI Chat / Claude 用 Bearer 最小请求验证。
3. Gemini Native 用 `?key=` 对 `generateContent` 做最小探针。
4. 图片模型如果命中 Async Image 家族，必须走“提交任务 + 轮询任务”。

### GPT Best 探测
1. 先读取控制台给出的 `BASE_URL`。
2. 用 Bearer 调 `GET /v1/models`。
3. 按 `supported_endpoint_types` 决定具体协议面。
4. 图片 / 视频不要默认走 Chat；先找独立家族文档。

### New Suxi 探测
1. 先调 `GET /v1/models`。
2. `o3-pro`、`codex-mini-latest` 优先探测 `/v1/responses`。
3. Claude 模型单独探测 `/v1/messages`。
4. Banana 图片按用户选择的协议面分别探测：
   - Gemini Native：`generateContent`
   - OpenAI-format：`/v1/images/generations`

---

## 路由与回退规则

- 不要因为模型名包含 `gemini`、`claude`、`gpt-image` 就跨供应商套用别家的协议。
- `12AI` 的 Gemini Native 和 Async Image 都是专属链路，优先级高于泛化 Images API 假设。
- `GPT Best` 要先看 `supported_endpoint_types`，再决定是 chat、image、video 还是平台 API。
- `New Suxi` 至少分成 Chat、Responses、Claude Native、Gemini Native Banana Image、OpenAI-format Banana Image 五个面。

---

## 禁止事项

- 把供应商事实写成 generic OpenAI-compatible 默认行为
- 在未经验证时跨协议复制字段名
- 用本仓库当前适配经验替代供应商 live docs
- 在图片 / 视频链路上做高风险自动回退而不标记计费风险

---

## 变更日志

### v1.0 (2026-04-03)
- 从总纲拆分出供应商路由专项规则
- 收纳 `12AI`、`GPT Best`、`New Suxi AI` 的协议面、探测与回退约束
