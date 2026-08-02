# Multi-Agent Coordination Standard

Status: current

Source evidence: `services/api/lib/agent-coordinator/policy.js`, `services/api/lib/agent-coordinator/store.js`, `infrastructure/database/migrations/032_agent_coordination.sql`.

KK Studio treats multi-Agent execution as a server-authorized coordination problem, not as a collection of independent prompt calls.

## Admission Rules

- The server is the authority for role admission. Public Agent runs enter as `executor`; `coordinator`, `planner`, `verifier`, and `compensator` are not client-selectable privileges.
- Admission is owner-scoped and cluster-scoped. `KK_AGENT_MAX_ACTIVE_TASKS` limits active tasks and `KK_AGENT_MAX_CLUSTER_AGENTS` limits distinct active Agent instances.
- `maxRounds` is bounded by risk class and policy version. A client request cannot raise the server cap.
- Resource claims are admitted atomically. Higher business priority may preempt only an `admitted` or `queued` task that has not started mutation.

## State And Recovery

- `version` and `epoch` form a compare-and-swap fence. Stale commands are rejected and counted.
- Every mutation uses an idempotency key and is recorded in the command receipt table.
- Heartbeats renew leases; expired leases fence the task and mark compensation required. A fenced Agent cannot continue execution.
- Wait-for edges are checked for cycles. A deadlock is recorded and does not silently retry forever.
- Terminal release removes claims and requeues eligible waiters. Requeued work must reacquire resources before entering `running`.
- Ordered events and owner-scoped snapshots are the diagnostic source for reconciliation; local caches are never execution authority.

## Operating Model Selection

| Scenario | Preferred model | Why | Required fallback |
| --- | --- | --- | --- |
| Short, low-risk pipeline | Central admission with role definitions | Low coordination overhead and predictable ownership | Queue, bounded rounds, and terminal release |
| High-frequency discussion | Peer proposals behind a coordinator | Parallel thought is useful, but only one state owner may commit | CAS rejection, event cursor recovery, and duplicate suppression |
| Complex decision or approval | Hierarchical planner, executor, verifier | Separates planning from mutation and verification | Server-owned role admission and compensation marker |
| Dynamic scale-out | Cluster-scoped central arbitration | Admission limits and leases prevent uncontrolled fan-out | Cluster cap, lease fencing, and deadlock breaker |

Priority is calculated by the versioned policy from business priority, risk, and deadline pressure. It is not a fixed branch that always lets one role win. Preemption is restricted to work that has not started mutation; running work is fenced and must follow compensation/reconciliation.

## Cache And Snapshot

- The browser run store reuses intermediate `version` and `epoch` state to avoid re-planning on every heartbeat.
- The server persists an owner-scoped durable snapshot after every ordered coordination event. It is a recovery and diagnostics cache, never an execution grant.
- Event sequence cursors make message loss and reordering detectable: a consumer can request events after its last sequence and rebuild from the snapshot.
- Any cache hit that cannot prove owner, epoch, version, and policy compatibility must fail closed and re-read the server state.

## Release Tiers

- **Green:** low-risk, short-link coordination with role admission, bounded rounds, and terminal compensation/release.
- **Yellow:** has compensation and metrics but may still see contention; requires conflict-rate and lease-loss monitoring before scale-out.
- **Red:** no global arbitration, no deadlock protection, or no fencing/compensation path. It is not eligible for production release.

## Quantitative Gate

Coordination health is measured over a bounded window through the metrics endpoint:

- completion rate: completed terminal tasks / all terminal tasks;
- conflict rate: tasks that observed a resource conflict / total tasks;
- average rounds: mean state-machine execution rounds;
- deadlock count, stale command count, lease-loss count, and compensation count.

No multi-Agent service may enter the release path without global arbitration, bounded rounds, idempotency, deadlock detection, lease fencing, compensation signaling, and aggregate metrics.
