Status: historical

# KK Studio API Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a source-backed, complete API documentation set for KK Studio v1.6.0 that distinguishes canonical OpenAPI contracts, mounted runtime routes, compatibility endpoints, and the typed SDK.

**Architecture:** Treat `services/api/index.js` and mounted routers as the runtime source of truth, `packages/shared/src/contracts/` as the DTO source of truth, and `packages/shared/src/contracts/client/kk-api-client.ts` as the SDK source of truth. Keep `docs/specs/openapi.yaml` as the canonical contract subset and document its coverage gap instead of presenting every compatibility route as a stable public contract.

**Tech Stack:** Express/CommonJS server, TypeScript shared contracts, Fetch-based `@kk/api-client`, OpenAPI 3.0, Markdown.

## Global Constraints

- Product and version are `KK Studio v1.6.0`, sourced from `config/release-manifest.json`.
- Current server runtime is `services/api/`; archived or removed backends must not be documented as active.
- Never include real secrets, credentials, payment state, user data, or local machine paths in API examples.
- Effective paths must account for the `/api` mount applied by `services/api/index.js`.
- Duplicate route registrations must be documented according to Express mount order, with the first matching handler identified as authoritative.

---

### Task 1: Establish the API documentation entry point

**Files:**
- Create: `docs/api/README.md`
- Modify: `docs/README.md`
- Modify: `docs/specs/README.md`

**Interfaces:**
- Consumes: `services/api/index.js`, `packages/shared/src/contracts/http/envelope.ts`, `docs/specs/openapi.yaml`.
- Produces: Navigation, base URL, authentication, headers, envelope, limits, and source-of-truth rules used by every detailed reference.

- [x] **Step 1: Document API surfaces and authority order**

Describe canonical `/api/v1` contracts, runtime-only routes, compatibility aliases, webhook/static surfaces, and provider-facing specifications.

- [x] **Step 2: Document transport conventions**

Record Bearer authentication, browser credential behavior, `X-Request-Id`, `X-Client-Version`, `X-Refresh-Token`, JSON limits, CORS, error envelopes, and non-envelope legacy exceptions.

- [x] **Step 3: Add navigation links**

Link the new API hub from `docs/README.md` and link back to the hub from `docs/specs/README.md`.

- [x] **Step 4: Verify links**

Run: `rg -n "docs/api|API 文档|API reference" docs/README.md docs/specs/README.md docs/api/README.md`

Expected: all three files contain resolvable navigation entries.

### Task 2: Catalog every mounted runtime endpoint

**Files:**
- Create: `docs/api/runtime-endpoints.md`

**Interfaces:**
- Consumes: `services/api/index.js`, `services/api/routes/api.js`, `services/api/routes/contract-compat.js`, and every router below `services/api/routes/`.
- Produces: One method/path/auth/purpose row for every effective endpoint plus a duplicate/alias register.

- [x] **Step 1: Record root, health, webhook, static, and telemetry endpoints**

Include `/healthz`, `/v1/health`, `/v1/metrics`, `/webhook/stripe`, and `/uploads/*` with their nonstandard response or authentication behavior.

- [x] **Step 2: Record canonical and operational `/api` endpoints by domain**

Cover auth/profile, generation/OCR, AI assistant, provider/model configuration, workspace/assets/jobs/workflows, billing, and administration.

- [x] **Step 3: Record compatibility aliases and precedence**

Identify duplicate method/path registrations and explain that `apiRouter` is mounted before `contractCompatRouter`.

- [x] **Step 4: Compare counts against source**

Run: `rg -n '^router\.(get|post|put|patch|delete)' services/api/routes -g '*.js'`

Expected: 126 route registration statements before expanding array aliases; the documentation explains why registration count differs from unique effective endpoint count.

### Task 3: Document the typed API client and DTO map

**Files:**
- Create: `docs/api/typescript-client.md`

**Interfaces:**
- Consumes: `packages/api-client/src/index.ts`, `packages/shared/src/contracts/client/kk-api-client.ts`, DTO modules, and `packages/shared/src/contracts/http/envelope.ts`.
- Produces: Installation/import guidance, configuration contract, retry/refresh behavior, and method-to-endpoint/domain mapping.

- [x] **Step 1: Document construction and configuration**

Show a secret-free `createKkApiClient` example and explain token, refresh, version, default header, and fetch injection callbacks.

- [x] **Step 2: Document request/response behavior**

Explain envelope normalization, one-time 401 refresh retry, request IDs, HTML-response rejection, browser credentials, and refresh-header persistence.

- [x] **Step 3: Map SDK methods to domain endpoints**

List every public `KkApiClient` method grouped by auth/profile, admin, workspace, billing, model/provider, asset/generation, and workflow domains.

- [x] **Step 4: Link DTO source modules**

Map each domain to its file under `packages/shared/src/contracts/dto/` and state that `packages/api-client` re-exports `@kk/shared`.

### Task 4: Validate documentation and record handoff

**Files:**
- Modify: `docs/development/session-handoff.md`

**Interfaces:**
- Consumes: all documentation produced by Tasks 1-3.
- Produces: Validation evidence and a synchronized local Git commit.

- [x] **Step 1: Check Markdown paths and forbidden legacy claims**

Run repository searches for broken local links, removed runtime directories, real secret patterns, and path-prefix mistakes.

- [x] **Step 2: Run project checks**

Run: `npm run spec:check`, `npm run governance:check`, `npm run architecture:check`, and `npm run check:encoding` using the available Node/npm runtime; if npm remains unavailable, run the corresponding scripts directly and record the limitation.

- [x] **Step 3: Append Handoff**

Add the next numbered entry with modification scope, files, design decisions, validations, unrun checks, and risks.

- [ ] **Step 4: Commit and push**

Run: `npm run agents:commit` (or the exact Node script equivalent when npm is unavailable), then `git push -u origin main` as explicitly requested by the user.
