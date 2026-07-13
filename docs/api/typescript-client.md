# TypeScript API Client

`@kk/api-client` 是 KK Studio 跨端 HTTP 入口。当前 `packages/api-client/src/index.ts` 只执行：

```ts
export * from "@kk/shared";
```

客户端实现与类型位于 `packages/shared/src/contracts/client/kk-api-client.ts`，入口函数为 `createKkApiClient(config)`。

## 创建客户端

```ts
import { createKkApiClient } from "@kk/api-client";

const client = createKkApiClient({
  baseUrl: "https://<your-host>/",
  getAccessToken: () => sessionStore.getAccessToken(),
  refreshAccessToken: () => sessionStore.refreshAccessToken(),
  onRefreshToken: (token) => sessionStore.setAccessToken(token),
  getClientVersion: () => "1.6.0",
  getDefaultHeaders: () => ({
    "x-app-platform": "web",
  }),
});
```

不要在 `getDefaultHeaders` 或源码中硬编码真实密钥。`baseUrl` 可以带或不带尾部 `/`。

## 配置项

| 字段 | 类型 | 行为 |
|---|---|---|
| `baseUrl` | `string` | 所有相对 API path 的基础地址。 |
| `fetchImpl` | `typeof fetch` | 可选 Fetch 注入，供 Node、测试或原生端适配。 |
| `getAccessToken` | callback | 每次请求前解析 JWT。 |
| `refreshAccessToken` | callback | 首次 401 后解析新 Token；客户端最多重试一次。 |
| `onRefreshToken` | callback | 持久化响应头 `X-Refresh-Token`。 |
| `getClientVersion` | callback | 注入 `X-Client-Version` 并写入本地错误 meta。 |
| `getDefaultHeaders` | callback | 注入平台级默认请求头。 |

单次方法调用可传 `ApiClientRequestOptions` 覆盖 Token、版本、请求头、请求 ID、`AbortSignal`。

## 传输行为

- 自动生成或沿用 `X-Request-Id`。
- 有 JSON body 时设置 `Content-Type: application/json; charset=utf-8`。
- Token 只在是非空、可安全进入 HTTP header 的 ASCII 字符串时发送。
- `api/v1/auth/*` 浏览器请求使用 `credentials: "include"`，以支持 HttpOnly 会话 Cookie。
- 响应为 401 且配置了 `refreshAccessToken` 时，只刷新并重试一次。
- 每个成功分支都会检查 `X-Refresh-Token` 并调用 `onRefreshToken`。
- 标准信封直接返回；非信封成功 JSON 会被包装为 `ApiResponse<T>`。
- Wuyin Catalog 的旧 `{ success, data, source }` 响应由客户端归一化为 `ApiResponse<WuyinCatalogResponseDto>`，组件不直接解析兼容信封。
- HTML 响应、Fetch 缺失、网络错误和非标准 HTTP 错误会转换为客户端 `ApiFailure`，不会把 HTML 当业务数据。

## 方法目录（75 个）

### 认证与 Profile（24）

| 方法 | HTTP 端点/职责 |
|---|---|
| `register` | `POST /api/v1/auth/register` |
| `login` | `POST /api/v1/auth/login` |
| `requestPasswordReset` | `POST /api/v1/auth/password-reset/request` |
| `confirmPasswordReset` | `POST /api/v1/auth/password-reset/confirm` |
| `getSession` | `GET /api/v1/auth/session` |
| `refreshSession` | `POST /api/v1/auth/refresh` |
| `logout` | `POST /api/v1/auth/signout` |
| `startWechatLogin` | `GET /api/v1/auth/wechat/start?redirectTo=...` |
| `startGoogleLogin` | `GET /api/v1/auth/google/start?redirectTo=...` |
| `startGoogleBind` | `GET /api/v1/auth/google/bind/start?redirectTo=...` |
| `startWechatBind` | `GET /api/v1/auth/wechat/bind/start?redirectTo=...` |
| `getProfile` | `GET /api/v1/profile` |
| `updateProfile` | `PATCH /api/v1/profile` |
| `updatePassword` | `POST /api/v1/profile/password` |
| `sendPasswordChangeCode` | `POST /api/v1/profile/password/send-code` |
| `getUserApiEntries` | `GET /api/v1/profile/user-apis` |
| `replaceUserApiEntries` | `PUT /api/v1/profile/user-apis` |
| `replaceUserApisPayload` | `PUT /api/v1/profile/user-apis/payload` |
| `revealUserApiSecret` | `POST /api/v1/profile/user-apis/reveal-secret` |
| `getKeyManagerCloudState` | `GET /api/v1/profile/key-manager-state` |
| `replaceKeyManagerCloudState` | `PUT /api/v1/profile/key-manager-state` |
| `checkUserRouteConnectivity` | `POST /api/v1/profile/user-routes/:routeId/connectivity` |
| `syncUserRoutePricing` | `POST /api/v1/profile/user-routes/:routeId/pricing-sync` |
| `createTempUser` | `POST /api/v1/auth/temp-users` |

### Admin 与权限（5）

| 方法 | HTTP 端点 |
|---|---|
| `getAdminAccess` | `GET /api/v1/admin/access` |
| `listAdminUsers` | `GET /api/v1/admin/users?page=&limit=&search=` |
| `verifyAdminPassword` | `POST /api/v1/admin/session/verify-password` |
| `changeAdminPassword` | `POST /api/v1/admin/password` |
| `setUserRole` | `POST /api/v1/admin/users/roles` |

### Workspace 与 Canvas（4）

| 方法 | HTTP 端点 |
|---|---|
| `getWorkspaceCanvas` | `GET /api/v1/workspaces/:workspaceId/canvas` |
| `getWorkspaceLayout` | `GET /api/v1/workspaces/layout` |
| `saveWorkspaceLayout` | `PUT /api/v1/workspaces/layout` |
| `cleanupCloudImages` | `DELETE /api/v1/workspaces/layout/cloud-images` |

### Billing 与充值（17）

| 方法 | HTTP 端点 |
|---|---|
| `getCreditBalance` | `GET /api/v1/billing/credits/balance` |
| `listCreditTransactions` | `GET /api/v1/billing/credits/transactions` |
| `debitCredits` | `POST /api/v1/billing/credits/debit` |
| `refundCredits` | `POST /api/v1/billing/credits/refunds` |
| `adminRechargeCredits` | `POST /api/v1/admin/billing/recharges` |
| `adjustAdminCredits` | `POST /api/v1/admin/billing/credit-adjustments` |
| `getAdminCreditAccount` | `GET /api/v1/admin/billing/accounts/:identity` |
| `createRechargeSubmission` | `POST /api/v1/billing/recharge-submissions` |
| `submitRechargeProof` | `POST /api/v1/billing/recharge-submissions/:id/proof` |
| `markRechargeSubmissionPaid` | `POST /api/v1/billing/recharge-submissions/:id/mark-paid` |
| `listAdminRechargeSubmissions` | `GET /api/v1/admin/billing/recharge-submissions` |
| `getAdminRechargeSubmission` | `GET /api/v1/admin/billing/recharge-submissions/:id` |
| `reviewRechargeSubmission` | `POST /api/v1/admin/billing/recharge-submissions/:id/review` |
| `listRechargePaymentChannels` | `GET /api/v1/billing/payment-channels` |
| `submitRecharge` | `POST /api/v1/billing/submit-recharge` |
| `listCreditExchangeRates` | `GET /api/v1/billing/exchange-rates` |
| `upsertCreditExchangeRate` | `PUT /api/v1/admin/billing/exchange-rates` |

### Model Catalog、Provider 与定价（13）

| 方法 | HTTP 端点 |
|---|---|
| `listModels` | `GET /api/v1/model-catalog/models?kind=` |
| `listActiveCreditModels` | `GET /api/v1/model-catalog/active-credit-models` |
| `listActiveModels` | `GET /api/v1/model-catalog/active` |
| `createAdminModel` | `POST /api/v1/admin/models` |
| `listAdminCreditProviders` | `GET /api/v1/admin/credit-providers` |
| `saveAdminCreditProvider` | `PUT /api/v1/admin/credit-providers/:providerId` |
| `getAdminCreditProviderPricingCache` | `GET /api/v1/admin/credit-providers/:providerId/pricing-cache` |
| `upsertAdminCreditProviderPricingCache` | `PUT /api/v1/admin/credit-providers/:providerId/pricing-cache` |
| `getSharedProviderPricingCache` | `GET /api/v1/provider-pricing-cache?baseUrl=` |
| `upsertSharedProviderPricingCache` | `PUT /api/v1/provider-pricing-cache?baseUrl=` |
| `deleteAdminCreditProvider` | `DELETE /api/v1/admin/credit-providers/:providerId` |
| `getWuyinCatalog` | `GET /api/v1/wuyin/catalog`，归一化缓存/回退目录响应 |
| `refreshWuyinCatalog` | `POST /api/v1/wuyin/catalog/refresh`，刷新并归一化远端目录响应 |

### Asset 与生成队列（10）

| 方法 | HTTP 端点 |
|---|---|
| `listAssets` | `GET /api/v1/assets?kind=&cursor=&limit=` |
| `createAsset` | `POST /api/v1/assets` |
| `createGenerationTask` | `POST /api/v1/generation-tasks` |
| `getGenerationTask` | `GET /api/v1/generation-tasks/:taskId` |
| `createGenerationJob` | `POST /api/v1/generation-jobs` |
| `listGenerationJobs` | `GET /api/v1/generation-jobs?status=&cursor=&limit=` |
| `getGenerationJob` | `GET /api/v1/generation-jobs/:jobId` |
| `updateGenerationJob` | `PATCH /api/v1/generation-jobs/:jobId` |
| `controlGenerationJob` | `POST /api/v1/generation-jobs/:jobId/control` |
| `claimGenerationJob` | `POST /api/v1/generation-jobs/:jobId/claim` |

### Workflow（2）

| 方法 | HTTP 端点 |
|---|---|
| `saveWorkflow` | `PUT /api/v1/workspaces/:workspaceId/workflows/:workflowId` |
| `getWorkflow` | `GET /api/v1/workspaces/:workspaceId/workflows/:workflowId` |

分组计数：24 + 5 + 4 + 17 + 13 + 10 + 2 = 75。

## DTO 来源

| 领域 | 类型文件 |
|---|---|
| 标准响应、分页 | `packages/shared/src/contracts/http/envelope.ts` |
| 认证、Profile、Key Manager、用户路由 | `packages/shared/src/contracts/dto/auth.ts` |
| 管理后台用户与权限 | `packages/shared/src/contracts/dto/admin-console.ts` |
| Billing、积分、充值 | `packages/shared/src/contracts/dto/billing.ts` |
| Workspace 与 Canvas | `packages/shared/src/contracts/dto/workspace-canvas.ts` |
| Workflow | `packages/shared/src/contracts/dto/workflow.ts` |
| Asset Library | `packages/shared/src/contracts/dto/asset-library.ts` |
| Generation Task/Job | `packages/shared/src/contracts/dto/generation.ts` |
| Model Catalog 与 Provider | `packages/shared/src/contracts/dto/model-catalog.ts` |
| Provider Schema | `packages/shared/src/contracts/providers/` |
| 统一生成 Schema | `packages/shared/src/contracts/generation/schema.ts` |

调用方应导入 DTO，而不是复制对象结构。服务端新增或修改稳定字段时，按 `packages/shared` → `packages/api-client` → `server` → `apps/web` → tests → docs 的顺序更新。
