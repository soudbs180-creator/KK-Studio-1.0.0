# Provider Connection 完整切流方案

> 创建：2026-07-24 | 状态：Slice A 已完成，Slice B-E 等待 Phase 2a 门禁 | 依赖：Phase 2a 外部门禁通过后执行 Slice B+

---

## 0. 现状诊断

### 0.1 当前 dual-read 覆盖范围

| 路由匹配 | 支持 | 说明 |
|---------|------|------|
| 精确 UUID (`CONNECTION_ID_PATTERN`) | ✅ | `readSelectedConnection` 直接查 provider_connections |
| `google-1017-1` (硬编码) | ✅ | 降级到 Google provider 下单个 connection |
| 其他 canonical provider legacy route | ❌ | 回退 `fallbackUnsupportedRoute` |
| 用户自定义 Key Manager entry | ❌ | 完全走 legacy `localUserRouteStore` |

### 0.2 两套写入路径并存

| 路径 | 写目标 | 读目标 |
|------|--------|--------|
| Legacy (Key Manager) | `user_provider_credentials.encrypted_secret` (JSON blob) | `localUserRouteStore` → `buildProfileRouteIndex` |
| New (Provider Connection) | `provider_connections.secret_ref` (AES-GCM) + `capability_bindings` | `providerConnectionLegacyRouteAdapter` → `readSelectedConnection` |

### 0.3 Canonical Provider 清单（16 个）

| id | 类别 | protocolFamily | legacy route ID 模式 |
|----|------|----------------|---------------------|
| google | official | gemini-native | `google-1017-1` ✅ 已映射 |
| openai | official | openai-compatible | `openai-...` / `provider_openai` |
| anthropic | official | claude-native | `anthropic-...` / `provider_anthropic` |
| deepseek | official | openai-compatible | `deepseek-...` / `provider_deepseek` |
| volcengine | official | openai-compatible | `volcengine-...` / `provider_volcengine` |
| aliyun | official | openai-compatible | `aliyun-...` / `provider_aliyun` |
| tencent | official | openai-compatible | `tencent-...` / `provider_tencent` |
| siliconflow | relay | openai-compatible | `siliconflow-...` / `provider_siliconflow` |
| openrouter | relay | openai-compatible | `openrouter-...` / `provider_openrouter` |
| apimart | relay | openai-compatible | `apimart-...` / `provider_apimart` |
| gpt-best | relay | multi | `gpt-best-...` / `provider_gpt-best` |
| wuyinkeji | relay | multi | `wuyin-...` / `provider_wuyin` |
| 12ai | relay | multi | `12ai-...` / `provider_12ai` |
| flow2api | relay | multi | `flow2api-...` / `provider_flow2api` |
| custom | custom | multi | Key Manager 自定义 entry UUID |
| systemproxy | system | openai-compatible | 系统代理 |

---

## 1. 实施切片

### Slice A：全 Provider legacy route → Connection 映射

**现状**：`selectCandidate()` 只处理 exact UUID 和 Google alias。  
**目标**：所有 16 个 canonical provider 的 legacy route ID 都能匹配到 Connection。

#### 变更点

**1.1 `providerConnectionLegacyRouteAdapter.js` — 扩展 `selectCandidate()`**

```js
// 新增 CANONICAL_PROVIDER_ID_MAP：legacy route 前缀 → provider_id
const CANONICAL_PROVIDER_ID_MAP = {
  'google-1017-1': 'google',
  'openai': 'openai',
  'anthropic': 'anthropic',
  'deepseek': 'deepseek',
  'volcengine': 'volcengine',
  'aliyun': 'aliyun',
  'tencent': 'tencent',
  'siliconflow': 'siliconflow',
  'openrouter': 'openrouter',
  'apimart': 'apimart',
  'gpt-best': 'gpt-best',
  'wuyin': 'wuyinkeji',
  '12ai': '12ai',
  'flow2api': 'flow2api',
};

function resolveProviderIdFromLegacyRoute(routeId) {
  const normalized = normalizeLegacyRouteId(routeId);
  if (!normalized) return null;
  // Exact UUID match
  if (CONNECTION_ID_PATTERN.test(normalized)) return null; // handled by exact match
  // Known provider prefix
  for (const [prefix, providerId] of Object.entries(CANONICAL_PROVIDER_ID_MAP)) {
    if (normalized.startsWith(prefix)) return providerId;
  }
  return null;
}
```

**1.2 扩展 `readSelectedConnection` 查询**

当 routeId 是 provider 级别的（非 connection UUID），按 provider_id 查询该用户的所有 connection：

```js
// provider-level query: 按 provider_id 查找
async function readConnectionByProviderId(userId, providerId, pool) {
  // 查询该 provider 下所有 available 的 connection
  // 优先选择 status='available' + verified_at 最新的
  // 唯一性歧义：>1 个 connection 时选最近的，记录 warning
}
```

**1.3 扩展 `projectLegacyRoute`**

不再硬编码 Google 映射，改为根据 `protocolProfile` 动态推算：

```js
const ENDPOINT_TYPE_MAP = {
  'claude-native': 'anthropic_messages',
  'gemini-native': 'google_gemini_generate_content',
  'google-official': 'google_gemini_generate_content',
  'openai-compatible': 'auto',
};

// legacyIds 从 CANONICAL_PROVIDER_ID_MAP 反向推导
```

**1.4 扩展 `supportsNewLookup`**

移除硬编码 Google 检查，改为查 CANONICAL_PROVIDER_ID_MAP 或 UUID pattern：

```js
const supportsNewLookup = 
  CONNECTION_ID_PATTERN.test(normalized) ||
  normalized in CANONICAL_PROVIDER_ID_MAP ||
  Object.keys(CANONICAL_PROVIDER_ID_MAP).some(p => normalized.startsWith(p));
```

---

### Slice B：Key Manager 写入切流

**现状**：`user-api-payload-router.js` → `writeOwnerProfileState()` → `user_provider_credentials`  
**目标**：新增写入也写到 `provider_connections`，但**不自动迁移旧明文 secret**

#### 变更点

**2.1 新增 `syncKeyManagerToProviderConnections` 适配器**

```js
// services/api/lib/capability-graph/keyManagerConnectionBridge.js

async function syncKeyManagerWrite(userId, profileState, overrides = {}) {
  // 1. 读取 profileState 中的 providers/slots/entries
  // 2. 对每个带 secret 的 entry：
  //    - 查找是否已有对应的 provider_connection（by user_id + provider_id + endpoint_url）
  //    - 新建：createProviderConnection()
  //    - 更新：updateProviderConnection()（只更新 secret 变更的）
  //    - 跳过：只读 placeholder（isReadonlySecret）
  // 3. 对 profileState 中已删除的 entry：
  //    - 不自动删除 connection（用户须显式操作）
  //    - 在 capability_bindings 中标记 degraded
}
```

**2.2 在 `user-api-payload-router.js` 中注入 bridge**

```js
// 在 saveEnrichedProfile 后追加
const { isKeyManagerConnectionWriteEnabled } = require('../lib/capability-graph/featureFlag');
if (isKeyManagerConnectionWriteEnabled(userId)) {
  await syncKeyManagerWrite(userId, profileState);
}
```

**2.3 Feature flag**

```env
# .env.local
KEY_MANAGER_CONNECTION_WRITE_ENABLED=false  # 默认关闭，双写通过后再切
```

---

### Slice C：Key Manager list/reveal 消费新投影

**现状**：list/reveal 从 `localUserRouteStore` + `user_provider_credentials` 读取。  
**目标**：新增从 `provider_connections` + `capability_bindings` 投影到 Key Manager 格式。

#### 变更点

**3.1 新增 `projectConnectionsToKeyManagerFormat`**

```js
async function projectConnectionsToKeyManagerFormat(userId) {
  // 1. listProviderConnections(userId) → 获取所有 connection
  // 2. listCapabilityBindings(userId) → 获取绑定
  // 3. 对每个 connection：
  //    - hasSecret: true → 不返回 secret，只返回 masked
  //    - 对 reveal 请求：getProviderConnectionSecretRecord → decrypt → 返回
  // 4. 映射到 Key Manager DTO 格式 (条目数组)
}
```

**3.2 新增端点 or 扩展既有端点**

- `GET /v1/profile/key-manager` → list（新投影优先，legacy 回退）
- `GET /v1/profile/key-manager/:connectionId/reveal` → reveal secret
- 保留 `/v1/profile/key-manager-state` 兼容旧格式

---

### Slice D：安全约束

| 约束 | 实现 |
|------|------|
| 禁止复制/自动迁移旧明文 secret | `syncKeyManagerWrite` 只在用户显式保存时写入，不扫描旧数据 |
| 解密失败 fail closed | `decryptSelectedSecret` 已实现：抛 `CONNECTION_SECRET_UNAVAILABLE` 500 |
| 不偷偷回退 legacy | dual-read 模式下 new 失败 → fallback 链允许，但记录 `fallback*` metrics |
| revocation/available/active 区分 | `readSelectedConnection` 仅查询 `status='available' AND revoked_at IS NULL` |
| owner 隔离 | `withUserScopedClient` 双重保障：RLS + 显式 `user_id` |
| 歧义处理 | 同一 provider 多个 connection 时：选 `verified_at` 最新的，记录 warning |

---

### Slice E：测试覆盖

**5.1 Unit 测试**（`tests/unit/provider-connection-cutover.test.js`）

- [ ] 所有 16 个 canonical provider legacy route → provider_id 映射
- [ ] 未知 route 回退 fallback
- [ ] 同一 provider 多 connection 歧义选择
- [ ] revoked connection 不返回
- [ ] status != 'available' 不返回
- [ ] 解密失败 fail closed
- [ ] Key Manager 格式投影正确
- [ ] 只读 placeholder 不触发写入

**5.2 Integration 测试**

- [ ] Key Manager 写入 → provider_connections 写入（双写模式）
- [ ] Key Manager list/reveal → 新投影数据一致
- [ ] legacy 写入仍在用户显式保存后落库
- [ ] 删除 Key Manager entry → connection status 不变/标记

**5.3 Contract 测试**

- [ ] Key Manager API 响应格式向后兼容
- [ ] Provider Connection API 不受影响

---

## 2. 观测窗口与切流条件

| 阶段 | flag 状态 | 观察项 | 窗口 |
|------|----------|--------|------|
| Dual-read | `PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED=true` | `/v1/metrics` 中 `providerConnectionDualRead.*` 指标 | ≥ 1 周 |
| Dual-write | `KEY_MANAGER_CONNECTION_WRITE_ENABLED=true` | Key Manager 保存后 connection 照常工作 | ≥ 1 周 |
| Cutover | legacy fallback 指标归零 | 删除 `user_provider_credentials` 读路径 | 确认后 |

---

## 3. 回滚协议

1. `PROVIDER_CONNECTION_LEGACY_DUAL_READ_ENABLED=false` → 所有读回 legacy
2. `KEY_MANAGER_CONNECTION_WRITE_ENABLED=false` → 所有写回 legacy
3. **不删除已写入 provider_connections 的数据**
4. 清理 `capability_bindings` 中 degraded 标记（如有）

---

## 4. 禁止事项

- ❌ 自动将 `user_provider_credentials` 中的旧明文 secret 复制到 `provider_connections`
- ❌ 在观测窗口结束前删除 legacy 读路径
- ❌ 解密失败时静默回退到 legacy（必须抛错 + 记录 metrics）
- ❌ 在 Phase 2a 门禁未通过前执行切流

---

## 5. 实施记录

### 2026-07-24 — Slice A ✅ 已完成

**变更文件**：
- `services/api/lib/capability-graph/providerConnectionLegacyRouteAdapter.js`
- `tests/unit/provider-connection-canonical-mapping.test.ts`（新增 16 测试）
- `tests/unit/provider-connection-dual-read.test.ts`（更新 1 测试）

**改动要点**：
- 新增 `CANONICAL_PROVIDER_PREFIX_TO_ID` Map（16 provider 全映射）
- 新增 `PROVIDER_ID_TO_LEGACY_PREFIX` 反向映射（exclude custom/systemproxy）
- 新增 `FORMAT_BY_PROTOCOL` 常量（claude/gemini/auto）
- 新增 `resolveProviderIdFromLegacyRoute()` 函数（exact + prefix + boundary check）
- 新增 `supportsNewLookup()` 函数（移除 Google-only 硬编码）
- `selectCandidate()` 扩展：provider-level 多 connection 歧义选择（latest verifiedAt + warning）
- `projectLegacyRoute()` 扩展：动态 protocolProfile → format/endpointType 映射
- `readSelectedConnection` SQL 新增 `pc.verified_at` 列
- 导出内部函数以便单元测试
- 前缀匹配增加 `-` 边界检查（防止 `wuyin` 误匹 `wuyinkeji-...`）

**验证结果**：
- 16 new + 10 dual-read tests = 26/26 pass
- Full unit: 2152 pass, only pre-existing flaky test (test 683 cancelledByParent)
- Typecheck: pass
- Build: ✓ built in 2.37s
