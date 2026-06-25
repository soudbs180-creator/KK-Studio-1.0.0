# 本地开发与发布部署指南 (docs/setup/README.md)

本目录包含 KK Studio 系统在**本地启动、配置、环境初始化、物理机/VPS 自托管部署、以及本地 Supabase CLI 开发环境模拟**相关的命令手册。

## 📁 目录文件清单

1. **[GUIDE.md](GUIDE.md) —— 本地与 VPS 部署引导**
   - **职责**：系统自托管部署（VPS、端口绑定、系统进程管理、Nginx 代理、安全隧道与证书配置）的简明操作手册。
   - **适用场景**：运维部署或环境迁移。

2. **[ADMIN.md](ADMIN.md) —— 后台管理员系统配置**
   - **职责**：系统后台超级管理员账户初始化、管理员密码哈希（默认 MD5 值）、以及公共模型密钥轮换后台的使用说明。

3. **[SUPABASE_CLI.md](SUPABASE_CLI.md)**, **[SUPABASE.md](SUPABASE.md)** 和 **[SUPABASE_BASELINE.md](SUPABASE_BASELINE.md)**
   - **职责**：Supabase CLI 在本地开发中的基本使用、数据同步和 CLI 命令配置。
   - **说明**：在 v1.5.8 中，数据存储已经往 VPS 自建 PostgreSQL 迁移，Supabase 目前主要作为本地测试或 Auth 鉴权配置备份。

4. **[ALIPAY_MCP.md](ALIPAY_MCP.md)** 和 **[AUTO_UPDATE_AND_DEPLOY.md](AUTO_UPDATE_AND_DEPLOY.md)**
   - **职责**：支付宝 MCP 对接以及持续部署脚本说明。

## 🚀 部署核心验证

- 部署完成后，请务必在服务器上运行端口与连接性校验，确保 VPS 主服务 (Express) 与 PostgreSQL 数据库能够无障碍通信。
- 环境变量必须正确配置在 `.env` 中，严禁将生产凭据硬编码到配置中。
