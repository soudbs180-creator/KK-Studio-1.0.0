# apps/api

目标角色：模块化单体主 API / BFF。

现状映射：

- 当前 `server/`、`api/`、`billing/` 中的服务端能力，后续统一收口到这里
- 控制器、应用服务、领域规则、基础设施适配器按业务模块组织
- 对外只暴露统一 JSON envelope，不直接暴露数据库行结构

边界规则：

- `presentation`：route/controller/request validation
- `application`：command/query/use-case orchestration
- `domain`：aggregate/value object/policy/repository interface
- `infrastructure`：database provider/third-party adapters
