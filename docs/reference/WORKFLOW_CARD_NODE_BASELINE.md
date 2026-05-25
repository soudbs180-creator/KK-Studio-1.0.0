# Workflow Card Node Baseline

This document freezes the current card-first workspace behavior before the
workflow-node migration starts.

## Guiding Rule

Keep the current prompt-card and image-card experience intact.

The workflow graph is a new compatibility layer under the existing UI, not a
replacement for the current card layout.

## Phase 0 Regression Checklist

- Create a prompt card on a blank canvas.
- Generate one or more image cards from that prompt card.
- Confirm child images still attach to the parent prompt card.
- Start a follow-up prompt from an existing image card.
- Drag a prompt card and confirm its child image cards still move with it.
- Drag a standalone image card and confirm it still behaves independently.
- Verify prompt-to-image and image-to-follow-up connection lines still render.
- Disconnect a follow-up connection and confirm the chain updates correctly.
- Multi-select prompt and image cards and move them together.
- Group cards, rename the group, and ungroup it again.
- Save, reload, and confirm the canvas restores prompt cards, image cards, and groups.
- Verify PPT-related prompt flows still export and preview correctly.
- Verify local/browser storage recovery still restores generated images.

## Phase 1 Deliverables

- Add a workflow graph feature flag that defaults to off.
- Add generic workflow graph types that can coexist with the current canvas
  model.
- Extend the canvas schema with an optional workflow field only.

## Explicit Non-Goals

- No rendering rewrite.
- No node execution rewrite.
- No replacement of `promptNodes`, `imageNodes`, or `groups`.
- No generic box-style workflow UI.
