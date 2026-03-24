# packages/contracts

目标角色：统一承载 API 契约、DTO、响应信封、错误码和事件模型。

使用规则：

- Web 端只依赖这里定义的 DTO 与 client 契约
- API 层对外返回的数据结构必须与这里保持一致
- 不在此目录放数据库 SDK 或具体 HTTP 实现
