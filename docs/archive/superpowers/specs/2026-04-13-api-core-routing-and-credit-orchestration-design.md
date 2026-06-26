# KK Studio API Core Routing And Credit Orchestration Redesign

**Goal**

Rebuild KK Studio's API core around two explicit execution lanes, one for user-owned local APIs and one for cloud-executed credit models, so supplier request methods never cross-wire, admin pricing and routing stay real-time, and model-size routing can mix multiple suppliers safely.

**Problem Summary**

- The current project already supports both user-owned APIs and admin-configured credit models, but the business rules are spread across provider strategy, settings UI, billing, model catalog, and adapters.
- Supplier identity is currently inferred from a mix of provider name, base URL, preset defaults, and model metadata. That makes the system fragile when the same supplier uses multiple domains or when several suppliers expose OpenAI-compatible facades.
- Image routing is now more complex than a provider-level choice. The same supplier may expose `gemini`, `image-generation`, `image-generation-async`, or even `chat` surfaces for different models or different sizes.
- Credit-mode execution has stronger guarantees than a normal local API call: it must deduct credits, persist a transaction, call the chosen supplier route on the server, refund on failure, and return the final result to the browser without exposing supplier secrets.
- Admins now need real-time control over model price, size-specific route selection, mixed supplier concurrency, and fallback behavior. The current flattened admin model structure is not expressive enough for this.

## Approved Direction

This redesign formalizes the following top-level rule set:

1. User-owned APIs and admin-configured credit models are permanently separated into different execution lanes.
2. Base URL is an access address, not the canonical supplier identity.
3. Supplier request behavior is decided by a dedicated request profile plus model surface metadata, never by display name alone.
4. Credit models are not bound directly to one supplier. They are bound to model specifications, and each specification contains one or more executable route units.
5. Image routing is model-surface-first:
   - model endpoint types
   - route unit request surface
   - supplier request profile
   - 12AI fallback profile
6. Unknown local suppliers fall back to 12AI request rules only for the local user-owned lane.
7. Credit-model execution always stays server-side and never leaks supplier keys to the browser.

## Scope

This spec covers:

- Local user API routing rules
- Cloud credit-model routing rules
- Admin model, size, and supplier orchestration data model
- Billing, settlement, refund, and task result flow
- Real-time admin editing behavior
- Migration from the current flattened admin model catalog

This spec does not cover:

- UI visual redesign of the settings workbench
- Payment gateway recharge UX
- New supplier onboarding content or docs harvesting automation
- Full database migration SQL details

## Current System Boundaries

### Local User API Lane

Current local API state already exists in:

- `src/components/settings/ApiSettingsView.tsx`
- `src/services/auth/keyManager.ts`
- `src/services/api/providerStrategy.ts`
- `src/services/api/connectionTest.ts`
- `src/services/llm/OpenAICompatibleAdapter.ts`
- `src/services/billing/supplierService.ts`

Key facts:

- User-editable API entries remain user-owned configuration.
- Browser clients should not treat supplier docs URLs as live API endpoints.
- Image requests already consume model metadata such as `endpointTypes`.
- Unknown or weakly-identified providers still need a safe request fallback.

### Cloud Credit Lane

Current credit-mode execution already exists in:

- `src/services/model/adminModelService.ts`
- `src/context/BillingContext.tsx`
- `src/services/billing/generationBillingCoordinator.ts`
- `src/services/model/modelPricing.ts`
- `src/services/llm/LLMService.ts`
- `src/App.tsx`
- server-backed APIs exposed through `kkWebApiClient`

Key facts:

- Credit models are shown to the user as system models.
- Browser clients should only consume sanitized active model catalogs.
- Billing already tracks `paymentTransactionId` and uses refund-by-transaction where possible.
- Credit models already distinguish client-settled versus server-settled execution, but the route-selection model is not expressive enough for multi-supplier size-aware orchestration.

## Architecture

### Two-Lane Execution Model

All generation requests must enter one of two lanes before any supplier routing occurs.

#### Lane A: Local User API

Used when:

- the selected model belongs to a user-owned API
- the selected model is not a system credit model
- the selected route uses the local key manager / local provider config

Rules:

- never deduct credits
- never call admin credit routing
- may use browser-available user secrets only through the current secure local flow
- may use 12AI fallback request rules when supplier identity is unknown

#### Lane B: Cloud Credit Model

Used when:

- the selected model is marked as a system credit model
- execution must consume credits
- actual supplier keys live only on the server

Rules:

- always create a server-side generation attempt
- always bind credit deduction to a durable transaction or hold record
- always perform supplier routing on the server
- always return settlement or refund outcome through the cloud result contract
- never expose supplier API keys to the browser

### Request Profile Layer

Introduce a first-class request-profile registry that sits above provider strategy and below model execution.

Each request profile defines:

- `requestProfileId`
- `displayName`
- `docSources`
- `matchRules`
- `supportedProtocolFamilies`
- `defaultAuthProfile`
- `requestSurfaceDefaults`
- `modelDiscoveryStrategy`
- `pricingDiscoveryStrategy`
- `fallbackProfileId`

Examples:

- `12ai`
- `gpt-best`
- `new-suxi-ai`
- `wuyinkeji`
- `openai-official`
- `anthropic-official`
- `generic-openai`

Rules:

- base URL may help identify the request profile but is not the only signal
- docs URLs may identify the supplier but can never be used as executable API bases
- the request profile is stable even when supplier domains vary

### Model Surface Layer

Request profile alone is not enough for images or videos. The system must use model surface metadata whenever available.

Model surface metadata includes:

- `endpointType`
- `endpointTypes`
- `endpointTargets`
- explicit provider endpoint path if present
- async capability markers

Surface examples:

- `provider-images`
- `async-image`
- `gemini-native-image`
- `chat-image`
- `openai-chat`
- `openai-responses`
- `claude-messages`

Rule:

- model surface metadata always beats provider-level defaults for request selection

### Credit Route Unit Layer

Credit-mode execution must stop thinking in terms of one model equals one supplier.

Introduce the route unit as the real execution object.

A route unit represents one executable supplier path for one model specification.

Suggested shape:

```ts
type CreditRouteUnit = {
  id: string
  modelId: string
  specId: string
  supplierId: string
  supplierLabel: string
  requestProfileId: string
  baseUrl: string
  requestSurface: 'provider-images' | 'async-image' | 'gemini-native-image' | 'chat-image' | 'openai-chat' | 'openai-responses' | 'claude-messages'
  authProfileId: string
  endpointOverride?: string
  concurrencyLimit?: number
  priority: number
  weight: number
  enabled: boolean
  supportsParallelFanout: boolean
  timeoutMs?: number
  retryPolicyId?: string
  fallbackPolicyId?: string
  healthScore?: number
  lastFailureAt?: string
  lastSuccessAt?: string
}
```

This enables:

- one spec using one supplier only
- one spec using multiple suppliers with weighted routing
- one spec using priority-first failover
- one model using different suppliers for different sizes

### Credit Model Specification Layer

Each credit model is now a catalog entity with one or more specifications.

Suggested shape:

```ts
type CreditModelCatalog = {
  id: string
  displayName: string
  family: 'image' | 'video' | 'chat' | 'audio'
  description?: string
  isActive: boolean
  specs: CreditModelSpec[]
}

type CreditModelSpec = {
  id: string
  modelId: string
  sizeSpec: string
  qualitySpec?: string
  displayLabel: string
  creditPrice: number
  settlementMode: 'server'
  routeStrategy: 'priority-failover' | 'weighted-random' | 'parallel-race'
  routeUnits: CreditRouteUnit[]
}
```

Examples:

- model `nano-banana-pro`
  - spec `1K`
  - spec `2K`
  - spec `4K`

This allows:

- `1K` and `2K` to use supplier A
- `4K` to use supplier B
- `2K` to mix supplier A and supplier C in weighted concurrency

## Routing Rules

### Local User API Routing

Local routing must follow this order:

1. Determine the execution lane. If the chosen model is not a system credit model, stay local.
2. Resolve the request profile from:
   - explicit stored profile id if available
   - prior successful detection cache
   - base URL match rules
   - provider name alias only as a weak hint
3. Resolve model metadata and surface metadata.
4. For image requests, route in this priority order:
   - model `endpointTypes`
   - explicit provider surface override
   - request profile defaults
   - 12AI fallback rules
5. For chat requests, route by:
   - Gemini native
   - Claude native
   - OpenAI Responses when model requires it
   - OpenAI Chat otherwise

Important local rule:

- if a model says it supports `gemini` and not `images`, do not silently send image generation to `/v1/images/generations`

### Cloud Credit Routing

Cloud credit routing must follow this order:

1. Resolve the selected system credit model.
2. Resolve the selected specification from request parameters:
   - image size
   - quality
   - variant
3. Create a generation attempt record.
4. Freeze or deduct credits using a durable transaction id.
5. Select route units for that specification.
6. Apply route strategy:
   - priority failover
   - weighted random
   - parallel race
7. Execute supplier call on the server.
8. Persist supplier result, latency, final route unit used, and settlement state.
9. On success:
   - finalize settlement
   - return result payload
10. On failure:
   - mark attempt failed
   - refund or release frozen credits
   - return normalized error payload

### Parallel Mixed Supplier Rules

Parallel mixed routing is allowed only for server credit mode, not for local user-owned APIs.

Use cases:

- race two suppliers and keep the first successful result
- spread load across equivalent low-cost routes
- maintain availability while preserving per-size optimization

Guardrails:

- only one final settlement result per attempt
- non-winning parallel calls must be cancelled if possible
- if cancellation is impossible, the server must quarantine the late results and avoid double settlement
- route unit concurrency must respect supplier-level caps

## Billing And Settlement Flow

### Required Billing Contract

Every server-settled generation attempt must produce:

- `attemptId`
- `paymentTransactionId`
- `creditPrice`
- `creditSettlementState`
- `routeUnitId`
- `supplierExecutionState`
- `finalResultState`

Suggested state machine:

```text
created
-> credit_reserved
-> route_selected
-> supplier_submitted
-> supplier_running
-> succeeded
or -> failed_refunded
or -> failed_refund_pending
```

### Success Rules

- browser receives a success payload only after the server has finalized settlement
- final usage and call counters are written against the winning route unit
- admin stats update in real time or near-real time from server state

### Failure Rules

- refund by transaction id is the preferred path
- amount-based refund is fallback only when transaction id is unavailable
- both browser-visible and server-visible billing views must refresh after refund transitions
- failed supplier execution must not leave the front end in an indefinite generating state

### Partial And Async Supplier Rules

Some suppliers return async task IDs instead of immediate assets.

Rules:

- the cloud attempt remains active while the supplier task is pending
- the route unit may be async even if other route units for the same spec are sync
- server-side polling belongs to the cloud lane, not the browser
- front end tracks attempt status, not supplier-specific task semantics

## Admin Console Design Contract

### Entry Model

Admins access a dedicated admin page through the avatar menu after logging in with the separate admin auth flow.

Rules:

- admin entry must be visible only for admin users
- admin page is isolated from the regular user API editor mental model
- all writes are server-backed and real-time
- no hidden local draft becomes the source of truth

### Admin Editing Surfaces

The admin page uses three primary editors:

1. Credit model catalog
2. Specification editor
3. Route unit editor

#### Credit Model Catalog

Owns:

- model display name
- family
- enabled state
- description
- global visual identity

#### Specification Editor

Owns:

- size spec
- quality spec
- credit price
- route strategy
- enabled state

#### Route Unit Editor

Owns:

- supplier selection
- request profile
- base URL
- request surface
- endpoint override
- priority
- weight
- concurrency
- timeout
- enabled state

### Real-Time Admin Rules

- every save writes immediately to the server
- client refreshes the admin model catalog after every successful mutation
- route edits must affect new requests without requiring a front-end reload
- sanitized active model payloads remain browser-safe and must never include supplier secrets

## Data Ownership

### Browser-Owned

- user-owned API configuration
- local route detection cache
- non-secret UI preferences
- in-flight UI status for local generation

### Server-Owned

- admin supplier secrets
- admin route units
- credit model specifications
- generation attempts for cloud credit mode
- billing transaction records
- settlement and refund state

### Shared But Sanitized

- active credit model catalog
- display labels
- current credit prices
- public model capabilities
- supplier health summaries without secrets

## Caching Rules

### Local Detection Cache

For local user APIs, store:

- normalized base URL
- detected request profile id
- last verified time
- last successful model discovery surface

Rules:

- normal generation requests do not trigger fresh supplier detection
- detection refresh happens only on:
  - save
  - manual verify
  - manual refresh models
  - changed base URL / api key / protocol

### Cloud Catalog Cache

For credit models, the browser may cache the sanitized active catalog for UI startup, but the server remains the source of truth.

Rules:

- admin edits invalidate catalog caches immediately
- user-side displays may use short-lived stale-while-revalidate behavior
- route unit selection never happens in the browser

## Migration Plan

### Phase 1: Introduce New Domain Objects

Add first-class support for:

- request profile registry
- credit model specs
- route units
- route strategy
- settlement state machine

without removing the old flattened structures yet.

### Phase 2: Adapter Bridge Layer

Map the current flattened admin model rows to:

- one credit model catalog entry
- one default specification
- one route unit per current provider row

This allows backward-compatible reads while new admin screens adopt the richer model.

### Phase 3: Switch Cloud Execution To Route Units

Change server credit execution to select route units instead of direct provider rows.

### Phase 4: Upgrade Admin Editing

Move admin editing from flat model rows to:

- model editor
- spec editor
- route unit editor

### Phase 5: Tighten Local Routing

Make local user API routing explicitly profile-based and model-surface-first.

### Phase 6: Remove Legacy Flattened Assumptions

After production validation, remove direct one-model-one-provider assumptions from browser and server code.

## Testing Requirements

### Contract Tests

- local user API never consumes credits
- cloud credit model never uses browser-owned supplier keys
- docs URLs are never treated as executable API bases
- unknown local providers fall back to 12AI request rules only in local lane
- credit route selection happens by spec plus route strategy, not supplier name

### Routing Tests

- a model with `gemini` only routes to Gemini native image surface
- a model with `image-generation-async` routes to async image surface when selected
- a model with both sync and async image surfaces respects explicit default policy
- a chat-only model never routes to image endpoints

### Billing Tests

- server-settled success finalizes one transaction
- supplier failure refunds by transaction id
- missing transaction id uses amount fallback only as backup
- parallel race does not double-charge or double-settle

### Admin Tests

- admin changes appear in the active credit model catalog immediately
- size-specific supplier mappings affect subsequent requests
- disabling one route unit shifts selection to the next eligible route

## Open Decisions

These are resolved for now unless implementation evidence forces a change:

1. Sync versus async image preference:
   - default to sync when both are supported
   - use async only when the spec or route unit explicitly requires it
2. Unknown local supplier behavior:
   - silent functional fallback to 12AI request rules
   - any future UI hint remains informational only and must never block routing
3. Parallel mixed supplier routing:
   - allowed only for cloud credit mode
   - not allowed for browser-local user API mode

## File Mapping For Implementation Planning

Primary files likely involved in the eventual implementation:

- `src/services/api/providerStrategy.ts`
- `src/services/api/connectionTest.ts`
- `src/services/api/providerSurfaceRouter.ts`
- `src/services/auth/keyManager.ts`
- `src/services/auth/providerPricingSnapshot.ts`
- `src/services/model/adminModelService.ts`
- `src/context/BillingContext.tsx`
- `src/services/billing/generationBillingCoordinator.ts`
- `src/services/llm/LLMService.ts`
- `src/services/llm/OpenAICompatibleAdapter.ts`
- `src/components/settings/ApiSettingsView.tsx`
- admin-page server contracts behind `kkWebApiClient`

## Final Design Summary

The optimized architecture is:

- local user APIs are local, secret-bound, non-credit, and model-surface-first
- cloud credit models are server-executed, transaction-backed, refund-safe, and spec-routed
- supplier request behavior is expressed through reusable request profiles
- admin routing power lives in route units under model specifications
- size-specific and mixed-supplier execution becomes a first-class feature instead of an accumulation of special cases

This gives KK Studio a stable API core where:

- supplier rules do not cross-wire
- base URL drift does not break supplier identity
- image routing follows actual model capability
- admin edits become real-time operational controls
- billing and settlement remain auditable and reversible
