# KK Studio v1.4.9

KK Studio is a multimodal canvas workspace for image, video, audio, and presentation workflows. It combines prompt authoring, model routing, user API management, workspace sync, and operational tooling in a single app.

## Highlights

- Visual canvas for prompts, assets, and generated results
- Multiple model routes, including official endpoints and third-party providers
- VPS-backed login, billing, workspace sync, and admin operations through the KK API
- Built-in settings surfaces for billing, diagnostics, logging, and provider management

## Tech Stack

- React 19.2.5
- TypeScript 6.0.2
- Vite 8.0.8
- Node.js 24.x
- PostgreSQL-backed VPS API runtime

## Tech Layout & Runtime

根据严格 AGENTS 路线：
- `apps/web/` 为唯一的桌面端 Web 前端运行时。
- `apps/mobile/` 为手机端 Expo 应用。
- `packages/shared/` 为共享包。
- `packages/api-client/` 为统一 API 客户端。
- `netlify/functions/` 为唯一的后端 API 服务。
- `payment-server/` 仅处理 Stripe Webhook 例外。

## Local Development

1. Copy `.env.example` to `.env` if you need frontend-level overrides.
2. Install dependencies with `npm install`.
3. Start the local stack with `npm run dev:start`.
