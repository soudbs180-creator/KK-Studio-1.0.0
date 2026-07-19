# Delta Spec: agent-capabilities

## ADDED Requirements

### Requirement: Site capabilities use domain tools

Agent plans SHALL express business intent through domain tools and SHALL NOT create one tool per visual control or simulate UI clicks.

#### Scenario: User asks to open a project

- **Given** the requested project exists in the current user's CanvasContext.
- **When** Planner prepares the action.
- **Then** it uses `project.open` with the concrete project ID and the tool invokes the typed project port without querying or clicking DOM elements.

#### Scenario: User toggles a local panel

- **Given** an action only expands a menu, collapses a panel, changes a filter tab or moves a floating surface.
- **When** the action catalog is inspected by Agent.
- **Then** it has no ToolRegistry name and cannot be autonomously triggered.

### Requirement: Site ports read live state

Project, workspace, history, preference and asset tools SHALL read the latest host state at execution time rather than a stale plan-time React closure.

#### Scenario: Project changes between plan steps

- **Given** a plan opens project B and then reads canvas selection.
- **When** the first step completes.
- **Then** the second step reads project B's active CanvasRuntimeState and cannot return project A's selection.

### Requirement: Account and billing capabilities are read only

Agent tooling MAY return redacted account and billing summaries. It SHALL NOT expose tools for recharge submission or approval, payment confirmation, balance mutation, key content, token content or account privilege mutation.

#### Scenario: User asks Agent to add credits

- **Given** takeover mode is active.
- **When** the user asks Agent to recharge, approve a recharge or change balance.
- **Then** no autonomous mutation tool exists; Agent may only navigate the user to the appropriate manual surface.

### Requirement: Durable generation journey does not duplicate work

The canonical journey SHALL use the existing DurableGenerationQueue and CanvasRuntimeState. Refreshing, changing page surface or collapsing the Assistant SHALL NOT create a second Queue, lose persisted work, repeat completed Provider calls or import duplicate output nodes.

#### Scenario: Assistant is collapsed after batch submission

- **Given** `generation.createBatchJob` has persisted a job with a Run/Step idempotency key.
- **When** the Assistant is collapsed and reopened while the job runs.
- **Then** the same job continues, no second job is created, and its outputs are imported and arranged once.

#### Scenario: Page refresh restores a partially completed batch

- **Given** a persisted job contains completed and unfinished prompt items.
- **When** the page reloads and Queue recovery runs.
- **Then** completed Provider items are not resubmitted, unfinished safe-to-retry items resume according to Queue policy, and the job remains bound to its original canvas ID.

### Requirement: The complete journey exposes verification evidence

The fixed acceptance journey SHALL expose the selected assets, plan count/cost/impact, durable job ID, imported canvas node IDs, arrangement result, failed item summary and ZIP manifest as structured evidence.

#### Scenario: Some generation items fail

- **Given** a confirmed batch finishes with successful and failed prompts.
- **When** Agent verifies the job and exports successful originals.
- **Then** `generation.getJobStatus` reports exact failed counts, `assets.zipOriginals` preserves a manifest for successful and failed assets, and the Run completes with partial-success evidence rather than claiming full completion.
