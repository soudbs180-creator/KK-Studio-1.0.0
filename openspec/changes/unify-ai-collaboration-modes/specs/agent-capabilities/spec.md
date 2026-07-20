Status: historical

# Delta Spec: agent-capabilities

## ADDED Requirements

### Requirement: Single collaboration mode

The assistant SHALL expose exactly one active collaboration mode from `direct`, `assist`, and `takeover`. UI and runtime behavior SHALL derive from that value instead of independent agent/takeover booleans.

#### Scenario: Switching modes is mutually exclusive

- **Given** the current collaboration mode is `assist`.
- **When** the user selects `takeover`.
- **Then** the canonical mode becomes `takeover`, the assist view is no longer active, and shared canvas/run/queue state is preserved.

### Requirement: Direct interaction remains first-class

In `direct` mode the user SHALL be able to click, drag, select, edit, and submit through the existing canvas UI. The assistant composer SHALL retain ordinary chat behavior and SHALL NOT silently execute AgentRuntime tools.

#### Scenario: User edits while in direct mode

- **Given** the mode is `direct` and a canvas is open.
- **When** the user drags a card and edits its content.
- **Then** the normal `CanvasContext` callbacks update the canvas without requiring an AI conversation or takeover activation.

### Requirement: Contextual assist is confirmation-first

In `assist` mode the assistant SHALL derive suggestions from the current workspace surface and live selection. Selecting a suggestion SHALL only prepare an editable prompt. If the submitted prompt produces executable actions, the system SHALL show an execution preview and SHALL wait for explicit user confirmation before calling those actions.

#### Scenario: Assist suggests an action for selected images

- **Given** the mode is `assist` and the current selection contains image nodes.
- **When** contextual suggestions are rendered.
- **Then** suggestions may offer same-style variants or selected-original export, and each suggestion carries the exact current target IDs without changing the canvas.

#### Scenario: Assist plans but does not auto-execute

- **Given** the mode is `assist`.
- **When** the user submits a request that yields an executable plan.
- **Then** the plan is presented as a confirmation-first execution preview and no tool handler runs until the user confirms it.

### Requirement: Takeover uses the canonical AgentRuntime

In `takeover` mode the assistant SHALL use the existing `IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor -> Verification -> Memory / Knowledge Update` chain. Low-risk operations MAY execute according to policy; confirmation, dangerous, costly, or broad-impact operations SHALL still require a run-bound grant.

#### Scenario: High-risk takeover step waits for confirmation

- **Given** the mode is `takeover` and a plan contains a confirmation-required batch operation.
- **When** PermissionPolicy evaluates the step.
- **Then** the Agent Run records `needs_confirmation` and Executor does not invoke the tool until a valid grant for that run is supplied.

### Requirement: Direct and AI actions observe shared live canvas state

All collaboration modes SHALL use the same `CanvasContext`. Before each ToolRegistry handler and verification step, the runtime SHALL re-read the active canvas, selected node IDs, and `CanvasRuntimeState` through fresh getters rather than relying only on the initial planning snapshot.

#### Scenario: Selection changes during a multi-step run

- **Given** an Agent Run has more than one tool step.
- **When** the user makes a permitted direct selection change before the next step begins.
- **Then** the next handler and its verification receive the refreshed canvas and selection state.

### Requirement: Mode and pending work survive UI lifecycle changes

The selected collaboration mode SHALL persist in localStorage. `AgentRunStore` SHALL restore a pending run when the Provider mounts, and `DurableGenerationQueue` SHALL remain authoritative for queued generation work. Switching modes or collapsing the assistant surface SHALL NOT clear those stores.

#### Scenario: Pending confirmation is restored

- **Given** an Agent Run is waiting for confirmation and the assistant Provider is remounted.
- **When** the Provider initializes.
- **Then** it restores the pending run and its execution preview without treating the remount as confirmation or creating a duplicate run.

### Requirement: No implied unified undo transaction

The collaboration-mode contract SHALL NOT claim a new cross-tool or cross-page undo transaction. Tools SHALL continue to use their existing verification, idempotency, compensation, and canvas undo capabilities where available.

#### Scenario: Multi-tool plan reports its real recovery boundary

- **Given** a confirmed plan contains multiple tools.
- **When** a later tool fails verification.
- **Then** the run reports the failure and uses existing tool-specific recovery behavior without asserting that every earlier external side effect was atomically undone.
