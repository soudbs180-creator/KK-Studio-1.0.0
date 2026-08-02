# KK Studio Canvas-First Workspace UI

Status: reference visual direction for KK Studio v1.6.1.
Last reviewed: 2026-07-20.
Owner: `packages/ui` tokens and primitives; feature composition remains in
`apps/web/`.

## Direction

KK Studio is a professional creative workbench. The canvas is the primary
workspace, while AI plans, permissions, cost estimates and verification stay
visible without covering the work. The visual language is quiet, low-contrast
and information-dense: semantic surfaces, thin borders, restrained elevation,
and one clear accent for the current action.

Do not introduce a second visual system, a marketing-style hero, full-screen
assistant overlays, decorative gradients, heavy blur, or oversized rounded
cards. A panel should earn its frame by containing a focused tool, a repeated
item, or a confirmation step.

## Semantic tokens

Tokens live in `packages/ui`; feature CSS consumes token names rather than
hard-coded colors. Light and dark themes use the same semantic roles.

| Role | Light intent | Dark intent |
| --- | --- | --- |
| `--kk-color-canvas` | neutral warm-white workspace | near-black workspace |
| `--kk-color-surface` | quiet raised surface | charcoal raised surface |
| `--kk-color-surface-muted` | low-emphasis panel fill | low-emphasis panel fill |
| `--kk-color-border` | subtle hairline | subtle hairline |
| `--kk-color-text` | high-contrast ink | high-contrast text |
| `--kk-color-text-muted` | secondary copy | secondary copy |
| `--kk-color-accent` | one branded action color | same semantic accent, adjusted for contrast |
| `--kk-color-success/warning/danger` | status meaning only | status meaning only |

Use the token scale for spacing, control heights and focus rings. Do not add a
one-off color because a panel is visually empty; hierarchy comes from spacing,
labels and state, not decoration.

## Workspace hierarchy

1. **Global command entry**: the top bar exposes search and the AI/command
   entry. It stays available on every workspace surface.
2. **Canvas**: owns the largest continuous area and remains directly
   interactive in every collaboration mode.
3. **Context rail**: selection-aware suggestions appear near the active
   context. A suggestion fills a draft; it never executes a business action.
4. **Assistant dock**: the right side shows the plan, permission, cost,
   progress and verification evidence. It can collapse without unmounting the
   Agent Run or durable queue.
5. **Task rail**: persistent generation and Agent work appears at the bottom
   or as a mobile continuation surface. It is a read-only projection of
   `DurableGenerationQueue` and `AgentRunStore`.

No assistant state should be represented by a second task store or by a DOM
selector. Domain actions go through `ToolRegistry` and the typed execution
context.

## Controls and interaction

- Use familiar icons for undo, redo, zoom, download and collapse; provide a
  tooltip for an icon whose meaning is not obvious.
- Use segmented controls or a radio group for `direct`, `assist` and
  `takeover`. Only one mode can be selected, and the selected state must be
  announced to assistive technology.
- Keep controls at a stable size. Text wraps or truncates inside its parent;
  it must never move neighboring canvas or task content.
- Focus moves into a newly opened dialog or sheet, `Escape` closes the topmost
  dismissible layer, and focus returns to the invoking control.
- Progress is exposed with an accessible live region. Error, partial success,
  retry and cancellation are distinct states, not only color changes.
- On small screens, the canvas remains the primary view. Plans and tasks use a
  bottom sheet or continuation list with a visible status and next action.

## Collaboration modes

`direct` keeps ordinary controls and chat available; it does not run Agent
tools. `assist` mirrors the current page and selection, offers editable
suggestions, and requires confirmation before any executable plan. `takeover`
may run safe reads, navigation and explicitly reversible local work, while
generation, batch, cost, deletion, publication, account and payment actions
remain confirmed or forbidden. None of the modes may add a canvas-blocking
mask.

## Motion and elevation

Use short, purposeful transitions for state changes and respect reduced-motion
preferences. Prefer a one-layer elevation and a thin border over stacked
shadows. Avoid animating the entire canvas, changing layout during hover, or
using motion to communicate information that is not also expressed in text or
an accessible state.

## Migration rule

When an existing feature is touched, move its repeated visual values to
`packages/ui` tokens and use the nearest shared primitive. Do not create a
`new-ui` tree or a parallel assistant. Update `docs/ai-assistant/ui-map.md`
only when a stable surface or route changes; business semantics remain in the
ToolRegistry and service contracts.
