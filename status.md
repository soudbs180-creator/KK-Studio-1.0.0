# KK-Studio v1.4.2 Refactor Status

Last updated: 2026-04-29

## Current Position

- Workspace: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0`
- Active plan: v1.4.2 progressive refactor in `plans.md`
- Current milestone: Milestone 1 complete; Milestone 2 connector renderer hardening in progress
- Branch policy: continue on current branch unless the user explicitly asks otherwise
- `apps/api/`: compatibility checks only
- `apps/web/`: future migration target after `src/` boundaries are stable

## Baseline Snapshot

- `src/App.tsx`: 10395 lines
- `src/app/useConnectorRenderer.ts`: 272 lines
- `src/context/CanvasContext.tsx`: 5434 lines
- `src/services/auth/keyManager.ts`: 5280 lines
- Existing extracted app hooks:
  - `useAppPromptBarProps.ts`
  - `useCanvasDragConnection.ts`
  - `useCanvasNodeSelection.ts`
  - `useCanvasSelectionBox.ts`
  - `useConnectorRenderer.ts`
  - `useDraftNodeSync.ts`
  - `useGenerationPlacement.ts`
  - `useGenerationReferenceImages.ts`
  - `usePromptGroupDragHandlers.ts`
  - `useSelectionMenuOverlay.ts`
  - `useWorkflowActions.ts`
  - `useWorkflowSourceResolvers.ts`

## Milestone Progress

### Milestone 1: Refactor Ledger Alignment

Status: complete.

Scope:
- Replace the old recovery-first ledger language with the active v1.4.2 refactor plan.
- Keep recovery history as background only.
- Define milestone gates, validation commands, and commit policy.

Changed files staged for this milestone:
- `plans.md`
- `implement.md`
- `status.md`
- `validation.md`

Validation:
- `npm.cmd run governance:agent-docs`: passed.
- `npm.cmd run check:encoding`: passed.

### Milestone 2: Connector Renderer Extraction Hardening

Status: in progress via GPT-5.5 xhigh worker subagent.

Known baseline:
- `src/app/useConnectorRenderer.ts` already exists.
- `src/App.tsx` imports and calls `useConnectorRenderer`.
- The hook should be hardened with `CanvasPerformanceProfile`, `CanvasPoint`, and explicit `UseConnectorRendererResult`.

Planned validation:
- Connector throttling/local performance/live scene targeted tests.
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run check:encoding`

### Milestones 3-9

Status: pending. GPT-5.5 xhigh explorer subagents are mapping future extraction risks for prompt group layout, generation runtime, PPT runtime, and ecommerce runtime.

## Validation Log

- 2026-04-29 Milestone 1:
  - `npm.cmd run governance:agent-docs`: passed.
  - `npm.cmd run check:encoding`: passed.

## Worktree Safety Note

Unrelated in-progress UI refit files were present while this milestone was committed. They are intentionally left unstaged and must not be reverted or swept into refactor commits.

## Risk Log

- The largest risk is accidental behavior drift in `App.tsx` while extracting tightly coupled runtime logic.
- Stage One must avoid broad formatting churn so diffs stay reviewable.
- Ecommerce runtime remains last because it has the highest cross-reference count.
- Historical recovery files and local temporary files must not be reintroduced into commits.
