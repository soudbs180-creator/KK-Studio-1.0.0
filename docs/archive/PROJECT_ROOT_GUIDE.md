## Project Root Guide

This guide records the current KK Studio v1.5.4 runtime layout. When it conflicts with older migration notes, use `AGENTS.md`, `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`, `package.json`, and `config/release-manifest.json` as the authority.

### Runtime Layout

- `apps/web/` is the primary desktop Web runtime, built with Vite + React + TypeScript.
- `apps/mobile/` is the Expo mobile workspace. Web code must not import React Native or Expo APIs.
- `packages/shared/` contains cross-runtime pure TypeScript contracts and domain rules.
- `packages/api-client/` is the typed HTTP API boundary used by browser code.
- `packages/ui/` contains design tokens, adapters, and shared UI primitives only.
- `server/` is the Express / VPS backend runtime and transition proxy surface.
- `migrations/` is the only valid location for PostgreSQL DDL.
- `docs/ai-assistant/` is the AI assistant knowledge base and must be updated when assistant, canvas, generation, download, or UI-map behavior changes.
- `scripts/` contains governance, verification, release, and maintenance scripts.
- `tests/` contains unit, integration, contract, and E2E tests.
- `config/` contains release and project configuration, including `config/release-manifest.json`.

### Project Source

These folders usually matter when developing or reviewing changes:

- `apps/web/`: desktop Web application runtime
- `apps/mobile/`: mobile application workspace
- `packages/shared/`: platform-neutral shared code
- `packages/api-client/`: typed HTTP client
- `packages/ui/`: UI token and adapter layer
- `server/`: Express / VPS backend and proxy routes
- `migrations/`: database migrations
- `docs/`: project documentation and AI assistant knowledge
- `tests/`: test suites
- `scripts/`: project automation
- `config/`: release manifest and configuration

### Root Config Files

These stay in the root because tools expect them there:

- `package.json`, `package-lock.json`
- `tsconfig.json`
- `vite.config.ts` or workspace Vite configs referenced by scripts
- `.env`, `.env.example`, `.env.local`
- `.gitignore`, `.editorconfig`, `.npmrc`
- `AGENTS.md`, `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`
- `plans.md`, `implement.md`, `status.md`, `validation.md`
