Status: historical

# Design: modernize-ai-first-workspace-ui

## 1. One workspace composition

```text
Global command bar
        |
Canvas <-> selection context rail
        |
Assistant dock (plan -> permission -> cost -> execution -> verification)
        |
Persistent task continuation (Queue + AgentRun read-only projection)
```

The canvas remains mounted and interactive while the dock opens, collapses or
switches collaboration mode. The dock reads `AssistantExecutionContext` and
never owns a copy of generation jobs or Agent runs.

## 2. State ownership

| Concern | Authority | UI role |
| --- | --- | --- |
| Canvas/page/selection | `CanvasRuntimeState` and live host getters | Read and subscribe; do not cache a stale plan closure. |
| Generation jobs | `DurableGenerationQueue` | Project a filtered snapshot and dispatch domain controls. |
| Agent runs | `AgentRunStore` | Project plan/permission/verification stages. |
| TaskCenter | Queue + Run projection | No create/update/archive state of its own. |
| Theme/spacing/focus tokens | `packages/ui` | Shared semantic primitives only. |

Archiving one task uses its stable job/run identifier and must not hide or
mutate sibling jobs. A refresh or surface change rehydrates the same stores;
it never replays a completed generation step.

## 3. Layout and responsive behavior

- `canvas-container` is a single stable DOM ID. Child surfaces use scoped class
  names or data attributes rather than duplicate IDs.
- Canvas offsets are computed from the measured, rendered sidebar width and
  toolbar rails. CSS and runtime use the same token/measurement source; no
  hard-coded duplicate width is allowed.
- Desktop keeps the dock beside the canvas. Tablet uses a resizable side sheet.
  Mobile uses a bottom continuation surface for plans and tasks while keeping
  a visible canvas context and next action.
- Opening AI context does not add a page-wide backdrop. Only modal confirmation
  and genuinely blocking dialogs may use a scoped scrim.

## 4. Interaction and accessibility

- Collaboration mode control exposes one `radiogroup` with three `radio`
  options; arrow keys move the selection and `Space`/`Enter` commit it.
- Open panels trap focus only while modal; `Escape` closes the topmost layer and
  restores focus to the trigger.
- Plan cards expose count, cost summary, impact scope, confirmation state and
  cancellation/recovery affordances as text and ARIA state.
- Queue and verification progress use a polite live region with concise state
  changes. Color is never the only status signal.
- Keyboard focus, zoom, narrow widths and long labels must not overlap or move
  the canvas unexpectedly.

## 5. Visual tokens

`packages/ui` owns semantic canvas, surface, border, text, accent and status
tokens for both themes. New workspace code consumes tokens and existing base
components. Gradients, heavy blur, thick shadows and oversized decorative
cards are not part of this direction.

## 6. Migration sequence

1. Add contract tests and measurements for the current shell; remove duplicate
   IDs and reconcile sidebar width calculations.
2. Replace TaskCenter's mutable task copy with a Queue/Run projection.
3. Migrate the existing Assistant dock and selection suggestions to semantic
   primitives while preserving route and mode compatibility.
4. Add focus, keyboard, live-region and mobile continuation behavior.
5. Record each stable surface change in `docs/ai-assistant/ui-map.md` and run
   focused smoke checks plus architecture/governance/type/build gates.
