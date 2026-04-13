# KK Studio Premium Dual-Theme Settings Redesign

**Goal**

Rebuild the KK Studio settings center into one premium, route-driven workbench that is equally clear in light and dark themes, exposes API management as explicit workflow stages, and makes every blocked or readonly state honest to the user.

**Problem Summary**

- The current settings experience still has one production entry but two competing mental models: `App.tsx` drives modal session state while `SettingsPanel.localized.tsx` owns a nested `MemoryRouter`.
- The desktop and mobile shells already exist, but some routes still redirect or collapse back into dashboard behavior, which breaks overview-to-detail continuity.
- API management has enough business semantics to support a high-end workbench, but its view-state contract is still mostly boolean flags, so readonly, syncing, unauthenticated, and local-runtime failure states can feel like broken buttons instead of explicit modes.
- Theme ownership is split between global tokens, settings-only shell tokens, and component-local literal styles. This creates visual drift across light and dark themes.
- The current settings overview and toolbar still surface too many equal-weight actions, which weakens first-screen comprehension.

**Approved UX Outcomes**

1. Settings has one formal entry, one navigation registry, one route model, and one back-navigation model.
2. The first screen answers three questions immediately:
   - what this place is
   - what the current system status is
   - what the next primary action is
3. API management is staged, not blended:
   - list
   - create
   - edit
   - diagnostics
   - readonly
   - syncing
4. Light and dark themes are structurally identical. Only color, material depth, and emphasis shift between themes.
5. Disabled, readonly, syncing, and unavailable states are always explicit through icon, text, and recommended next step.
6. Glass and blur are reserved for shell/navigation surfaces. Content cards, forms, and dense data surfaces stay crisp.

## Phase 0 Constraints

- The current environment does not expose the `agent-browser` command, so live browser screenshots, console output, and network evidence are blocked in this turn.
- This redesign must therefore record Phase 0 as a prerequisite verification stream rather than pretending it is already complete.
- Phase 0 deliverable:
  - stable settings URL capture
  - shell screenshot capture
  - console error capture
  - non-2xx network capture

## Information Architecture

### Single Entry Model

- Production settings entry stays `src/components/settings/SettingsPanel.tsx`.
- `SettingsPanel.tsx` must remain a thin compatibility export that delegates to one canonical implementation.
- `App.tsx` must stop owning parallel settings sub-navigation state beyond:
  - open or close
  - requested initial route
  - optional supplier preselection
- The canonical shell owns the active route, current view meta, mobile back behavior, and internal stage transitions.

### Single Navigation Registry

The registry must be the only owner of:

- `view id`
- `label`
- `description`
- `icon`
- `section`
- `path`
- `legacy alias`
- `primary action label`
- `status summary label`

### Single Back Model

- From dashboard-level routes: back closes settings.
- From nested API editor and diagnostics routes: back returns to the API list stage first.
- From mobile home: back closes settings.
- From dashboard cards or cross-app entrypoints: any unreachable destination must surface a fallback message instead of silently collapsing to another view.

## Dual-Theme Design Principles

### Theme Parity

- Light and dark themes must use the same spacing, type scale, radius scale, and control heights.
- Theme switching must not change:
  - layout
  - component height
  - clickable area
  - navigation ordering

### Color Rules

- One calm blue accent line is the only primary emphasis color.
- Green, amber, and red are semantic-only colors.
- Neutral surfaces remain dominant in both themes.
- Risk must not be encoded by color alone. Pair every semantic state with iconography and text.
- All text and interactive contrast must meet WCAG AA.

### Material Rules

- Shell and navigation layers may use premium blur, gradient, and atmospheric surfaces.
- Cards, tables, editor fields, and diagnostic panels must remain mostly solid and scan-first.
- Decorative color fields must never compete with the primary action or status warning.

## Token Contract

The redesign uses four token layers:

1. Foundation tokens
   - color ramps
   - spacing
   - radius
   - shadow
   - blur
   - motion
   - typography
2. Semantic tokens
   - background
   - surface
   - text
   - border
   - focus
   - info
   - success
   - warning
   - danger
   - emphasis
3. Component tokens
   - buttons
   - inputs
   - cards
   - navigation items
   - segmented controls
   - status badges
   - dialogs
4. Page alias tokens
   - settings shell atmosphere only

### Fixed Scales

- Typography:
  - `32`
  - `24`
  - `20`
  - `17`
  - `15`
  - `14`
  - `12`
  - `11`
- Radius:
  - `8`
  - `10`
  - `12`
  - `16`
  - `20`
  - `28`
  - `full`
- Motion:
  - `120ms`
  - `180ms`
  - `240ms`
  - `320ms`

### Ownership Rules

- Global typography, radius, and motion tokens must not be redefined inside settings child trees.
- Settings shell tokens may alias semantic tokens for atmosphere, but must not fork the component scale.
- Shared primitives in `SettingsScaffold.tsx` and `src/components/settings/ui/index.tsx` must consume token variables instead of literal radius or font-size utilities where practical.

## Settings Center UX

### First Screen Contract

The overview screen must show:

1. Workbench identity
2. Current account or runtime status summary
3. One primary next action

The overview must not present multiple competing primary buttons at the same hierarchy level.

### Visual Hierarchy

- Typography and spacing create hierarchy first.
- Color, blur, and shadow only reinforce that hierarchy.
- Icons are semantic, not decorative:
  - human/account
  - service/runtime
  - supplier/provider
  - system
  - storage
  - state

### Overview Actions

- Keep one primary action in the page header or hero.
- Secondary actions belong in grouped cards or toolbar utilities.
- Status cards must tell the user what to do next, not only what is wrong.

## API Management Workflow

### Stages

The API workbench must distinguish these six states explicitly:

1. `unauthenticated`
   - enter when the user is not signed in
   - exit after auth state becomes valid
2. `local-api-unavailable`
   - enter when the local API runtime is unreachable and no editable runtime surface is available
   - exit when reachability is restored
3. `readonly-fallback`
   - enter when cloud or cached snapshot data exists but the editable runtime is not available
   - exit when editable runtime data is restored
4. `syncing`
   - enter when readonly snapshot is displayed while runtime data is hydrating
   - exit when runtime payload is resolved or the fallback is abandoned
5. `editable`
   - enter when the authenticated editable runtime is healthy enough to create, edit, toggle, or delete endpoints and providers
   - exit on auth loss, runtime loss, or readonly fallback
6. `diagnostics`
   - enter when the user expands health and debugging details
   - exit when diagnostics are collapsed or route returns to list or editor

### Stage Separation

- List mode shows inventory, status, and entry actions.
- Create and edit modes live on dedicated nested routes.
- Diagnostics are present as their own explicit surface or card region, not mixed into every list row.
- Readonly and syncing are bannered modes that explain why editing is unavailable and what the user can do next.

### Primary Stage Actions

- Official list:
  - one primary create action
- Provider list:
  - one primary create action
- Readonly mode:
  - one primary recovery action
- Local API unavailable:
  - one primary diagnostics or reconnect action

## Component Boundaries

Implementation decomposition must follow this order:

1. unify settings entry and route registry
2. extract settings shell, navigation, header, cards, and form primitives
3. split the API management workbench controller
4. finish visual refinement and theme parity

API management should converge toward these blocks:

- workbench controller
- official endpoints module
- provider module
- shared presentation module
- persistence and diagnostics adapter module

## State Honesty Rules

- Unauthenticated buttons must explain the lock reason and next step.
- Readonly fallback must be labeled as readonly, not merely disabled.
- Syncing must communicate that current data may still update.
- Local runtime failures must offer diagnostics or recovery, not silent failure.
- Every destructive action needs pre-submit consequence text and should prefer undo, rollback, or dry-run when available.

## Acceptance Checks

### Kid Wow Check

Pass when the first settings screen feels obviously premium and intentional within three seconds, without relying on decorative overload.

### Mom Comprehension Check

Pass when a non-technical user can identify where they are, whether the system is healthy, and what the next action is without exploring multiple panels.

### Theme Parity

Pass when switching between light and dark changes only material and color treatment, never structure or control geometry.

### Icon Semantics Check

Pass when a user can visually distinguish entity types and state types without reading every label.

## Implementation Sequence

1. Phase 0: live verification tooling and evidence capture
2. Phase 1: settings single-entry and single-route-shell convergence
3. Phase 2: token-base and settings component token cleanup
4. Phase 3: API management controller and stage separation
5. Phase 4: theme parity, icon semantics, and copy polishing
6. Phase 5: migrate PromptBar, canvas toolbar, and other high-frequency surfaces into the new token system

## Out Of Scope For This Pass

- PromptBar redesign
- canvas toolbar redesign
- broad cross-app theme migration outside settings-centered work
- vendor-routing behavior changes unrelated to the settings workbench shell

## Verification

- `npm run governance:agent-docs`
- targeted `node --test` coverage for settings registry, settings shell, API state contract, and theme token contract
- `npm run typecheck`
- `npm run check:encoding`
