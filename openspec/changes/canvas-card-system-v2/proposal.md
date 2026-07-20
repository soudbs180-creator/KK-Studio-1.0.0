Status: historical

# Change Proposal: canvas-card-system-v2

## Motivation

KK Studio currently has working canvas primitives, but card geometry, render policies,
layout state, workflow utility nodes, drawings, viewport persistence, and AI tools are
owned by separate paths. This lets features exist without sharing the positioning,
selection, visibility, and verification contracts required to work reliably.

## Outcome

- Introduce one versioned presentation and geometry contract for every canvas card.
- Preserve the existing visual language and mobile result feed.
- Make layout direction local to each card group and share one layout engine between UI
  actions, batch generation, and ToolRegistry.
- Add versioned, reversible migration for legacy canvas state.
- Add native notebook and workflow-panel cards without embedding another canvas engine.

## Compatibility

Legacy Prompt, Image, Drawing, and Workflow records remain readable. Runtime adapters
produce V2 scene nodes, and legacy tool names delegate to the new card factory. The
implementation takes architectural inspiration from basketikun/infinite-canvas and
tldraw without copying AGPL source or adding the tldraw SDK.

