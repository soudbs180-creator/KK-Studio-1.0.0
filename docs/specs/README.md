Status: reference

# 数据规格与 API 协议规范 (docs/specs/README.md)

本目录定义了 KK Studio 的 **外部服务 API 规格协议、模型提供商的请求/响应参数映射规范、轮询行为机制以及 OpenAPI 标准描述**。

KK Studio 自身 Express 运行时端点、鉴权约定和 TypeScript SDK 请从 [当前 API 文档中心](../api/README.md) 进入；本目录主要承载 OpenAPI 稳定子集与第三方 Provider 协议。

## 📁 目录文件清单

1. **[openapi.yaml](openapi.yaml) —— OpenAPI 规格文件**
   - **职责**：项目核心 HTTP API 的标准 OpenAPI 3.0 定义。

2. **[API_DOCS.md](API_DOCS.md) —— gpt-best API 适配定义**
   - **职责**：针对中转供应商（如 `gpt-best` 等 OpenAI 兼容聚合服务）所提供的文生图、图生图、图像编辑、音视频生成等接口模型 ID、v2 端点规范与状态码映射说明。
   - **适用场景**：对绘图、视频和音频的核心适配逻辑（如轮询重试、退避延时）进行重构或故障排查。

3. **[NANO_BANANA.md](NANO_BANANA.md) —— 优化模型接口规格**
   - **职责**：基于 Gemini 所做优化的 `nano-banana` 画图模型与 `nano-banana-hd` 高清模型的 Generations 请求结构设计，特别包含宽高比（`aspect_ratio`）和参考图（`image`）的内嵌映射参数。
   - **适用场景**：调试文生图、图生图的参数透传逻辑。

4. **[GEMINI_PRO_IMAGE.md](GEMINI_PRO_IMAGE.md) —— 官方 Gemini 图像接口规格**
   - **职责**：Gemini 官方原生协议的 Image 格式 spec 定义。

5. **[API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md) —— 当前集成边界**
   - **职责**：定义共享 DTO、类型化 KK API Client、服务端 Provider adapter、运行时计价和验证的接入顺序。

6. **[API_USAGE_GUIDE.md](API_USAGE_GUIDE.md) —— 安全客户端用法**
   - **职责**：给出 `createKkApiClient`、目录读取、持久生成任务和错误处理的安全示例。

## 🔌 接口协议原则

- **标准格式适配**：第三方模型必须严格通过相应的 Adapter 转换为标准的 OpenAI Compatible 格式或特定的 Native 格式，参数的映射与转换必须在 Adapter 层解决，严禁污染业务层代码。
