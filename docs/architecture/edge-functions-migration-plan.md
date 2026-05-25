# Edge Functions Migration Plan

## Goal

把管理员态能力从浏览器直连 RPC 和本地 `apps/api` 服务，逐步收口到 Supabase Edge Functions。

这次迁移主要解决三件事：

1. 用户自配 API 时，不应该误走积分扣费链路。
2. 积分模型的管理员 provider 配置不应在浏览器里暴露真实 `api_keys` 和服务端密钥职责。
3. 本地开发与部署后的运行方式尽量一致，减少“本地一套、线上一套”的偏差。

## Why Now

当前仓库已经具备两套运行路径：

- 用户态主生成链路：`secure-model-proxy` Edge Function
- 管理态和部分兼容链路：浏览器直连 Supabase RPC，或本地 `apps/api`

这带来几个现实问题：

- 管理员积分模型虽然已经做了字段裁剪，但浏览器仍然直接承担了一部分管理 RPC 调用。
- 本地 `apps/api` 在缺少 `SUPABASE_SERVICE_ROLE_KEY` 时，会退化到 memory/local-file，和线上行为不完全一致。
- 新能力继续堆在 `apps/api` 上，会让长期架构更分裂。

## Architecture Decision

### Boundary

- 浏览器：
  - 只持有 `SUPABASE_ANON_KEY`
  - 只使用用户自己的 session
  - 只做用户态查询、RLS、以及调用 Edge Functions

- Edge Functions：
  - 持有 `SUPABASE_SERVICE_ROLE_KEY`
  - 负责管理员态读写、provider secret、汇率、充值、后台运维能力
  - 负责把敏感字段裁剪成前端可见的数据合同

- `apps/api`：
  - 短期保留为兼容层和本地开发兜底
  - 中期逐步退役管理侧职责

### Non-Goal

这次不重写 `secure-model-proxy` 主生成链路。它已经是正确的服务端边界，应保持稳定。

## Function Split

### Phase 1

`admin-credit-models`

负责：

- `list-active`
- `list-admin`
- `save`
- `delete`

特点：

- `list-active` 返回安全的 active credit model 目录，可给普通用户使用
- `list-admin` / `save` / `delete` 只允许管理员使用
- 所有响应都由函数层裁剪，前端不再直接依赖敏感 RPC 输出

### Phase 2

`admin-console`

负责：

- 管理员 access state
- 管理员密码校验/修改
- 用户角色调整
- 管理员充值
- 汇率配置

### Phase 3

`user-api-profile`

负责：

- 用户自己的 API key/profile 云同步
- 用户态 provider connectivity / pricing sync
- 与 `secure-model-proxy` 的用户路由数据契约统一

## Frontend Migration Order

### Step 1

`src/services/api/adminCreditProviderService.ts`

- 优先调用 `supabase.functions.invoke('admin-credit-models')`
- 保留当前 `supabase.rpc(...)` fallback

### Step 2

`src/services/model/adminModelService.ts`

- active credit model 目录优先走 `admin-credit-models:list-active`
- 保留当前 RPC 和 legacy web API fallback

### Step 3

后续再迁：

- `AdminConsoleSettings`
- 汇率配置
- 管理员充值
- 用户角色管理

## Local Development

### Required Secrets

Edge Function 本地和线上都需要这些环境变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Recommended Local Run Mode

使用 Supabase CLI 单独启动函数，而不是继续把管理员态逻辑塞回本地 Node 服务：

```powershell
supabase functions serve admin-credit-models --env-file supabase/.env.functions.local
```

`supabase/.env.functions.local` 建议只放服务端变量，不进入前端：

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

仓库里也补了可直接使用的脚本：

```powershell
npm run supabase:functions:serve:admin-credit-models
```

### Frontend Behavior

- 函数可用时：优先走 Edge Function
- 函数不可用时：自动回退到现有 Supabase RPC / legacy API

这样可以先完成迁移，不会阻塞当前本地开发。

## Deployment

部署端需要在 Supabase Edge Functions secrets 中配置：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

不要把 `SUPABASE_SERVICE_ROLE_KEY` 暴露给浏览器、Vite public env、或客户端配置文件。

如果希望游客或未登录用户也能直接走 `admin-credit-models:list-active` 这条函数路径，而不是落回旧 RPC fallback，部署时应关闭平台层 JWT 强校验：

```powershell
supabase functions deploy admin-credit-models --no-verify-jwt
```

原因：

- `list-active` 本身是公共安全输出
- `list-admin` / `save` / `delete` 仍然会在函数内部通过 Supabase user session 和 admin role 再做校验

## Rollout Plan

### Phase 1 Acceptance

- 普通用户只能看到安全的 active credit model 元数据
- 管理员设置页不再直接依赖浏览器侧敏感 RPC 作为主路径
- 本地和线上都可通过 Edge Function 跑通管理模型读写
- 用户自配 API 调用不误扣积分

### Rollback

如果函数部署异常：

- 前端自动回退到当前 Supabase RPC / legacy API
- 不影响 `secure-model-proxy`
- 不影响普通用户已有调用链路

## Next Steps

1. 新建 `supabase/functions/_shared/`
2. 新建 `supabase/functions/admin-credit-models/`
3. 前端接入 `admin-credit-models`
4. 跑针对性测试
5. 再迁 `admin-console`
