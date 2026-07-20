# Change Proposal: modernize-ai-first-workspace-ui

## Status

Proposed. This change defines a gradual migration for the existing workspace;
it does not create a second assistant or claim that the visual migration is
already complete.

## Motivation

The current workspace has accumulated competing panel measurements, a second
task projection, duplicated canvas identifiers and visual guidance based on
high-contrast decorative surfaces. Users need a predictable canvas-first flow:
direct manipulation remains available, AI context is visible when relevant,
and plans, permission, cost and verification are understandable without a
blocking overlay.

## Outcome

- Establish one semantic token and primitive direction in `packages/ui` for
  quiet light/dark workbench surfaces.
- Keep the single existing Assistant surface while adding a global command
  entry, selection-aware suggestions, a plan/permission/verification dock and
  a durable task continuation surface.
- Remove duplicate `canvas-container` IDs, derive canvas positioning from the
  real sidebar width, and make TaskCenter a read-only projection of
  `DurableGenerationQueue` plus `AgentRunStore`.
- Preserve `direct`, `assist` and `takeover` interaction semantics and ensure
  the canvas never receives a full-screen takeover mask.
- Make focus, Escape, radio keyboard behavior, ARIA state, progress narration
  and mobile task visibility part of the acceptance contract.

## Scope

This change covers workspace shell layout, AI dock/task projection, shared UI
tokens and focused accessibility contracts. It may update docs and tests that
describe these surfaces. Business execution remains in the existing
`ToolRegistry`, typed execution context, queue and run store.

## Non-goals

- No `new-ui` directory, replacement assistant, second queue, second run store
  or duplicated business state.
- No autonomous payment, account, secret, database, deletion or publication
  operation.
- No visual-only automation path; AI actions continue through domain tools.
- No broad feature rewrite unrelated to the listed workspace regressions.

## Compatibility

Keep `AssistantCollaborationMode`, `AssistantWorkspaceSurface`,
`CanvasRuntimeState`, `DurableGenerationQueue`, `AgentRunStore`,
`generation.createBatchJob` and `assets.zipOriginals` stable. The legacy
`aiTakeoverMode` boolean remains a `direct`/`takeover` adapter only and is not a
new state source.
