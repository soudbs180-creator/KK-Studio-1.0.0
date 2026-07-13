# Supabase 配置指南

## 项目信息

- 项目 URL: `https://ovdjhdofjysanamgkfng.supabase.co`
- 项目 ID: `ovdjhdofjysanamgkfng`
- 访问令牌: `sbp_your_personal_access_token`

重要说明:
PAT 只应该存在于你本机的终端环境变量、MCP 本地配置或密码管理器里，不要提交到仓库、文档、截图、Issue 或聊天记录。

## 快速配置

### 方法 1: PowerShell 脚本

```powershell
.\scripts\setup-supabase.ps1
```

### 方法 2: Supabase CLI

```bash
# 1. 安装 CLI
npm install -g supabase

# 2. 仅在本地会话设置访问令牌，不要写进仓库
export SUPABASE_ACCESS_TOKEN=sbp_your_personal_access_token

# 3. 连接项目
supabase link --project-ref ovdjhdofjysanamgkfng

# 4. 推送迁移
supabase db push
```

### 方法 3: 手动执行 SQL

1. 打开 [Supabase Dashboard](https://app.supabase.com/project/ovdjhdofjysanamgkfng)
2. 进入 `SQL Editor`
3. 粘贴需要执行的迁移 SQL
4. 点击 `Run`

## 环境变量

`.env` 里只应放公开客户端配置，不要放 PAT:

```env
VITE_SUPABASE_URL=https://ovdjhdofjysanamgkfng.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_UvP5c6ShzuoYDtnZppd1yA_3L_m13l0
```

## 安全建议

- 不要把 `SUPABASE_ACCESS_TOKEN` 写进任何被 git 跟踪的文件。
- 不要把 PAT 写进 `docs/`、`scripts/`、`.env.example`、README 或部署脚本。
- 本地专用配置应留在仓库外，例如 `<USERPROFILE>/.codex/` 或 `<USERPROFILE>/.gemini/`。
- 如果真实 PAT 曾经提交过 Git 或发给过别人，应立即去 Supabase 后台吊销并重新生成。

## 相关文件

- 迁移目录: `supabase/migrations/`
- Supabase 客户端: `src/lib/supabase.ts`
- 设置脚本: `scripts/setup-supabase.ps1`
