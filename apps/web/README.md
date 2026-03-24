# apps/web

目标角色：前端表现层应用。

当前迁移策略：

- 现有运行中的前端仍位于仓库根目录 `src/`
- 新增页面、容器、typed client、路由壳层，后续逐步收敛到 `apps/web`
- 页面层禁止直接 `fetch`
- 页面层禁止直接调用 Supabase 业务 RPC
- 页面层只能通过 `packages/contracts` 生成的 client 与 `apps/api` 交互

建议最终结构：

```text
apps/web/
  src/
    app/
    pages/
    features/
    providers/
    services/
```
