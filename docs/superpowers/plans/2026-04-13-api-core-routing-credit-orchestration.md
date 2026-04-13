# API Core Routing And Credit Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate local user-owned API routing from cloud credit-model routing, centralize supplier request metadata into one lightweight registry, and introduce the first route-unit/spec skeleton without creating a parallel spaghetti stack.

**Architecture:** Keep the current production flow alive while inserting a small number of shared primitives: a request-profile registry, explicit local-versus-credit route classification, and a normalized credit route-unit/spec shape. Reuse existing `providerStrategy`, `adminModelService`, `keyManager`, `OpenAICompatibleAdapter`, and billing orchestration paths instead of replacing them wholesale.

**Tech Stack:** React 19, TypeScript, existing `kkWebApiClient` contracts, node:test, current billing and provider routing services

---

### Task 1: Lock the new routing vocabulary with failing unit tests

**Files:**
- Create: `tests/unit/request-profile-registry.test.ts`
- Modify: `tests/unit/admin-model-service.test.ts`
- Modify: `tests/unit/provider-strategy.test.ts`

- [ ] Write a failing test that expects a centralized request-profile registry entry for at least:
  - `12ai`
  - `gpt-best`
  - `suxi`
  - `wuyinkeji`
  - `generic-openai`
- [ ] Add a failing assertion that unknown local providers resolve to a 12AI fallback request profile instead of reusing arbitrary provider heuristics.
- [ ] Add a failing assertion that credit-route metadata is represented as `spec -> routeUnits` instead of a flat one-model-one-provider assumption.
- [ ] Run:

```bash
node --test tests/unit/request-profile-registry.test.ts tests/unit/provider-strategy.test.ts tests/unit/admin-model-service.test.ts
```

Expected: FAIL because the centralized request-profile registry and credit spec structure do not exist yet.

### Task 2: Introduce a lightweight request-profile registry as the single metadata source

**Files:**
- Create: `src/services/api/requestProfileRegistry.ts`
- Modify: `src/services/api/providerStrategy.ts`
- Test: `tests/unit/request-profile-registry.test.ts`
- Test: `tests/unit/provider-strategy.test.ts`

- [ ] Add a minimal request-profile registry that stores:
  - `requestProfileId`
  - `displayName`
  - `docSources`
  - `matchRules`
  - `supportedProtocolFamilies`
  - `requestSurfaceDefaults`
  - `fallbackProfileId`
- [ ] Move the currently duplicated supplier identity facts into the registry without deleting existing provider strategies yet.
- [ ] Make `providerStrategy.ts` consume the registry for supplier evidence decisions where possible, especially for:
  - docs URL versus API base distinction
  - known provider alias matching
  - 12AI fallback profile selection for unknown local providers
- [ ] Keep runtime behavior backward-compatible for existing known suppliers.
- [ ] Run:

```bash
node --test tests/unit/request-profile-registry.test.ts tests/unit/provider-strategy.test.ts
```

Expected: PASS.

### Task 3: Make local image routing explicitly model-surface-first

**Files:**
- Modify: `src/services/api/providerSurfaceRouter.ts`
- Modify: `src/services/llm/OpenAICompatibleAdapter.ts`
- Modify: `src/services/auth/keyManager.ts`
- Test: `tests/unit/provider-surface-router.test.ts`

- [ ] Add a focused test file for image-surface selection that covers:
  - `gemini` only -> `gemini-native-image`
  - `image-generation` -> `provider-images`
  - `image-generation-async` -> `async-image`
  - mixed sync + async -> default sync unless explicitly async
  - chat-only endpoint types -> never treat as provider-images
- [ ] Tighten `resolveImageSurface(...)` so model `endpointTypes` always win over provider defaults.
- [ ] Keep 12AI async behavior explicit and isolated instead of turning it into a generic fallback.
- [ ] Ensure `OpenAICompatibleAdapter` continues to read `getModelMetadata(...).endpointTypes` and only falls back to provider defaults when metadata is absent.
- [ ] Run:

```bash
node --test tests/unit/provider-surface-router.test.ts tests/unit/provider-strategy.test.ts
```

Expected: PASS.

### Task 4: Introduce the first lightweight credit spec and route-unit domain model

**Files:**
- Modify: `src/services/model/adminModelService.ts`
- Create: `src/services/model/adminRouteUnits.ts`
- Modify: `src/services/model/modelPricing.ts`
- Test: `tests/unit/admin-model-service.test.ts`
- Test: `tests/unit/model-pricing-credit-specs.test.ts`

- [ ] Add a lightweight `CreditModelSpec` and `CreditRouteUnit` shape without removing the current flat admin model contract yet.
- [ ] Add a mapper that converts current flat admin rows into:
  - one visible admin model
  - one default spec
  - one route unit
- [ ] Keep existing consumers working by exposing the current flat view plus the new normalized view from `adminModelService`.
- [ ] Add a pricing helper that reads credit price from the normalized spec when present and falls back to current logic otherwise.
- [ ] Run:

```bash
node --test tests/unit/admin-model-service.test.ts tests/unit/model-pricing-credit-specs.test.ts
```

Expected: PASS.

### Task 5: Thread explicit local-versus-credit route classification into execution

**Files:**
- Modify: `src/services/llm/LLMService.ts`
- Modify: `src/App.tsx`
- Modify: `src/services/billing/generationBillingCoordinator.ts`
- Test: `tests/unit/credit-route-classification.test.ts`

- [ ] Add a small route-classification helper that returns:
  - `local-user-api`
  - `cloud-credit-model`
- [ ] Make generation entrypoints decide the lane once and pass that through, instead of rediscovering it in multiple places.
- [ ] Keep current credit settlement behavior intact, but make the classification explicit in logs and in-memory execution state.
- [ ] Confirm that local user APIs never enter the credit charge/refund chain.
- [ ] Run:

```bash
node --test tests/unit/credit-route-classification.test.ts
```

Expected: PASS.

### Task 6: Preserve refund safety while preparing for server-selected route units

**Files:**
- Modify: `src/context/BillingContext.tsx`
- Modify: `src/services/billing/generationBillingCoordinator.ts`
- Modify: `src/App.tsx`
- Test: `tests/unit/credit-refund-routing.test.ts`

- [ ] Add a focused regression test that ensures a failed cloud credit attempt still prefers refund by `paymentTransactionId`.
- [ ] Thread placeholder route-unit identifiers through the generation billing coordinator so future server route selection has a stable place to persist execution identity.
- [ ] Do not change the visible billing UX in this task.
- [ ] Run:

```bash
node --test tests/unit/credit-refund-routing.test.ts
```

Expected: PASS.

### Task 7: Verify the lightweight first slice end-to-end

**Files:**
- Modify: `src/services/api/requestProfileRegistry.ts`
- Modify: `src/services/api/providerStrategy.ts`
- Modify: `src/services/api/providerSurfaceRouter.ts`
- Modify: `src/services/model/adminModelService.ts`
- Modify: `src/services/llm/LLMService.ts`
- Modify: `src/services/billing/generationBillingCoordinator.ts`
- Modify: `src/App.tsx`

- [ ] Re-check that the new request-profile registry is the single metadata source for supplier identity facts.
- [ ] Re-check that local image routing stays model-surface-first.
- [ ] Re-check that credit models now expose normalized spec/route-unit structure without breaking existing flat consumers.
- [ ] Run required verification:

```bash
node --test tests/unit/request-profile-registry.test.ts tests/unit/provider-strategy.test.ts tests/unit/provider-surface-router.test.ts tests/unit/admin-model-service.test.ts tests/unit/model-pricing-credit-specs.test.ts tests/unit/credit-route-classification.test.ts tests/unit/credit-refund-routing.test.ts
cmd /c npm run typecheck
cmd /c npm run check:encoding
```

Expected: PASS.
