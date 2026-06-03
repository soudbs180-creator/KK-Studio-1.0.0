# KK Studio Project Handoff (v1.5.3)

Last updated: 2026-06-03

## 1. Project Overview

- Project name: `KK Studio`
- Stable version: `v1.5.3`
- Version authority: `config/release-manifest.json`
- Package projection: root `package.json` and workspace package manifests
- Primary rules: `AGENTS.md`
- Primary companion plan: `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`

## 2. Current Runtime Facts

- Primary Web runtime: `apps/web/` (Vite + React 19 + TypeScript + Tailwind + AntD / Lobe UI Bridge)
- Mobile workspace: `apps/mobile/` (Expo)
- Backend runtime: `server/` Express / VPS routes and related proxy behavior
- Shared logic: `packages/shared/`
- Unified API client: `packages/api-client/`
- UI adapter layer: `packages/ui/`
- Database schema changes: `migrations/` only
- AI assistant knowledge base: `docs/ai-assistant/`
- Version governance: `config/release-manifest.json` is the 主版本源.
- Version governance: `apps/web/src/config/appInfo.ts` is the 运行时只读导出.
- Version governance: `release/publish/stable/manifest.json` is the portable stable 发布清单.

Do not describe root `src/` as the current live frontend runtime. Do not describe `.agent` files as the current AI rule baseline. The current AI rule baseline is `AGENTS.md` plus `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`.

## 3. Current AI Assistant Baseline

- Existing assistant entry: `apps/web/src/features/ai-takeover/`
- Existing pieces: `LocalAssistantBrain`, `LLMBrain`, `IntentGate`, `ActionExecutor`, `SafetyPolicy`, `ConfirmationPolicy`, `ProjectContextBuilder`, and a lightweight `toolRegistry.ts`
- Current partial work: `SanitizedProjectContext` already has `runtime?: CanvasRuntimeState`, and `docs/ai-assistant/` has an initial knowledge directory
- Current partial work: `toolRegistry.ts` now exposes legacy action tools plus initial namespaced aliases such as `canvas.getState`, `canvas.getSelectedNodes`, `assets.zipOriginals`, and `generation.createBatchJob`, and records脱敏 `AgentToolCallLog` entries. Alias registration is idempotent so real namespaced tools are not overwritten by legacy wrappers.
- Current partial work: `canvas.arrangeNodes` is registered and delegates to the existing `CanvasContext.arrangeAllNodes(mode)` path through `AITakeoverContext`, preserving selection-first arrange rules.
- Current partial work: `KnowledgeStore` now provides a redacted browser projection/cache for `knowledge.searchProject`, `knowledge.recordChange`, `ui.recordLayoutChange`, and `skills.upsertSkill`; it is not authoritative long-term storage.
- Current partial work: ToolRegistry execution logging now prints redacted `inputSummary` instead of raw tool input, so token-like strings and API-key-like values stay out of console logs.
- Current partial work: `assets.resolveOriginals` and `generation.getJobStatus` are registered as safe preflight/read tools.
- Current partial work: `AITakeoverContext` re-runs safety and confirmation policy on both local and cloud-generated plans before execution
- Important gap: the namespaced registry is still a compatibility layer, not the final `AgentRuntime + ToolRegistry + DurableQueue + KnowledgeSync` split
- Important gap: AI takeover generation queue is still not fully wired end-to-end. `DurableGenerationQueue` exists, is safe to import in non-browser tests, enforces `maxBatchSize=100`, derives stable idempotency keys, and clamps concurrency to `1..8`; executor registration, recovery UX, and layout tagging still need hardening.
- Current partial work: selected-card ZIP download now enforces selected scope, expands selected Prompt child images, de-dupes image nodes, and resolves originals in `originalUrl -> apiResultUrl -> url -> storageId -> localFile` order. ZIP archives always include `manifest.json`, including all-failed manifest-only archives.

## 4. Current Priority Order

1. Keep `AGENTS.md` and `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md` as mandatory dual-entry governance docs.
2. Keep `docs/ai-assistant/` updated whenever assistant, canvas, generation, download, or UI-map behavior changes.
3. Extend `CanvasRuntimeState` from a partial context into a tested runtime contract.
4. Upgrade `ActionExecutor` toward `ToolRegistry + Executor` while preserving legacy action compatibility.
5. Fix selected-card original image ZIP download.
6. Upgrade the AI takeover memory queue into a durable batch job queue.
7. Add knowledge index and skill consistency checks.
8. Add assistant-specific tests for tool registry, selected ZIP, queue, and knowledge sync.

## 5. Validation Guidance

Preferred full validation:

```bash
npm run verify:changes
```

Smaller relevant validation:

```bash
npm run governance:check
npm run typecheck
npm run test:unit
npm run build
npm run check:encoding
```

## 6. Latest Validation

- Passed: `npm run governance:check`
- Passed: `npm run check:encoding`
- Passed: `npm run typecheck`
- Passed: targeted assistant tests for ToolRegistry, CanvasRuntimeState, ConfirmationPolicy, and SafetyPolicy
- Passed: targeted selected ZIP tests in `tests/unit/zip-selected-originals.test.ts`
- Passed: targeted DurableGenerationQueue tests in `tests/unit/durable-generation-queue.test.ts` covering idempotency, max batch size, concurrency clamp, pause/resume, and retry
- Passed: targeted KnowledgeSync tests in `tests/unit/agent-knowledge-sync.test.ts`
- Passed: `npm run build`
- Not run: full `npm run verify:changes`, because this round stayed scoped and the worktree has concurrent changes from the user or another agent

## 7. Handoff Notes For Next Agent

- Always read `AGENTS.md`, `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`, `package.json`, and `config/release-manifest.json` before editing.
- If user or another AI changes files in parallel, inspect `git status` and current diffs first; never revert unrelated work.
- Treat docs that mention `src/` as live runtime, `.agent` as current rules, Netlify as the current backend, or versions before `v1.5.3` as drift unless clearly marked historical/archive.
- For assistant work, prefer small sprint-sized changes and update this file plus `docs/ai-assistant/*` with touched files, validation, and next step.
