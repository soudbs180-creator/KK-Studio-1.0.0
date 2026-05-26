# 验证报告 (validation.md)

本文件是 AGENTS 明确规定的根目录例外文件。记录自动化测试、架构审查以及安全扫描的验证结果。

## 单元测试与类型检查
- `npm run typecheck`：通过 (2026-05-25)
- `npm run architecture:check`：通过 (2026-05-25)
- `npm run governance:check`：通过 (2026-05-25)
- `npm run spec:check`：待运行
- `npm run test:unit`：待运行

## 安全合规扫描
- 前端敏感 API 密钥扫描 (sk-, AIza, 密钥环境变量)：待运行
- 直连官方域名过滤检测：待运行
