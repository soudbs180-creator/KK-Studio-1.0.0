# API Runtime Full Remediation Design

**Status:** Approved by the user on 2026-07-13.

## Goal

Turn the current KK Studio v1.6.0 HTTP surface into an accountable contract system: every effective runtime operation is classified, canonical operations live in canonical domain routers, shared DTOs and the typed API Client mediate application calls, and obsolete compatibility routes are removed only after their consumers have migrated.

This is a full remediation program rather than a documentation-only pass. It includes route deduplication, contract convergence, response normalization, compatibility isolation, deprecation, removal, tests, and current API documentation.

## Current baseline

The runtime facts at the start of this work are:

- 126 route registration statements expand to 130 method/path registrations.
- Eight later registrations are shadowed by an earlier route with the same method and effective path.
- The routers therefore expose 122 unique effective operations; `/healthz` brings the runtime total to 123.
- `/uploads/*` is a static resource prefix and is tracked separately from the 123 method operations.
- `docs/specs/openapi.yaml` contains 34 paths and 42 operations. All 42 map to runtime operations.
- 81 runtime operations are not represented in OpenAPI.
- `server/routes/compat/` physically contains many important implementations, including some operations that are already part of the stable OpenAPI surface. Physical location and contract status are therefore separate facts.

The existing behavior remains authoritative until a wave explicitly replaces it and passes its migration gates.

## Completion criteria

The remediation is complete when all of the following are true:

1. Every effective method/path operation is present exactly once in a machine-readable operation registry.
2. Each operation has one contract status: `stable`, `internal`, `compatibility`, or `deprecated`.
3. Each operation records its implementation zone, owner, source, authentication class, response style, and relevant replacement or review metadata.
4. Governance derives the effective runtime set from current route source and mount order, compares it with the registry, and fails on missing, duplicate, stale, or invalid entries.
5. Every `stable` operation is described by OpenAPI. Application-consumable JSON operations also have shared DTOs and a typed API Client method unless the operation is an explicit platform exception.
6. Canonical stable implementations no longer live in `server/routes/compat/`; that directory contains only thin compatibility adapters.
7. The eight known shadowed registrations are removed, and governance prevents new shadowed registrations.
8. Compatibility and deprecated operations declare a canonical replacement, owner, ISO review date, and removal condition.
9. No application UI directly fetches a server operation that is available through the typed API Client.
10. JSON APIs use the shared `ApiResponse<T>` success/error envelope unless they are recorded exceptions such as Stripe webhooks, health/metrics probes, file or redirect responses, OCR text/stream compatibility, or provider protocol passthrough.
11. Current API documentation and generated counts agree with the registry, OpenAPI, API Client, and runtime source.

## Contract status model

### Stable

A supported contract intended for normal application or external integration use. Stable operations require OpenAPI coverage, explicit authentication and response schemas, regression tests, and shared DTO/API Client coverage where the operation returns application-consumable JSON.

### Internal

A runtime or service-management operation not promised as an external application contract. Internal operations still require an owner, authentication class, response style, caller evidence, and tests. They must not be called directly from UI components.

### Compatibility

A supported adapter that preserves an older path, request shape, or response shape while forwarding to a canonical stable or internal service. A compatibility operation must be thin: it may translate transport data, but it must not own the canonical business workflow.

### Deprecated

An operation scheduled for removal. It must identify its replacement, owner, review date, removal condition, and known caller state. Where the response form permits it, the server adds `Deprecation` and `Sunset` metadata during the migration window.

Status is independent from implementation zone. For example, an OpenAPI operation currently implemented in `server/routes/compat/workspace.js` starts as `stable` in the contract dimension and `compat` in the implementation dimension; remediation moves its canonical implementation without downgrading the contract.

## Operation registry

The repository will contain a checked-in JSON registry under `docs/api/`. Each effective operation record uses normalized OpenAPI-style path parameters (`{jobId}` rather than `:jobId`) and contains:

- `method` and `path`
- `status`
- `implementationZone`
- `source`
- `owner`
- `auth`
- `responseStyle`
- `openapiOperationId` when stable
- `knownCallers` for internal, compatibility, and deprecated operations
- `replacement` for compatibility and deprecated operations
- `reviewBy` and `removalCondition` for compatibility and deprecated operations
- `notes` only for facts that cannot be represented by the preceding fields

Allowed implementation zones are `root-health`, `api-router`, `compat`, `telemetry`, and `webhook`. The static `/uploads/*` prefix is recorded as a separate resource surface and is not inserted into the method-operation registry. `knownCallers` contains repository-relative files or the explicit sentinel `external-unknown`; it never contains developer-machine paths.

The registry is the classification source, not the runtime source. Runtime source remains authoritative for what is actually mounted. Governance compares both directions so a newly added route cannot bypass classification and a deleted route cannot leave a stale registry entry.

OpenAPI remains the stable-contract source. The checker requires exact agreement between the registry's stable set and the OpenAPI operation set. Promoting an operation to stable therefore requires the route, shared contract, typed client where applicable, OpenAPI, registry, tests, and documentation to change in the same delivery wave.

## Runtime discovery and governance

A focused governance module extracts method/path registrations from the current Express route files, expands array aliases, applies the mount prefixes and declared router order from `server/index.js`, and identifies shadowed registrations. The discovery result includes the effective source handler and the later shadowed source handlers.

The governance command fails when:

- an effective runtime operation is missing from the registry;
- the registry contains a non-runtime operation;
- a method/path key appears more than once in the registry;
- a status or required metadata field is invalid;
- the stable set differs from OpenAPI;
- a compatibility/deprecated entry has no replacement, review date, or removal condition;
- a new shadowed registration appears;
- a stable canonical implementation remains under `server/routes/compat/` after its domain wave is marked migrated.

The checker is included in `governance:check`. Unit tests run it against isolated fixtures to prove both acceptance and rejection behavior.

## Remediation waves

### Wave 0: classification and freeze

Create the operation registry, runtime discovery/checker, classification documentation, and failing-on-drift tests. This wave changes no HTTP behavior. It freezes the current surface so later waves cannot silently add more ambiguity.

### Wave 1: duplicate registration removal

Remove the eight known later shadowed registrations. Tests assert that the earlier effective handlers remain mounted, aliases remain available where intended, and effective operation count and behavior do not change. The checker then changes from an allowlist of the known eight to a zero-shadow requirement.

### Wave 2: authentication, Profile, Key Manager, and user routes

Choose one canonical handler per operation, consolidate request/response DTOs, move stable implementations out of compatibility modules, route Web callers through the typed client, and retain only required old-path adapters. Password reset, token refresh, temporary user, Wuyin catalog, and provider-probe behavior remain separate operations with explicit status rather than implicit aliases.

### Wave 3: Workspace, Asset, Generation Task, and Durable Generation Job

Move stable workspace and generation implementations into canonical domain routers/services. Preserve `DurableGenerationQueue` semantics and current persistence behavior. Batch synchronization, claim/control actions, asset content responses, and legacy generation history each receive explicit response and stability decisions.

### Wave 4: Billing, Admin, Model Catalog, and provider pricing

Converge billing and administrative contracts without changing database schema or payment truth. Stripe signature verification, credit mutation authorization, idempotency, and admin-session requirements remain server-owned. Old `/api/admin/*`, Stripe checkout compatibility, recharge aliases, and provider pricing routes are migrated or deprecated based on real callers.

### Wave 5: AI Assistant, generation gateway, OCR, telemetry, webhook, and platform operations

Classify the remaining operational and protocol-specific endpoints. Promote application contracts only when their DTOs and response behavior are stable. Keep health, metrics, webhook, stream/file, and provider passthrough exceptions explicit instead of forcing them into an incorrect JSON envelope.

### Wave 6: compatibility deletion and final reconciliation

Search and migrate all repository callers, review runtime evidence that is available, remove adapters whose deletion gates are satisfied, and retain externally uncertain routes only as governed deprecated adapters. Regenerate endpoint and client documentation, verify no stable implementation remains in the compatibility directory, and reconcile all counts.

Each wave is independently tested, recorded in `docs/development/session-handoff.md`, committed with `agents:commit`, and pushed before the next wave starts.

Because the program crosses several security-sensitive domains, it is not implemented from one oversized plan. This design is the umbrella specification; Waves 0 through 6 each receive a focused implementation plan when the preceding wave is green and pushed. Wave 0 is planned and implemented first.

## Cross-layer change order

Every domain wave follows the project boundary order:

1. `packages/shared/` defines DTOs, enums, errors, and envelopes.
2. `packages/api-client/` exposes the cross-platform HTTP operation without platform storage assumptions.
3. `server/` implements canonical business behavior and transport adapters.
4. `apps/web/` migrates callers to the typed client and removes direct HTTP parsing.
5. `tests/` lock the new contract and compatibility behavior.
6. `docs/specs/openapi.yaml`, `docs/api/`, the operation registry, and Handoff record the current facts.

No domain wave introduces a parallel backend, parallel API client, or parallel AI assistant.

## Compatibility removal gates

An adapter may be deleted only when all applicable gates pass:

1. Repository search finds no active caller of the old path or response shape.
2. All known application callers use the canonical typed client method.
3. The canonical operation has shared DTOs and regression coverage.
4. Compatibility tests prove equivalent required behavior before removal.
5. The registry supplies a replacement and removal condition.
6. Available runtime or deployment evidence does not show an active external caller.

Lack of repository callers alone does not prove that an externally reachable endpoint is unused. If external use cannot be established or excluded, the operation remains a thin `deprecated` adapter with a review date. This still counts as remediated because its ownership, replacement, behavior, and removal decision are explicit.

## Error handling and response convergence

Canonical JSON handlers construct standard success and failure envelopes from shared helpers. Compatibility adapters translate only at the HTTP boundary. Business services return domain results or typed errors and do not inspect legacy response shapes.

Authentication failures, authorization failures, validation failures, conflict/idempotency failures, upstream provider failures, and internal failures use stable error codes when represented by `ApiResponse<T>`. Logs must not contain tokens, secrets, payment proofs, private files, or raw provider credentials.

Explicit non-envelope responses remain documented with their content type and error behavior. The remediation does not wrap a Stripe webhook acknowledgment, redirect, file stream, metrics payload, or upstream protocol response merely to satisfy a uniformity metric.

## Testing and verification

Each behavior change follows test-driven development: add a focused failing test, confirm the expected failure, implement the minimal change, and rerun the focused and neighboring suites.

Required evidence per wave includes:

- operation-registry and runtime-discovery unit tests;
- affected route/auth/response contract tests;
- affected API Client and direct-fetch boundary tests;
- OpenAPI parsing and stable-set equality;
- `architecture:check`;
- `governance:check`;
- `typecheck`;
- `build`;
- full unit, integration, contract, and E2E tests for route-removal waves;
- encoding, mojibake, `git diff --check`, Handoff, commit, push, and clean post-flight status.

Real payment or paid-provider calls are not required for local verification. Any unavailable aggregate command or external validation must be recorded with the exact equivalent checks that were run and the reason the original command was unavailable.

## Out of scope

- Changing product pricing, credit balances, payment state, or Stripe business rules.
- Executing database DDL outside `migrations/` or redesigning the database without a separate approved change.
- Restoring removed runtimes such as root `src/`, `apps/api/`, or payment sidecars.
- Replacing Express, changing deployment topology, or introducing a second API framework.
- Blindly deleting externally reachable endpoints without migration evidence.

## Delivery risk controls

The highest-risk areas are authentication/session refresh, credit mutations, Stripe webhooks, generation job leasing/control, encrypted user API payloads, and provider proxying. These areas are changed in small domain waves, preserve current authorization boundaries, and require route-level regression evidence before old adapters are removed.

If a wave uncovers behavior that contradicts this design, current source and tests take factual priority. The contradiction is documented, the plan is revised, and destructive cleanup stops until the replacement behavior is explicit.
