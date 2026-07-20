Status: historical

# KK Studio Progress Report - v1.6.0

Current version source is `config/release-manifest.json` (`v1.6.0`).
Last reviewed: 2026-07-20.

- `config/release-manifest.json` 是版本真相。
- `apps/web/src/config/appInfo.ts` 作为运行时只读导出。
- `release/publish/stable/manifest.json` 作为 stable 发布清单。

## Current baseline

- Web runtime: `apps/web/`
- Mobile runtime: `apps/mobile/`
- Backend/API: `server/`
- Shared contracts: `packages/shared/`
- Typed transport: `packages/api-client/`
- UI tokens and primitives: `packages/ui/`
- PostgreSQL migrations: `migrations/`
- AI runtime: `CanvasRuntimeState`, `ToolRegistry`, `DurableGenerationQueue`,
  and `AgentRunStore`

## Completed baseline work

- Three collaboration modes (`direct`, `assist`, `takeover`) share one runtime,
  queue and run store.
- Autonomous business actions use structured ToolRegistry calls; assistant
  text and `action://` links are not an execution channel.
- Generation, asset export, project navigation and canvas context are covered
  by the current AI capability matrix.
- Provider, Agent Run, Tool Call, Knowledge and Skill persistence is routed
  through typed API boundaries with owner scoping and verification metadata.
- Current UI direction is canvas-first, low-contrast and semantic-token based;
  the modernization work is tracked in
  `openspec/changes/modernize-ai-first-workspace-ui/`.

## Active next steps

1. Finish the independent `unify-ai-collaboration-modes` baseline and verify
   cross-page mode persistence and pending-run recovery.
2. Close the `harden-ai-control-plane` security and verification gates.
3. Complete the site capability journey from project open through durable batch
   generation, canvas import, arrangement, verification and original ZIP.
4. Migrate touched UI surfaces to `packages/ui` semantic tokens without
   creating a parallel assistant or task state store.
5. Keep the documentation index and governance checks in sync with the source.

## Validation commands

```bash
npm run governance:docs
npm run governance:check
npm run architecture:check
npm run typecheck
npm run build
```

Unrun checks must be recorded in the session handoff; this report does not
claim a command passed merely because it is listed.
