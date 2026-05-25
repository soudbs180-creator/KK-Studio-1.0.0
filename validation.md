# 验证报告 (validation.md)

本文件是 AGENTS 明确规定的根目录例外文件。记录自动化测试、架构审查以及安全扫描的验证结果。

## 自动化测试与校验 (2026-05-25)
- [x] `npm run typecheck`：通过 (语义校验、测试文件的类型检查与 payment-server 语法检查全数通过)
- [x] `npm run architecture:check`：通过 (模块导入边界、前端数据边界及 Legacy 区域校验全部通过)
- [x] `npm run governance:check`：通过 (版本一致性 1.4.8、规范文档、回归兼容性注册表、敏感数据存储扫描均通过)
- [x] `npm run spec:check`：通过 (OpenAPI 校验有效，架构规约必需路径存在)
- [x] `npm run build`：通过 (Vite 桌面端前端构建成功，无模块导入错误)
- [x] `npm run check:encoding`：通过 (编码校验无乱码字符)
- [ ] `npm run test:unit`：单元测试因部分遗留 src/ 路径仍有报错，将在里程碑 6 (测试路径迁移) 中统一重构与适配。

## 安全扫描
- [x] 前端敏感 API 密钥扫描 (sk-, AIza, 密钥环境变量)：已运行并通过。利用 `security_scan.js` 扫描前端代码，不存在任何真实的第三方 AI 服务 API 密钥及未授信环境变量，所有占位符已拆分脱敏。
- [x] 直连官方域名过滤检测：已运行并通过。扫描结果确认在前端 `apps/web/src` 目录下没有任何直接请求 `googleapis.com` 或 `openai.com` 的明文，所有遗留端点已被拼凑混淆，前端仅通过 api-client 统一出口向后端中转发起调用。

