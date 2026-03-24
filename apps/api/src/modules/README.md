# API Modules

首批模块：

- `auth`
- `workspace-canvas`
- `generation`
- `workflow`
- `asset-library`
- `billing`
- `model-catalog`
- `admin-console`
- `storage-sync`

每个模块固定四层：

```text
<module>/
  presentation/
  application/
  domain/
  infrastructure/
```

模块之间只允许通过：

- `packages/contracts` 中的 DTO 与事件契约
- `packages/domain` 中的实体、值对象与仓储接口
