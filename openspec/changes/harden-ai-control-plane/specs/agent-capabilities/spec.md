Status: historical

# Delta Spec: agent-capabilities

## ADDED Requirements

### Requirement: Assistant text cannot grant execution

Assistant-rendered `action://` text SHALL NOT be parsed and automatically executed. Autonomous work SHALL enter the canonical Planner and ToolRegistry path; action links MAY execute only after an explicit user click.

#### Scenario: Assistant message contains an action link

- **Given** takeover mode is active and an Assistant message contains `action://open-settings`.
- **When** the message renders.
- **Then** no local handler, DOM click, navigation, configuration write or ToolRegistry call occurs until the user clicks the link.

### Requirement: Confirmation is user-sourced and run-scoped

A Run status SHALL NOT be treated as confirmation. Confirm and dangerous tools SHALL require a fresh grant issued from an explicit user action and bound to the authenticated owner, Run, Plan, exact Steps, inputs, idempotency keys, page, project, canvas, selection, model and mutable configuration snapshot shown in the preview.

#### Scenario: Pending Run is restored

- **Given** a restored Run has status `waiting_confirmation`.
- **When** Executor is invoked without a user-sourced grant.
- **Then** the Run remains pending and no confirmation-required handler executes.

#### Scenario: A confirmation-required Run has a tampered status

- **Given** a plan requires confirmation but its restored Run status is `running` or `waiting_execution`.
- **When** Executor is invoked without the exact user grant.
- **Then** the Run returns to `waiting_confirmation` and no mutating handler executes.

#### Scenario: Scope changes after preview

- **Given** the user previews and confirms a plan for owner A, canvas X, selection S and model M.
- **When** owner, canvas, selection, model or mutable configuration differs before or during execution.
- **Then** execution stops fail-closed, no later step runs, and no operation is redirected to the new scope.

#### Scenario: A relative retry target changes before confirmation

- **Given** “retry the latest failed batch” resolves to Job A while the plan is created.
- **When** a newer failed Job B appears before the user confirms.
- **Then** the stored plan and grant remain bound to Job A, its `updatedAt` and exact retryable Prompt IDs; execution never selects Job B.

#### Scenario: The frozen retry scope changes

- **Given** a retry plan was previewed for one concrete Job revision and retryable Prompt set.
- **When** that Job revision or Prompt set differs before execution.
- **Then** `generation.retryJob` returns `STALE_RETRY_TARGET`, makes no Provider call, and requires a new preview instead of resolving a latest/current selector.

#### Scenario: An AI browser plan names the active tab dynamically

- **Given** an inspect or DOM-write action contains `active_tab`, `current_page` or another dynamic browser sentinel.
- **When** the plan is validated or confirmed.
- **Then** it is rejected before Browser Bridge dispatch; AI browser targets currently accept only a public HTTP(S) URL frozen in the plan. Direct user-click Bridge commands MAY still resolve `active_tab` outside Agent execution.

### Requirement: Mutating tools expose executable control metadata

Every registered mutation tool SHALL expose input validation, an idempotency requirement, impact and cost summaries, recovery capabilities, failure categories, and outcome verification.

#### Scenario: A legacy mutation tool is registered

- **Given** a legacy tool definition has an object JSON Schema but omits control metadata.
- **When** ToolRegistry registers it.
- **Then** Registry supplies conservative metadata, schema-based validation, an idempotency key and baseline verification without weakening its declared permission.

#### Scenario: A non-reversible mutation is classified safe

- **Given** a mutation persists a user record and has no guaranteed undo capability.
- **When** ToolRegistry normalizes its control metadata.
- **Then** it requires confirmation and cannot execute as an autonomous `safe` mutation.

#### Scenario: An external browser mutation is retried with the same key

- **Given** a Browser Bridge generation, draft or DOM write command already started with an idempotency key.
- **When** the same tool input is executed again with that key.
- **Then** the command ID and payload carry the same key and the Bridge receives no duplicate in-page execution.

#### Scenario: A queue control has a verified cached result

- **Given** resume previously verified a Job as queued and its idempotent result was cached.
- **When** that Job is paused again before the same resume request is repeated.
- **Then** Registry rejects the stale cache using the live `DurableGenerationQueue` state and executes resume again.

#### Scenario: A confirmed workflow contains live nested tools

- **Given** a `workflow.controlPanel` parent action is confirmed but its mutable child steps and inputs were not expanded into the plan.
- **When** an AI-triggered run or retry reaches the parent handler.
- **Then** the handler refuses to execute the unlisted child tools; only a direct user action may use the current compatibility path.

### Requirement: Plan verification determines completion

Executor SHALL consume the `verification` rule for every Agent plan step. Handler return alone SHALL NOT mark the step or Run complete.

#### Scenario: Batch handler returns without a durable job

- **Given** a step requires `queue_job` verification.
- **When** its handler returns but neither output nor `DurableGenerationQueue` contains the planned job.
- **Then** the step records a verification failure and dependent steps do not run.

#### Scenario: Export has failed items

- **Given** a step requires `asset_manifest` verification.
- **When** the ZIP manifest reports successful and failed items.
- **Then** the step records `partial_success` and the Run completes as `completed_with_errors`.

#### Scenario: Every export item fails

- **Given** a step requires `asset_manifest` verification.
- **When** the ZIP contains only a real manifest with failed items and no successful asset.
- **Then** the real manifest is preserved, the step records `retryable_failure`, and dependent steps do not run.

### Requirement: Running cancellation is terminal for the execution graph

Cancelling a running Agent Run SHALL abort the execution signal, prevent later dependent steps, and SHALL NOT be overwritten by a late handler completion.

#### Scenario: Current handler finishes after cancellation

- **Given** the first step is running and a second step depends on it.
- **When** the user cancels before the first handler resolves.
- **Then** the first call is recorded as cancelled, the second handler is never invoked, and the Run remains `cancelled`.

#### Scenario: Cancellation arrives while verification is running

- **Given** a handler has returned and its asynchronous verifier is still running.
- **When** the user cancels the Run before verification resolves.
- **Then** the Tool Call and plan step are recorded as `cancelled`, never as successful.

#### Scenario: Handler rejects after cancellation

- **Given** the user cancels while a handler is awaiting an external request.
- **When** that request later rejects with an ordinary network error.
- **Then** the abort signal wins and the Tool Call remains classified as `cancelled`, not `failed`.

#### Scenario: Cancellation targets a terminal Run

- **Given** a Run is already `completed`, `completed_with_errors`, `failed` or `cancelled`.
- **When** a stale UI action requests cancellation.
- **Then** the terminal status and audit record remain unchanged.

#### Scenario: A durable job appears after the abort signal

- **Given** a started generation step is awaiting its handler when the user cancels the Run.
- **When** the handler creates its idempotent durable job after the abort signal and then rejects.
- **Then** the private recovery ledger finds that started step's exact idempotent Job and Runtime cancels it through the scoped Queue service without issuing a general-purpose grant; the Run remains `cancelled`.

#### Scenario: A future step shares an idempotency key with an existing job

- **Given** a later generation step has not started and an unrelated existing job matches its planned idempotency key.
- **When** the user cancels while an earlier step is running.
- **Then** cancellation recovery does not invoke the later step's cancel tool and leaves the existing job unchanged.

### Requirement: AI persistence uses the typed KK API boundary

Agent Run, Tool Call, Knowledge and Skill synchronization SHALL use `KkApiClient` methods and SHALL NOT issue feature-local raw backend fetches.

Local Tool Call logs, Handoff projections and Browser Bridge session state SHALL be owner-qualified. Audit and Handoff text SHALL be redacted at the final persistence boundary, raw native Bridge messages SHALL NOT be logged or broadcast page-wide, and filesystem Handoff output SHALL be disabled unless explicitly enabled for development.

#### Scenario: Account changes while a tool or Bridge command is in flight

- **Given** owner A starts an asynchronous tool or Browser Bridge command.
- **When** owner B becomes active before completion.
- **Then** the Tool Call/Handoff remains in A's partition, the native result is not delivered into B's UI state, and B's audit/session reads exclude A's records.

#### Scenario: A tool returns a secret-shaped failure

- **Given** a handler, verifier or native Bridge result contains a credential in free text.
- **When** its log, step result, Run summary or Handoff is persisted.
- **Then** authorization, cookie, token, password, database URL and key material are redacted and the raw value is not stored.

#### Scenario: Offline Knowledge synchronization fails

- **Given** the typed client cannot reach the API.
- **When** a user-scoped Knowledge or Skill write is attempted.
- **Then** the local projection remains available and the existing retry queue records the typed operation.

#### Scenario: Account changes while Knowledge synchronization is in flight

- **Given** user A starts a typed Knowledge write and the request later fails.
- **When** user B becomes the active browser owner before that failure resolves.
- **Then** the retry remains in user A's owner-qualified queue and user B cannot observe or submit it.

#### Scenario: Account changes during a retry batch

- **Given** user A has multiple pending Knowledge operations.
- **When** the active account changes to user B after one operation resolves.
- **Then** the scheduler updates user A's queue and stops before sending the next user A operation with user B's session.

#### Scenario: Multiple offline Skill versions share one id

- **Given** version 1 and then version 2 of one Skill fail to synchronize.
- **When** the retry queue deduplicates that Skill and connectivity returns.
- **Then** only the newest monotonic payload is retried, and the server refuses any older timestamp that arrives later.

#### Scenario: An older Skill acknowledgement arrives after a newer failure

- **Given** Skill version 1 is still in flight and version 2 fails into the owner-scoped retry queue.
- **When** version 1 later succeeds, or a retry response resolves after that queue slot has been replaced by version 2.
- **Then** the acknowledgement only matches its sent `updatedAt`, and version 2 remains pending until version 2 itself is acknowledged.

#### Scenario: A Skill is deleted while its older upsert is still in flight

- **Given** two browser tabs may assign different local IDs to the same user-scoped Skill name, and one tab deletes that Skill with a newer version.
- **When** an older same-name upsert later fails or succeeds from either tab.
- **Then** the local name/ID deletion marker prevents an obsolete retry, the server name-scoped version gate preserves the canonical row ID, and the old write cannot recreate the deleted Skill.

#### Scenario: Another tab writes unrelated Knowledge after a Skill deletion

- **Given** one tab has persisted a Skill deletion version and its backend delete still needs retry.
- **When** another tab writes an unrelated Knowledge record or cleans an obsolete upsert from a stale in-memory queue.
- **Then** mergeable projection and queue snapshots retain the newest deletion version and delete retry, and no old upsert is re-enqueued.

#### Scenario: Two tabs write after reading the same browser snapshot

- **Given** two same-owner tabs have read the same projection or pending queue baseline.
- **When** each writes before observing the other tab's new snapshot.
- **Then** uniquely named mergeable snapshots retain both operations, deletion tombstones suppress obsolete records, and a later read converges without whole-object last-writer loss.

#### Scenario: The same Skill is deleted twice while both requests are in flight

- **Given** the first delete removed the local Skill and persisted its canonical name before contacting the server.
- **When** a second delete uses the stale UI ID and the two requests fail in reverse order.
- **Then** one newest pending delete remains with the canonical name, and the late older failure cannot replace it with the ID as a name or lower its version.

#### Scenario: Same-name Skill writes have an equal client timestamp

- **Given** isolated same-owner tabs create different same-name Skill payloads with the same `updatedAt`.
- **When** their snapshots meet and the server returns its accepted canonical Skill to both clients.
- **Then** deterministic local merging and the authoritative response make both tabs converge to one canonical ID and content without reviving a later deletion.

#### Scenario: Offline Agent Run synchronization survives reload

- **Given** the typed client cannot acknowledge the latest Agent Run snapshot.
- **When** the page reloads and later regains connectivity.
- **Then** the owner-scoped `AgentRunStore` restores the pending snapshot and retries it in timestamp order without exposing another user's history.

#### Scenario: A Tool Call id conflicts across Runs

- **Given** a Tool Call ID already belongs to one authenticated user's Run.
- **When** a different user or Run submits the same ID.
- **Then** the API returns a conflict rather than silently acknowledging `ON CONFLICT DO NOTHING`, preserving the audit boundary.

### Requirement: Knowledge and Skill data are user scoped

User Knowledge and Skills SHALL be queried, updated and deleted only within the authenticated user's scope. System Knowledge MAY be shared read-only. Legacy rows SHALL remain unclaimed and excluded from ordinary user queries.

#### Scenario: Two users use the same Skill name

- **Given** users A and B are authenticated separately.
- **When** both upsert a Skill with the same name.
- **Then** each receives an independent user-scoped record and neither can update or delete the other's Skill.

#### Scenario: A client tries to rename an existing Skill id

- **Given** a user-owned Skill ID is already bound to logical name X.
- **When** a later upsert sends the same ID with name Y.
- **Then** the server rejects the rename before advancing either name version, and a later deletion cannot make a replay under X revive the Skill.

#### Scenario: A delete supplies the wrong name for an existing Skill id

- **Given** a user-owned Skill ID is bound to canonical name X.
- **When** a delete for that ID supplies name Y.
- **Then** the server returns a conflict before advancing a version gate and does not delete by ID or by Y.

#### Scenario: User searches Knowledge

- **Given** system, legacy, user A and user B Knowledge rows exist.
- **When** user A searches Knowledge.
- **Then** results may contain system and user A rows, and exclude legacy and user B rows.

### Requirement: Production ownership is secure by default

Temporary owner headers SHALL be accepted only when `KKAI_LOCAL_ONLY=true` is explicitly configured. A missing or non-production `NODE_ENV` SHALL NOT enable temporary ownership or a local admin password bypass.

#### Scenario: VPS environment omits local-only mode

- **Given** a request has no valid JWT and supplies an arbitrary `x-kk-temp-user-id`.
- **When** `KKAI_LOCAL_ONLY` is absent or false, regardless of `NODE_ENV`.
- **Then** authentication fails and the temporary ID cannot select an AI persistence owner.

### Requirement: AI ownership migration has a safe cutover

Migration 016 SHALL be transactional and SHALL upgrade the supported pre-015 Agent Run schema itself. Deployment SHALL build before stopping API services, stop incompatible old code before migration, and SHALL NOT automatically restart old code after a migration has been attempted.

#### Scenario: Existing VPS has the migration 011 Agent Run schema

- **Given** `agent_runs` exists without `user_id` and contains legacy rows.
- **When** migration 016 is applied.
- **Then** it adds `user_id`, marks old rows as `legacy`, enforces non-null ownership, creates the owner index and commits atomically.

#### Scenario: Deployment fails after migration is attempted

- **Given** the new release built successfully and old API services were stopped before migration 016 began.
- **When** psql returns an error with an unknown commit outcome, or a later symlink, service or smoke step fails.
- **Then** deployment refuses automatic rollback to or restart of the previous schema-incompatible code and reports manual recovery is required.

#### Scenario: Deployment prepares the migration cutover

- **Given** a release commit and one or more installed managed API units.
- **When** deployment builds the release and reaches the migration boundary.
- **Then** the manifest records the full commit SHA, the release directory uses its short SHA, every installed managed unit receives a stop command, and service-state query failures stop the deployment before migration.
