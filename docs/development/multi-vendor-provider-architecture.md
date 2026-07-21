Status: historical

# 多供应商 API 架构方案

Current baseline: KK Studio v1.6.0. Provider facts are owned by the server dispatcher; Web code consumes typed routing and capability results.

## 1. 背景与目标

当前仓库已经接入多类供应商与多种协议面，包括：

- 官方 API：Google Gemini、OpenAI、Anthropic
- 聚合/代理供应商：`12AI`、`GPT Best`、`New Suxi AI`
- OpenAI 兼容族：NewAPI / OneAPI / Cherry Studio / 多数第三方网关
- 供应商专属链路：异步图片、原生 Gemini 图片、Claude Messages、Responses API

这些接入已经覆盖了市面上大多数请求方法，但当前实现仍存在以下问题：

- 供应商事实、协议面事实、业务默认值混在一起，局部改动容易影响别家
- `compatibilityMode` 过于粗粒度，容易让聊天默认值误伤图片或视频链路
- 一部分供应商规则散落在 `providerStrategy`、`keyManager`、`OpenAICompatibleAdapter` 中，存在 drift 风险
- 新增供应商时仍需要改动多个公共入口，接入成本偏高

本方案的目标是：

- 每个供应商都能独立维护，不互相污染
- 新增供应商时优先通过“新增画像配置”完成接入，而不是修改公共分发逻辑
- 将“供应商识别”和“协议执行”彻底解耦
- 让聊天、图片、视频、模型发现、异步任务都能按能力独立路由

## 2. 当前问题归纳

结合当前实现，至少存在以下结构性风险：

1. 已知供应商的旧鉴权配置可能覆盖供应商策略默认值，导致 `Bearer` / `query` 选择错误。
2. 图片路由会被全局 `compatibilityMode` 抢先命中，导致供应商专属图片面无法稳定生效。
3. 供应商支持列表、运行时路由、UI 预置模型之间存在信息漂移。
4. 供应商专属 async task 能力混入通用 OpenAI 兼容适配器，导致文件职责过重。

## 3. 目标分层

建议将多供应商接入拆成四层：

### 3.1 供应商画像层 `ProviderProfile`

这一层只描述供应商事实，不承载请求逻辑。

建议字段：

```ts
type ApiSurface =
  | 'openai-chat'
  | 'openai-responses'
  | 'openai-images'
  | 'openai-models'
  | 'gemini-native'
  | 'gemini-models'
  | 'claude-messages'
  | 'claude-models'
  | 'async-image'
  | 'async-video';

interface ProviderProfile {
  id: string;
  label: string;
  matchers: {
    providerNames?: RegExp[];
    hostPatterns?: RegExp[];
    basePatterns?: RegExp[];
  };
  surfaces: Partial<Record<ApiSurface, {
    enabled: boolean;
    auth: {
      method: 'header' | 'query';
      headerName?: string;
      valueFormat?: 'bearer' | 'raw';
    };
    endpointStyle:
      | 'openai-compatible'
      | 'gemini-native'
      | 'claude-native'
      | 'async-task';
    discovery?: 'models' | 'static' | 'none';
  }>>;
  defaults: {
    preferredChatSurface?: 'openai-chat' | 'openai-responses' | 'gemini-native' | 'claude-messages';
    preferredImageSurface?: 'openai-images' | 'gemini-native' | 'async-image';
    preferredVideoSurface?: 'openai-chat' | 'async-video';
  };
  capabilities?: {
    supportsEndpointTypesField?: boolean;
    supportsAsyncTasks?: boolean;
    billingRisk?: 'low' | 'medium' | 'high';
  };
}
```

### 3.2 协议传输层 `Transport`

这一层负责：

- 生成 endpoint URL
- 拼接鉴权
- 构造 headers
- 生成协议级 payload

这一层不认识任何供应商品牌名，只按协议工作。

建议保留三类主传输实现：

- `OpenAITransport`
- `GeminiNativeTransport`
- `ClaudeTransport`

### 3.3 能力路由层 `CapabilityRouter`

这一层根据调用意图与模型能力，决定该次调用应该走哪个 surface。

输入：

- `provider profile`
- `modelId`
- `intent`：`chat` / `image` / `video` / `models`
- `stream`
- 可选用户偏好覆盖

输出：

- `selectedSurface`
- `reason`
- `billingRisk`

这一层取代当前粗粒度的 `compatibilityMode` 决策。

### 3.4 任务执行层 `TaskExecutor`

这一层处理真正的调用执行，尤其是供应商专属异步任务：

- 提交任务
- 轮询状态
- 解析结果
- 归一化错误

仅当供应商存在专属异步能力时，才需要单独 executor。

## 4. 当前目录结构

当前实现已经收敛到以下边界，不再另建平行的根 `src/` Provider 系统：

```text
services/api/lib/dispatcher/
  providerProfiles.js
  providerRegistry.js
  strictProviderContracts.js
  adapters/

apps/web/src/core/routing/
  ProviderRouteEngine.ts
  routePolicies.ts

apps/web/src/services/api/
  providerStrategy.ts
  providerRegistry.ts
  apiConfig.ts
  connectionTest.ts

apps/web/src/services/llm/
  providerAdapterRouter.ts
  providerCapabilities.ts
```

迁移期保留的当前入口包括：

- `apps/web/src/core/routing/ProviderRouteEngine.ts`
- `apps/web/src/services/api/providerStrategy.ts`
- `apps/web/src/services/api/apiConfig.ts`
- `apps/web/src/services/api/connectionTest.ts`
- `apps/web/src/services/llm/providerAdapterRouter.ts`

但内部实现应逐步改成调用新层，而不是继续堆条件分支。

## 5. 供应商模板抽象

### 5.1 `12AI` 模板

适用于：

- 同一供应商暴露 OpenAI / Gemini / Claude 多协议面
- 图片为“提交任务 + 轮询任务”异步链路

建议 surfaces：

- `openai-chat`
- `claude-messages`
- `gemini-native`
- `async-image`

### 5.2 `GPT Best` 模板

适用于：

- OpenAI 兼容主链
- `/v1/models` 返回 `supported_endpoint_types`
- 同一供应商按模型能力决定 chat / image / video

建议 surfaces：

- `openai-chat`
- `openai-responses`
- `openai-images`
- `openai-models`

### 5.3 `New Suxi AI` 模板

适用于：

- 同域名暴露 Chat / Responses / Claude / Gemini 图片 / OpenAI-format 图片

建议 surfaces：

- `openai-chat`
- `openai-responses`
- `claude-messages`
- `gemini-native`
- `openai-images`

### 5.4 `Official API` 模板

适用于：

- Google Official
- OpenAI Official
- Anthropic Official

这些供应商同时也是协议实现的事实基线，供第三方代理对齐。

## 6. 配置模型建议

### 6.1 弃用全局 `compatibilityMode`

当前的 `compatibilityMode: 'standard' | 'chat'` 过于粗粒度。

建议改为：

```ts
interface ChannelRoutingPolicy {
  preferredChatSurface?: string;
  preferredImageSurface?: string;
  preferredVideoSurface?: string;
  allowFallbackSurfaces?: boolean;
}
```

这样可以避免出现：

- 聊天默认值误吞图片调用
- 图片默认值误影响 Responses
- 某供应商明明支持独立图片面，却被全局 chat 模式提前命中

### 6.2 将 `provider` 和 `surface` 分离

建议渠道配置持久化字段明确区分：

- `providerId`
- `selectedSurface`
- `routingPolicy`
- `authOverride`

而不是继续用单个 `provider + format + compatibilityMode` 混合表达。

## 7. 运行时决策流程

建议统一为以下顺序：

1. 先根据 `providerId / providerName / host / baseUrl` 匹配 `ProviderProfile`
2. 再根据 `intent + modelId + stream` 进入 `CapabilityRouter`
3. 选择 surface
4. 由对应 `Transport` 构造请求
5. 如为 async task，则转交对应 `TaskExecutor`
6. 最终统一归一化结果和错误

## 8. 模型发现与探针策略

### 8.1 模型发现

建议按 surface 区分：

- `openai-models`：`GET /v1/models`
- `gemini-models`：`GET /v1beta/models`
- `claude-models`：若供应商无明确支持，则视为 `none`
- `async-image` / `async-video`：优先从静态 profile 或管理面读取，不直接创建任务

### 8.2 非计费探针

建议 `connectionTest` 升级成 surface-based：

- `openai-chat`：最小 chat 请求
- `openai-responses`：最小 responses 请求
- `gemini-native`：最小 `generateContent`
- `claude-messages`：最小 `messages`
- `openai-images`：优先模型列表或 capability 探针，避免直接生图
- `async-image`：只验证 submit endpoint / auth / request schema，不创建真实任务

## 9. 新供应商接入流程

以后新增供应商建议只走 4 步：

1. 确认其属于哪种模板：
   - `Official API`
   - `OpenAI-compatible`
   - `OpenAI + Responses`
   - `OpenAI + Gemini`
   - `OpenAI + Claude`
   - `Async task vendor`
2. 新增一个 `ProviderProfile`
3. 如供应商存在专属异步任务，再新增一个专属 executor
4. 补齐识别测试、路由测试、非计费探针测试

这样可保证新增供应商优先通过“新增配置”完成，而不是修改公共请求流程。

## 10. 迁移路线

### Phase 1：止血修正

- 修正已知供应商默认鉴权不可被旧配置错误覆盖
- 修正图片链路被全局 `compatibilityMode` 提前命中的问题
- 修正供应商支持模型、运行时路由、UI 预置列表之间的漂移

### Phase 2：引入画像层与 surface 路由

- 将供应商事实迁入 `ProviderProfile`
- 将 `compatibilityMode` 迁移为 per-capability routing policy
- 在不破坏现有入口的前提下，让旧入口委托给新路由层

### Phase 3：拆分 adapter

- 将 `OpenAICompatibleAdapter` 中的 vendor-specific 逻辑迁到 profile / transport / executor
- 保留 adapter 作为 facade，对上层维持兼容 API

### Phase 4：完善自动发现与测试矩阵

- 将 `/v1/models` 与供应商管理面能力用于自动路由建议
- 补齐新增供应商模板与接入清单

## 11. 测试矩阵

建议每个供应商至少覆盖以下测试：

### 11.1 识别测试

- provider alias 命中
- base URL / host 命中
- custom host 场景不误判官方 API

### 11.2 路由测试

- chat 请求是否进入正确 surface
- image 请求是否进入正确 surface
- response-only model 是否正确进入 Responses
- async image model 是否正确进入 async task executor

### 11.3 鉴权测试

- `Authorization: Bearer`
- `Authorization: raw`
- `x-api-key`
- `x-goog-api-key`
- `?key=...`

### 11.4 安全测试

- 图片 / 视频链路默认不做高风险自动回退
- 探针流程不会创建计费任务
- drift 修正不会影响其他供应商

## 12. 验收标准

- 新增供应商时，优先新增 profile，而不是修改公共 adapter 主分支
- 同一供应商的 chat / image / video / responses / async task 可以独立切换
- 不再出现“聊天默认值吞掉图片路由”的问题
- `connectionTest` 能明确说明“当前供应商支持哪些 surface”
- 供应商 drift 可定位在单个 profile 或 executor 中修复

## 13. 与当前代码的映射建议

继续把以下当前文件视为迁移入口：

- [ProviderRouteEngine.ts](../../apps/web/src/core/routing/ProviderRouteEngine.ts)
- [providerStrategy.ts](../../apps/web/src/services/api/providerStrategy.ts)
- [apiConfig.ts](../../apps/web/src/services/api/apiConfig.ts)
- [connectionTest.ts](../../apps/web/src/services/api/connectionTest.ts)
- [providerAdapterRouter.ts](../../apps/web/src/services/llm/providerAdapterRouter.ts)
- [keyManager.ts](../../apps/web/src/services/auth/keyManager.ts)

迁移原则：

- 保持对现有上层 API 的兼容
- 先抽离供应商事实，再抽离执行逻辑
- 每完成一层迁移，都补单测，避免路由回归

---

*Document Updated: 2026-04-03*
