## Project Root Guide

This repository is in a deliberate migration state, so the quickest way to stay oriented is to separate the current live runtimes from the target layout.

### Runtime Layout (严格 AGENTS)

- `apps/web/` 为唯一的桌面端 Web 前端运行时。
- `apps/mobile/` 为手机端 Expo 应用。
- `packages/shared/` 为共享包。
- `packages/api-client/` 为统一 API 客户端。
- `netlify/functions/` 为唯一的后端 API 服务。
- `payment-server/` 仅处理 Stripe Webhook 例外。
- `migrations/` 为 PostgreSQL 数据库迁移。
- `scripts/` 为开发与 CI 脚本。
- `docs/` 为中文规范文档。
- `config/` 为配置目录 (包含 config/deploy)。
- `tests/` 为测试用例。
- `.claude/` 为 Claude Agent 配置。

### 1. Project source

These are the folders that usually matter when you are developing or deploying:

- `apps/web/`: target web runtime
- `apps/mobile/`: target mobile app runtime
- `packages/shared/`: shared codebase
- `packages/api-client/`: API client
- `packages/ui/`: UI system tokens
- `netlify/functions/`: serverless API functions
- `payment-server/`: payment webhook shell
- `config/`: project config data
- `migrations/`: database migrations
- `tests/`: tests
- `scripts/`: project scripts
- `docs/`: project docs, reports, screenshots

### 2. Root config files

These stay in the root because tools expect them there:

- `package.json`, `package-lock.json`
- `tsconfig.json`
- `netlify.toml`
- `.env`, `.env.example`, `.env.local`
- `.gitignore`, `.editorconfig`, `.npmrc`
- `plans.md`, `implement.md`, `status.md`, `validation.md`, `AGENTS.md`
