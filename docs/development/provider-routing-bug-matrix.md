# 供应商 API 路由 Bug 诊断矩阵 (Provider Routing Bug Matrix)

本文件作为多厂家 API 路由收口治理的 Bug 冻结线，记录治理前的典型 API 路由、结构不一致与计费错误案例，用作防回归和诊断对照。

---

## 1. 典型 API Bug 诊断格式

每次在测试或开发环境中发现 API 问题，须按以下格式登记：

```markdown
### Bug-[编号]：[问题简述]
- **厂家**：[例如：gpt-best / 12ai / suxi / wuyin]
- **Provider strategyId**：[对应的策略ID]
- **Base URL**：[配置的 Base URL，是否缺失]
- **模型 ID**：[请求的模型，例如 nano-banana]
- **输入参数**：[如 prompt, referenceImages]
- **预期 surface**：[chat-image / provider-images / gemini-native-image / async-image]
- **实际 surface**：[实际发生的 surface 判定]
- **实际请求路径**：[如 /v1/images/generations 还是 /v1/chat/completions]
- **原始返回**：[上游返回的原始 JSON 结构]
- **标准化返回**：[归一化后的 StandardImageGenerationResult，是否缺失关键字段]
- **错误码**：[归一化前后的 Error Code]
- **是否扣费**：[是/否]
- **是否退款**：[失败时是否执行退款]
- **requestId**：[链路追踪 ID]
```

---

## 2. 冻结期诊断案例清单

### Bug-001：Wuyin 异步接口返回结构与同步图像接口契约冲突
- **厂家**：wuyin
- **Provider strategyId**：wuyinkeji
- **Base URL**：https://api.wuyin.example/v1
- **模型 ID**：image_nanoBanana2
- **输入参数**：`{ prompt: "a banana" }`
- **预期 surface**：async-image
- **实际 surface**：provider-images
- **实际请求路径**：`/generate/image` (后端路由) 转发至 Wuyin，但后端没有正确走异步任务的轮询与落盘机制，而是同步等待，导致连接超时或返回字段缺失。
- **原始返回**：`{ task_id: "task_12345", status: "processing" }`
- **标准化返回**：在治理前，由于接口强制要求返回 `{ image: string }`，系统因读不到 `image` 字段而直接判定失败，导致前台报错。
- **错误码**：`AI_GENERATION_FAILED` (后端) / `PROVIDER_RESPONSE_INVALID`
- **是否扣费**：是
- **是否退款**：否 (退款 Saga 缺失或因没有捕获异常导致未退款)
- **requestId**：`req-wuyin-001-legacy`

### Bug-002：gpt-best 路由被吞入 chat 兼容模式，且缺失 Base URL 时没有快速失败
- **厂家**：gpt-best
- **Provider strategyId**：gpt-best
- **Base URL**：未配置 (为空)
- **模型 ID**：nano-banana
- **输入参数**：`{ prompt: "banana artwork" }`
- **预期 surface**：provider-images (同步图像生成)
- **实际 surface**：chat-image
- **实际请求路径**：`/v1/chat/completions` (试图以 Chat 格式伪装图像生成)
- **原始返回**：请求直接悬挂超时，或由于 Base URL 为空抛出未捕获的运行时空指针异常。
- **标准化返回**：无
- **错误码**：`UNKNOWN_PROVIDER_ERROR`
- **是否扣费**：是 (预扣积分未返还)
- **是否退款**：否
- **requestId**：`req-gptbest-002-legacy`

### Bug-003：Suxi 策略配置与 Chat 路由过度耦合
- **厂家**：suxi
- **Provider strategyId**：suxi
- **Base URL**：https://api.suxi.example
- **模型 ID**：suxi-image-banana
- **预期 surface**：provider-images
- **实际 surface**：chat-image (由于 `compatibilityMode === 'chat'` 被硬性覆盖，绕过了 `surface-first` 路由策略)
- **实际请求路径**：向 `/v1/chat/completions` 发送请求，返回了非标准 JSON 内容，UI 试图当作 base64 图像解析而报错。
- **错误码**：`PROVIDER_RESPONSE_INVALID`
- **是否扣费**：是
- **是否退款**：是
- **requestId**：`req-suxi-003-legacy`
