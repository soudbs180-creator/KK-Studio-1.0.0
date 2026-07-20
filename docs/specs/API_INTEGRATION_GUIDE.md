# KK Studio API Integration Guide - v1.6.0

Status: current integration boundary. This guide replaces the old hosted
database, default-admin-password and browser-to-Provider examples.

## Architecture

```text
apps/web or apps/mobile
  -> @kk/api-client / createKkApiClient
    -> authenticated server/ endpoint
      -> provider dispatcher and adapter
        -> external Provider
```

Shared request/response types live in `packages/shared/`. Web features must use
the typed KK API Client rather than a raw request to `/api/*`, and neither Web
nor Mobile may transport a privileged Provider credential directly.

## Provider onboarding

1. Add or update the canonical Provider identity in
   `packages/shared/src/generation/providerCatalog.ts`.
2. Align the server dispatcher profile and adapter with the Provider's own
   documented protocol and authentication style.
3. Align the typed DTO and KK API Client method before changing UI consumers.
4. Store credentials only through the authenticated server-side configuration
   path. UI responses expose masked state, never a secret value.
5. Add contract tests for request mapping, error normalization, async polling,
   cancellation and result import.

External Provider documents describe adapter behavior; they do not authorize a
browser direct-call path. A compatibility protocol such as OpenAI-compatible
is a wire format, not a Provider identity.

## Generation and billing

Generation starts through the current API/queue boundary. Assistant batch work
uses `generation.createBatchJob`, and the durable owner is
`DurableGenerationQueue`. The server returns a runtime cost quote from the
authenticated catalog; clients must not embed fixed credit prices or assume a
successful Provider response means the requested canvas outcome was verified.

Cost-bearing and batch work requires an impact/cost preview and user
confirmation. The server owns debit, refund and reconciliation transactions.
Account balance changes, recharge review and payment confirmation are not
Agent-autonomous capabilities.

## Authentication and admin

There is no documented default administrator password. Admin access uses the
current authenticated server API and deployment-managed bootstrap process.
Database changes use reviewed files under `migrations/`; application code and
documentation must not carry copied setup SQL or password hashes.

## Verification checklist

- DTO, client method, server route and OpenAPI stable subset agree.
- Request IDs, auth refresh and abort signals survive the typed client path.
- Provider credentials never appear in browser state, logs, Tool Calls or
  documentation.
- Async Provider task states are normalized and recoverable.
- Result import records stable job/output identifiers in the canvas runtime.
- Billing quote, debit, refund and partial failure evidence are consistent.

See [TypeScript API Client](../api/typescript-client.md),
[runtime endpoints](../api/runtime-endpoints.md), and
[provider preset rules](../governance/PROVIDER_PRESET_RULES.md).
