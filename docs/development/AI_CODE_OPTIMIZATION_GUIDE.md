# AI Code Optimization Execution Guide — KK Studio

Last updated: 2026-06-24

Primary audience: AI coding agents, Codex, Cursor, Claude, Antigravity, and senior full-stack engineers working on KK Studio.

Primary repository: `soudbs180-creator/nano-banana-KK-`

Current active architecture:

- Frontend: Vercel-hosted `apps/web/` built with Vite, React 19, TypeScript, Tailwind, Ant Design / Lobe UI integration.
- Backend: VPS-hosted `server/` Express runtime.
- Shared contracts: `packages/shared/`, `packages/api-client/`, `packages/ui/`.
- Data: PostgreSQL migrations in `migrations/` only.
- Provider governance: backend registry plus frontend provider metadata, display identity, runtime strategy, and governance scripts.

This document is the execution manual for AI-led code optimization. It is intentionally prescriptive: follow the phases, verify assumptions from source, keep PR scope small, and never bypass governance or security checks.

---

## 1. Operating Principles

### 1.1 Source of truth order

When facts conflict, use this priority order:

1. Current source code in the active branch.
2. `AGENTS.md`.
3. `config/release-manifest.json`.
4. `package.json` scripts and workspace definitions.
5. Governance scripts under `scripts/governance/`.
6. Current active docs under `docs/governance/`, `docs/architecture/`, `docs/setup/`, and `docs/development/`.
7. Historical archive docs only as migration background, never as current implementation guidance.

### 1.2 Core engineering rules

- Do not expand a PR beyond its declared phase.
- Prefer small, reviewable patches over broad rewrites.
- Never duplicate provider identity logic across multiple frontend files.
- Never infer platform identity from protocol compatibility alone. OpenAI-compatible does not mean OpenAI Official.
- Never move database DDL outside `migrations/`.
- Never allow frontend code to directly call privileged provider APIs with platform-owned keys.
- Never commit real secrets, `.env`, API keys, database URLs, Stripe secrets, or deployment tokens.
- Do not treat old deployment integrations as source-code deploy requirements. Current deployment is Vercel frontend plus VPS backend.

### 1.3 AI behavior requirements

Before editing code, an AI agent must:

1. Identify the phase and issue/PR scope.
2. Read the target files directly from the branch being modified.
3. Find existing patterns and reuse them.
4. Produce a minimal patch plan.
5. Add or update tests/governance checks before broad behavior changes.
6. Run the smallest relevant validation first, then full validation before merge.
7. Record incomplete work in the PR body or follow-up issue instead of hiding it.

---

## 2. Current Phase Map

| Phase | Name | Status | Primary goal | Exit condition |
|---|---|---:|---|---|
| P0 | Provider identity governance and cleanup | In closure | Stabilize relay provider identity, governance, docs, and retired deploy references | PR #15 merged after validation and external stale status cleanup |
| P1 | Runtime strategy correctness | Prepared | Add missing runtime strategies and fix UI identity leakage | APIMart/OpenRouter runtime behavior covered by tests and governance |
| P2 | Provider preset consolidation | Not started | Convert legacy model shortcuts into canonical provider model/capability aliases | Key Manager/API Settings stop treating model aliases as providers |
| P3 | Deployment and CI hygiene | In progress via ops task | Remove obsolete external status checks and align required checks with active deployment | Only active Vercel/VPS/test/governance checks gate PRs |
| P4 | Full-stack quality hardening | Not started | Add deeper integration tests, regression contracts, and release readiness gates | Repeatable local/CI validation path with meaningful failure messages |
| P5 | Architecture modernization | Not started | Reduce duplicated provider/runtime/catalog logic and make future providers cheaper to add | Single provider catalog source feeds runtime, UI, tests, docs, and governance |

Current practical state:

- P0 code work is mostly complete in PR #15.
- P0 still requires local validation, PR merge, and external status check cleanup.
- P1 has a dependent branch: `fix/apimart-runtime-strategy-16`.
- P1 implementation target is issue #16.
- P3 external repository settings cleanup target is issue #17.

---

## 3. Required Reading Path for AI Agents

### 3.1 Always read first

```text
AGENTS.md
README.md
package.json
config/release-manifest.json
```

### 3.2 Provider/runtime work

```text
server/lib/dispatcher/providerRegistry.js
scripts/governance/check-provider-registry.mjs
scripts/governance/check-provider-presets.mjs
scripts/governance/check-frontend-provider-presets.mjs
apps/web/src/services/api/providerRegistry.ts
apps/web/src/services/api/providerStrategy.ts
apps/web/src/utils/providerDisplay.ts
docs/governance/PROVIDER_PRESET_RULES.md
```

### 3.3 Frontend preset and Key Manager work

Read these only when the task explicitly targets frontend settings/presets:

```text
apps/web/src/components/Settings/APISettings.tsx
apps/web/src/components/KeyManager.tsx
apps/web/src/services/api/providerRegistry.ts
apps/web/src/services/api/providerStrategy.ts
scripts/governance/check-frontend-provider-presets.mjs
```

### 3.4 Deployment work

```text
docs/setup/README.md
docs/setup/AUTO_UPDATE_AND_DEPLOY.md
.github/workflows/*
package.json
```

External repository settings are not represented by source code. If the task involves stale status checks, GitHub Apps, webhooks, or branch protection, track it as an ops task and do not fabricate source changes.

---

## 4. Phase P0 — Provider Identity Governance and Cleanup

### 4.1 Goal

Prevent relay providers from inheriting the wrong key reference, wrong UI identity, or stale governance assumptions. Remove retired deployment-platform references from active project materials without turning the provider-governance PR into a deployment rewrite.

### 4.2 Completed work expected in P0

- GPT-Best must not inherit Vodeshop key references.
- Known relay providers must have explicit key reference governance.
- Frontend provider metadata must distinguish relay platforms from official providers.
- `providerDisplay.ts` must resolve known relay identity from `baseUrl` through the central provider registry resolver.
- R8 governance must prevent relay platforms from being displayed as OpenAI Official.
- `governance:frontend-providers` must run as part of `governance:check`.
- Active docs/tests/governance should not list retired deployment integrations as current architecture.
- Historical deployment archive files that point at retired platforms may be removed if they are more harmful than useful.

### 4.3 P0 validation

Run:

```bash
node scripts/governance/check-provider-registry.mjs
node scripts/governance/check-provider-presets.mjs
node scripts/governance/check-frontend-provider-presets.mjs
npm run governance:check
npm run test:unit
npm run build
```

### 4.4 P0 exit gate

P0 is not done until:

- PR #15 is merged.
- Required validation has passed locally or in CI.
- Retired external deploy status checks are removed from required GitHub branch protection.
- The PR body honestly lists anything still not done.

---

## 5. Phase P1 — Runtime Strategy Correctness

### 5.1 Goal

Ensure each provider that appears in UI metadata and provider governance has a correct runtime strategy. The runtime must select the right protocol, auth style, compatibility behavior, display identity, pricing support, and management support.

Primary task: issue #16, `fix: add APIMart runtime provider strategy`.

### 5.2 Implementation target

File:

```text
apps/web/src/services/api/providerStrategy.ts
```

Required changes:

1. Add APIMart strategy to `PROVIDER_STRATEGIES`.
2. Add APIMart to `REQUEST_PROFILE_STRATEGY_MAP` if `RequestProfileId` already includes `apimart`.
3. Change OpenRouter runtime UI identity away from `OpenAI`.
4. Add tests covering APIMart by provider id and base URL.
5. Promote APIMart R9 coverage from warning to hard requirement after runtime support lands.

### 5.3 Minimal APIMart strategy shape

Use this shape unless current source patterns prove a better local convention:

```ts
{
    id: 'apimart',
    label: 'APIMart',
    known: true,
    providerFamily: 'generic-openai',
    providerPatterns: [/^apimart$/i, /^api\s*mart$/i],
    hostPatterns: [/^api\.apimart\.ai$/i, /(^|\.)apimart\.ai$/i],
    basePatterns: [/apimart\.ai/i, /apimart/i],
    defaultFormat: 'openai',
    supportedFormats: ['openai'],
    defaultAuthMethod: 'header',
    defaultHeaderName: AUTHORIZATION_HEADER,
    authorizationValueFormat: 'bearer',
    defaultCompatibilityMode: 'standard',
    imageProfile: 'openai-strict',
    videoApiStyle: 'openai-v1-videos',
    pricingSupport: 'manual',
    managementSupport: 'external',
    respectProviderOnCustomHost: true,
    uiProvider: 'Custom',
}
```

OpenRouter change:

```diff
-        uiProvider: 'OpenAI',
+        uiProvider: 'Custom',
```

Request profile map change:

```diff
 const REQUEST_PROFILE_STRATEGY_MAP: Partial<Record<RequestProfileId, ProviderStrategy['id']>> = {
     '12ai': '12ai',
+    'apimart': 'apimart',
     'gpt-best': 'gpt-best',
```

If TypeScript rejects `apimart` as a `RequestProfileId`, inspect and update:

```text
apps/web/src/services/api/requestProfileRegistry.ts
```

Do not bypass the type by using `as any`.

### 5.4 P1 tests

Add or extend tests under `tests/unit/`.

Expected assertions:

- `resolveProviderRuntime({ provider: 'apimart' })` returns `strategyId === 'apimart'`.
- `resolveProviderRuntime({ baseUrl: 'https://api.apimart.ai/v1' })` returns `strategyId === 'apimart'`.
- APIMart `uiProvider` is not `OpenAI`.
- OpenRouter `uiProvider` is not `OpenAI`.
- APIMart remains openai-compatible at protocol level while preserving real platform identity.
- `check-frontend-provider-presets.mjs` no longer emits APIMart as a warning after runtime support lands.

Suggested test file:

```text
tests/unit/provider-strategy-runtime.test.ts
```

### 5.5 P1 validation

Run:

```bash
node scripts/governance/check-frontend-provider-presets.mjs
npm run test:unit
npm run build
```

### 5.6 P1 exit gate

P1 is complete when:

- #16 has a PR.
- APIMart runtime strategy is implemented.
- OpenRouter no longer leaks OpenAI Official UI identity.
- APIMart R9 is a hard governance requirement, not a warning.
- Tests and build pass.

---

## 6. Phase P2 — Provider Preset Consolidation

### 6.1 Goal

Stop treating model shortcuts as independent providers. Canonical providers should own their model and capability aliases.

Known shortcuts requiring cleanup:

```text
12ai-nanobanana
wuyinkeji-nanobanana2
```

These are model/capability shortcuts, not provider identities.

### 6.2 Desired model

A provider preset should answer:

- Which platform handles the request?
- Which base URL or official endpoint is used?
- Which auth model applies?
- Which protocol family is supported?

A model/capability alias should answer:

- Which model id is selected?
- Which task type is optimized?
- Which provider capabilities are required?
- Which compatibility fallback is allowed?

Do not overload provider identity to mean model shortcut.

### 6.3 Implementation direction

Prefer a canonical provider model:

```ts
type ProviderAlias = {
    aliasId: string;
    canonicalProviderId: string;
    modelId?: string;
    capability?: 'image' | 'video' | 'chat' | 'multimodal';
    defaultParams?: Record<string, unknown>;
};
```

Then map shortcuts into aliases rather than provider presets.

### 6.4 P2 files to inspect

```text
apps/web/src/components/KeyManager.tsx
apps/web/src/components/Settings/APISettings.tsx
apps/web/src/services/api/providerRegistry.ts
apps/web/src/services/api/providerStrategy.ts
scripts/governance/check-frontend-provider-presets.mjs
```

### 6.5 P2 validation

- No duplicate provider host entries for the same canonical provider.
- No model shortcut appears as a standalone provider unless there is a real platform behind it.
- Key Manager preserves existing user config migration path.
- API Settings still renders known provider choices.
- Governance script fails on future duplicate shortcut providers.

Run:

```bash
node scripts/governance/check-frontend-provider-presets.mjs
npm run test:unit
npm run build
```

---

## 7. Phase P3 — Deployment and CI Hygiene

### 7.1 Goal

Align repository status checks with the active deployment model:

```text
Frontend: Vercel
Backend/API: VPS
```

Retired external deploy-preview integrations must not gate PR merge.

### 7.2 Source vs external settings

The following are source-controlled:

- `docs/setup/*`
- `.github/workflows/*`
- `package.json`
- deployment scripts committed to the repository

The following are external settings and cannot be fixed by source patches:

- GitHub App installation status contexts
- GitHub webhooks
- Branch protection required checks
- Repository integration settings

### 7.3 P3 task

Track in issue #17.

Required manual checks:

1. Repository Settings -> Webhooks.
2. Repository Settings -> Integrations / GitHub Apps.
3. Repository Settings -> Branches -> Branch protection rules.
4. Required status checks list.
5. Vercel project integration remains active.
6. VPS deployment pipeline remains documented and available.

### 7.4 P3 exit gate

- New PRs no longer receive obsolete deploy-preview status contexts.
- PR #15 is not blocked by obsolete external statuses.
- Required checks reflect active build/test/governance/deploy paths.

---

## 8. Phase P4 — Full-Stack Quality Hardening

### 8.1 Goal

Make regressions difficult and diagnosis fast. Focus on test coverage, meaningful failure messages, and release gates.

### 8.2 Backend hardening

Target areas:

- Provider key reference isolation.
- Dispatcher provider registry.
- Billing and credit transaction invariants.
- Stripe webhook signature verification.
- JWT/session enforcement.
- File/asset persistence boundaries.

Recommended test categories:

```text
provider-registry.test.ts
billing-ledger.test.ts
stripe-webhook-signature.test.ts
auth-session-boundary.test.ts
asset-storage-contract.test.ts
```

### 8.3 Frontend hardening

Target areas:

- Provider display identity.
- API Settings provider selection.
- Key Manager provider/key mapping.
- Runtime strategy resolution.
- Canvas task execution state.
- Durable generation queue behavior.

Recommended test categories:

```text
frontend-provider-registry-metadata.test.ts
provider-display-relay-label-contract.test.ts
provider-strategy-runtime.test.ts
durable-generation-queue.test.ts
canvas-runtime-state-builder.test.ts
```

### 8.4 Governance hardening

Governance scripts should:

- Fail with actionable error messages.
- Print exact file paths and offending tokens.
- Distinguish hard failures from warnings.
- Avoid network access unless explicitly designed for freshness checks.
- Be deterministic in CI.

### 8.5 P4 validation

```bash
npm run governance:check
npm run test:unit
npm run typecheck
npm run build
npm run check:encoding
```

---

## 9. Phase P5 — Architecture Modernization

### 9.1 Goal

Reduce future provider integration cost by converging provider facts into one canonical source.

Current risk:

- Provider identity exists in backend registry.
- Provider metadata exists in frontend registry.
- Runtime behavior exists in provider strategy.
- Display identity exists in provider display utilities.
- Governance scripts encode additional expectations.

This duplication is manageable now but will grow expensive as providers increase.

### 9.2 Target architecture

Introduce a canonical provider catalog that can generate or validate:

- Backend provider registry entries.
- Frontend provider metadata.
- Runtime strategy defaults.
- Display identity rules.
- Key reference expectations.
- Governance tests.
- Documentation tables.

Example shape:

```ts
interface CanonicalProviderDefinition {
    id: string;
    label: string;
    category: 'official' | 'relay' | 'browser-session' | 'system-proxy';
    protocolFamilies: Array<'openai-compatible' | 'gemini-native' | 'claude-native'>;
    knownHosts: string[];
    keyRef?: string;
    uiIdentity: string;
    runtimeStrategyId: string;
    pricingSupport: 'none' | 'manual' | 'native' | 'external';
    managementSupport: 'none' | 'native' | 'external';
}
```

### 9.3 Migration approach

Do not big-bang rewrite. Use this order:

1. Add catalog as read-only source beside current registries.
2. Add governance script comparing catalog to existing backend/frontend files.
3. Migrate one provider family at a time.
4. Generate docs from catalog.
5. Remove duplicate hardcoded maps only after tests prove parity.

### 9.4 P5 exit gate

- Adding a new relay provider requires changes in one canonical place plus tests.
- Frontend display identity and runtime strategy cannot drift silently.
- Backend key reference governance is derived from the same provider facts.

---

## 10. Standard AI Execution Workflow

For every task, follow this loop.

### 10.1 Intake

Write down:

```text
Task:
Phase:
Issue/PR:
Branch:
Files likely affected:
Non-goals:
Validation required:
Risk level:
```

### 10.2 Discovery

Use repository search and targeted file reads. Do not rely on memory.

Recommended searches:

```bash
git grep -n "providerStrategy"
git grep -n "resolveProviderRuntime"
git grep -n "uiProvider"
git grep -n "OpenAI Official"
git grep -n "apimart"
git grep -n "12ai-nanobanana"
git grep -n "wuyinkeji-nanobanana2"
```

### 10.3 Patch planning

Before editing, produce:

- Exact files to change.
- Exact behavior being added/removed.
- Tests to update/add.
- Governance scripts impacted.
- Rollback path.

### 10.4 Implementation

Rules:

- Patch locally with a diff tool when files are large.
- Avoid whole-file rewrites unless file generation is intentional.
- Preserve formatting conventions already present.
- Keep provider identity and protocol compatibility separate.
- Update tests in the same PR as behavior changes.

### 10.5 Validation

Run smallest relevant validation first, then full suite.

Provider/runtime tasks:

```bash
node scripts/governance/check-provider-registry.mjs
node scripts/governance/check-provider-presets.mjs
node scripts/governance/check-frontend-provider-presets.mjs
npm run test:unit
npm run build
```

Deployment/docs tasks:

```bash
npm run check:encoding
npm run governance:check
```

Full release readiness:

```bash
npm run verify:changes
```

### 10.6 PR documentation

Every PR must include:

- Summary.
- Changed files.
- Validation commands and results.
- Known non-goals.
- Follow-up issues.
- Any external settings that source code cannot modify.

---

## 11. Provider Identity Rules

### 11.1 Vocabulary

- Official provider: first-party API platform such as OpenAI official API or Google official API.
- Relay provider: third-party platform exposing compatible protocols.
- Browser-session provider: provider path relying on user session or reverse proxy rather than platform-owned backend keys.
- System proxy: internal routing surface, not a third-party platform identity.

### 11.2 Rules

- Protocol family answers: how do we talk to it?
- Provider identity answers: who is the platform?
- Key reference answers: which secret/config unlocks it?
- UI identity answers: what should users see?

These must not be collapsed into one boolean.

### 11.3 Examples

Correct:

```text
OpenRouter -> openai-compatible protocol, OpenRouter platform identity
APIMart -> openai-compatible protocol, APIMart platform identity
GPT-Best -> openai-compatible/gemini/claude relay, GPT-Best key reference
OpenAI official -> openai-compatible protocol, OpenAI Official identity
```

Incorrect:

```text
OpenRouter -> OpenAI Official because protocol is OpenAI-compatible
APIMart -> OpenAI Official because endpoint shape is /v1/chat/completions
GPT-Best -> Vodeshop key reference because both are relay-like
```

---

## 12. Large File Editing Policy

AI agents must treat these as high-risk files:

```text
apps/web/src/components/KeyManager.tsx
apps/web/src/components/Settings/APISettings.tsx
apps/web/src/services/api/providerStrategy.ts
apps/web/vite.config.ts
```

Rules:

- Do not replace the whole file unless using a local patch and reviewing the diff.
- Use minimal hunks.
- Re-run typecheck/build after changes.
- If a connector only supports full-file replacement, prefer writing a patch plan/comment rather than risking truncation or accidental deletion.

---

## 13. Status Checklist for Current Roadmap

### P0 checklist

- [x] Provider keyRef isolation implemented.
- [x] Backend provider registry governance added.
- [x] Frontend provider display identity governance added.
- [x] Relay metadata and baseUrl alias resolver added.
- [x] Active docs/tests/governance cleaned of retired deploy-platform assumptions.
- [x] Follow-up issues created for runtime and ops work.
- [ ] PR #15 merged.
- [ ] Full local validation completed.
- [ ] Retired external deploy status removed from required checks.

### P1 checklist

- [x] Dependent branch prepared: `fix/apimart-runtime-strategy-16`.
- [x] APIMart runtime patch plan documented in #16.
- [ ] APIMart strategy implemented.
- [ ] OpenRouter UI identity corrected in runtime strategy.
- [ ] Runtime tests added.
- [ ] APIMart R9 promoted from warning to hard requirement.
- [ ] P1 PR opened and validated.

### P2 checklist

- [ ] Identify all model shortcuts currently represented as providers.
- [ ] Design canonical provider alias model.
- [ ] Migrate `12ai-nanobanana`.
- [ ] Migrate `wuyinkeji-nanobanana2`.
- [ ] Add migration path for existing user settings.
- [ ] Add governance failures for future shortcut-provider drift.

### P3 checklist

- [x] Ops issue #17 created.
- [ ] Remove obsolete external webhooks.
- [ ] Remove obsolete GitHub App integration for this repository.
- [ ] Remove obsolete required status checks from branch protection.
- [ ] Confirm Vercel remains active.
- [ ] Confirm VPS backend deployment remains active.

### P4 checklist

- [ ] Expand runtime/provider tests.
- [ ] Expand billing/security regression tests.
- [ ] Standardize governance failure output.
- [ ] Ensure `npm run verify:changes` is reliable locally and in CI.

### P5 checklist

- [ ] Draft canonical provider catalog design.
- [ ] Add catalog-to-existing-registry governance comparison.
- [ ] Migrate provider families incrementally.
- [ ] Generate docs/governance tables from catalog.

---

## 14. Recommended Next Actions

### Immediate

1. Complete #17 in GitHub repository settings.
2. Run validation for PR #15.
3. Merge PR #15.

### Next PR

Issue #16:

```text
fix: add APIMart runtime provider strategy
```

Branch:

```text
fix/apimart-runtime-strategy-16
```

Implement:

- APIMart provider strategy.
- OpenRouter runtime UI identity correction.
- APIMart request-profile map.
- Runtime tests.
- R9 hard requirement.

### After that

Start P2 provider preset consolidation and user settings migration.

---

## 15. Definition of Done

A phase is done only when all are true:

- Code is merged.
- Tests and governance pass.
- Docs reflect the current architecture.
- PR body lists validation evidence.
- Follow-up tasks are filed for deferred scope.
- No known critical regression is hidden in notes.
- External settings required for merge/deploy have been handled or explicitly tracked.

A task is not done just because code was written. It is done when the behavior is validated and the operational path is clear.
