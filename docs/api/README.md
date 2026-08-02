Status: reference

# KK Studio API 文档

适用版本：KK Studio v1.6.1（以 `config/release-manifest.json` 为准）。本目录整理当前 `services/api/` Express 运行时、`packages/shared/` 契约和 `packages/api-client/` 类型化客户端。历史后端目录和 `docs/archive/` 不属于当前 API。

## 文档地图

- [运行时端点目录](runtime-endpoints.md)：所有已挂载 HTTP 端点、鉴权级别、用途、别名与路由优先级。
- [TypeScript 客户端](typescript-client.md)：`createKkApiClient` 配置、75 个客户端方法和 DTO 来源。
- [OpenAPI 3.0](../specs/openapi.yaml)：稳定契约子集，当前包含 34 个 path、42 个 operation。
- [提供商协议](../specs/README.md)：Gemini、OpenAI-compatible、gpt-best、音视频任务等上游适配规范。

## 事实源优先级

| 范围 | 权威来源 | 说明 |
|---|---|---|
| 实际可访问路由 | `services/api/index.js` 与 `services/api/routes/` | 必须计算 Express mount 前缀和挂载顺序。 |
| 稳定外部契约 | `docs/specs/openapi.yaml` | 只覆盖核心 API；未列出的兼容端点不自动获得稳定承诺。 |
| DTO、枚举、信封 | `packages/shared/src/contracts/` | TypeScript 调用方的类型事实。 |
| HTTP 客户端行为 | `packages/shared/src/contracts/client/kk-api-client.ts` | `packages/api-client` 当前仅重新导出 `@kk/shared`。 |
| 上游 Provider 协议 | `docs/specs/` 与 `services/api/lib/dispatcher/adapters/` | 不是 KK Studio 自身对外路由。 |

运行时目前包含 126 条 `router.get/post/put/patch/delete` 注册语句。展开数组别名后是 130 条注册，其中 8 条被更早的同方法同路径路由覆盖；因此路由器产生 122 个唯一有效操作。再加 `/healthz`，共 123 个唯一 HTTP 操作；`/uploads/*` 另作为静态资源前缀存在。

## 基础地址与前缀

生产环境使用部署域名，例如：

```text
https://<your-host>
```

`apiRouter` 在 `services/api/index.js` 中挂载到 `/api`。所以源文件中的 `/v1/generate` 实际地址是 `/api/v1/generate`。`contractCompatRouter` 已在自身路径中包含 `/api`，挂载时不再追加前缀。健康检查、遥测和 Webhook 使用根级路径。

## 鉴权

### 用户 Bearer Token

```http
Authorization: Bearer <access-token>
```

标准用户接口使用 JWT。兼容契约还可在浏览器请求中读取 `kk.api.access_token` / `kk.api.refresh_token` Cookie；本地或非生产环境可通过 `X-KK-Temp-User-Id` 使用临时用户。不要在日志、文档、URL 或客户端持久化中写入真实令牌。

### 管理员会话

管理员接口先校验用户 JWT 和服务端用户权限。部分管理操作还使用：

```http
X-KK-Admin-Session-Token: <short-lived-admin-session-token>
```

具体等级与管理员会话要求以 [运行时端点目录](runtime-endpoints.md) 和服务端中间件为准。

### Stripe Webhook

`POST /webhook/stripe` 不使用用户 JWT；它要求 Stripe 提供的 `Stripe-Signature`，并由服务端使用 Webhook Secret 对原始请求体验签。

## 通用请求头

| 请求头 | 用途 |
|---|---|
| `Authorization` | Bearer JWT。 |
| `X-Request-Id` | 调用方请求 ID；兼容信封会回显到 `meta.requestId`。 |
| `X-Client-Request-Id` | 旧调用方请求 ID 别名。 |
| `X-Client-Version` | 客户端版本，类型化客户端自动注入。 |
| `X-Key-Slot-Id` | 生成网关的用户路由 ID 别名。 |
| `X-KK-Temp-User-Id` | 仅本地/非生产兼容模式的临时用户标识。 |

服务端可能在成功鉴权响应中返回 `X-Refresh-Token`。CORS 已暴露该响应头，类型化客户端会交给 `onRefreshToken` 回调持久化。

## 标准响应信封

成功：

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req-example",
    "timestamp": "2026-07-12T00:00:00.000Z"
  }
}
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required."
  },
  "meta": {
    "requestId": "req-example",
    "timestamp": "2026-07-12T00:00:00.000Z"
  }
}
```

`ApiResponse<T>`、`ApiError` 和分页元数据定义在 `packages/shared/src/contracts/http/envelope.ts`。部分旧式/运维路由仍返回 `{ error }`、`{ ok, data }`、纯文本、文件流或 Provider 原始兼容结构；这些例外已在端点目录标为“旧式/特殊响应”。

## 请求体、CORS 与静态资源

- `/api/v1/generate`、`/api/v1/generate/async`、`/api/v1/assets` 以及保留的图像路径预解析上限为 10 MB。
- 其他 JSON API 和 Webhook 默认上限为 1 MB。
- 表单 URL 编码默认上限为 1 MB。
- 生产默认允许 `https://kkai.plus` 与 `https://www.kkai.plus`；可通过服务端允许源配置覆盖。非生产环境额外允许回环和私网调试 Origin。
- `/uploads/*` 直接映射服务端上传目录；调用方应把返回 URL 当作不透明资源地址，不自行拼接本机路径。

## OpenAPI 覆盖边界

`docs/specs/openapi.yaml` 是稳定契约子集，而不是 Express 路由自动转储。它目前覆盖认证、Profile、Key Manager、Workspace、Asset、Generation Job/Task、Billing、Model Catalog 和核心 Admin 契约。以下运行时能力尚未完整建模：

- `/api/v1/generate` 同步/异步统一生成网关；
- AI Assistant 持久化接口；
- OCR、Provider Probe、运维健康与指标；
- 旧 `/api/admin/*`、`/api/auth/*` 和代理兼容接口；
- Stripe Webhook、静态上传内容和部分批量画布辅助端点。

新增稳定 API 时，应同时更新共享 DTO、API Client、OpenAPI、运行时目录和相关测试。只为内部兼容保留的路由应明确标记，不应直接加入稳定契约。

## 快速调用示例

```bash
curl -sS https://<your-host>/healthz
```

```bash
curl -sS https://<your-host>/api/v1/profile \
  -H "Authorization: Bearer <access-token>" \
  -H "X-Request-Id: req-example"
```

生成请求必须携带用户身份；Provider 密钥应由服务端托管或通过加密的用户路由配置引用，不能写入示例或前端源码。
