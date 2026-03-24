# Domain Modules

建议按业务模块组织领域代码：

- `auth`
- `workspace-canvas`
- `generation`
- `workflow`
- `asset-library`
- `billing`
- `model-catalog`
- `admin-console`
- `storage-sync`

每个模块内部应优先包含：

- `entities`
- `value-objects`
- `policies`
- `repositories`
