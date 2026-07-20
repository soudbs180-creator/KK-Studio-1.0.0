Status: historical

# Delta Spec: workspace-ui

## ADDED Requirements

### Requirement: The canvas remains the primary interactive surface

The workspace SHALL keep direct canvas manipulation available in every
collaboration mode, and opening or collapsing the Assistant SHALL NOT add a
full-screen blocking overlay.

#### Scenario: User opens the Assistant while editing

- **Given** the user is dragging or selecting canvas nodes.
- **When** the Assistant dock opens or changes mode.
- **Then** the canvas remains mounted, its selection is preserved, and only a
  scoped confirmation dialog may temporarily block input.

### Requirement: TaskCenter is a read-only projection

TaskCenter SHALL derive active task rows from `DurableGenerationQueue` and
`AgentRunStore` and SHALL address archive, cancel, retry and resume operations
by stable job/run identifiers.

#### Scenario: Archive one completed task

- **Given** two completed jobs are visible.
- **When** the user archives the first job.
- **Then** only that job's projection is archived; the second job and its run
  remain visible and unchanged.

### Requirement: Layout uses one measured sidebar source

The canvas offset SHALL use the actual rendered sidebar width and SHALL NOT
depend on duplicate `canvas-container` IDs or a second width constant.

#### Scenario: Sidebar is resized

- **Given** the real sidebar changes width on desktop or tablet.
- **When** the resize is committed.
- **Then** the canvas position and hit testing use the same measured width
  without overlap or stale offset.

### Requirement: Collaboration controls are accessible and mutually exclusive

The mode picker SHALL expose `direct`, `assist` and `takeover` as one keyboard-
navigable radio group with an accurate ARIA selected value.

#### Scenario: Keyboard changes mode

- **Given** focus is on the selected mode.
- **When** the user presses an arrow key and then `Space`.
- **Then** exactly one mode is selected, the selection is announced, and the
  mode persists without clearing Queue or Agent Run state.

### Requirement: Progress and verification are observable

The Assistant and task continuation surface SHALL distinguish running,
confirmation-required, partial success, retryable failure, rolled-back failure
and cancelled states with text and live-region announcements.

#### Scenario: Batch partially fails

- **Given** a durable batch has successful and failed items.
- **When** verification completes.
- **Then** the UI reports the exact partial result and available retry/export
  actions rather than showing a generic success state.
