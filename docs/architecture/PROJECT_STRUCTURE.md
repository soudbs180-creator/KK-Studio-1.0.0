# Project Structure

This document defines current ownership rules for KK Studio v1.5.8. It is aligned with `AGENTS.md` and the live repository layout.

## Runtime truth table

| Path | Runtime role | Current rule |
| --- | --- | --- |
| `apps/web/` | primary Web runtime | Vite + React + TypeScript desktop application. New Web UI and assistant work belongs here. |
| `apps/mobile/` | mobile workspace | Expo mobile app. Mobile code must not be pulled into Web runtime. |
| `packages/shared/` | pure shared logic | Cross-runtime contracts, DTOs, and domain rules. No DOM, React, Node-only, or platform storage APIs. |
| `packages/api-client/` | HTTP boundary | Typed API client surface. Platform-specific storage must be injected, not hard-coded. |
| `packages/ui/` | design adapter layer | Tokens, base UI primitives, and adapters only. No business state or model-call logic. |
| `server/` | Express / VPS backend | Backend routes, model proxying, billing authority, webhook handling, and file persistence. No frontend components. |
| `migrations/` | database DDL | Only legal source for schema changes. Migrations must be idempotent. |
| `docs/ai-assistant/` | assistant knowledge base | Module maps, flow maps, tool registry notes, UI map, safety policy, skills, and session memory. |
| `scripts/` | automation | Governance, CI, release, verification, and maintenance scripts. |
| `tests/` | verification | Unit, integration, contract, and E2E tests. |
| `config/` | project config | Release manifest and project configuration. |

## Ownership summary

- `apps/web/` owns browser-only runtime behavior and must reach backend behavior through `packages/api-client` or a service-layer route.
- `apps/web/src/features/ai-takeover/` remains the compatibility entry for the existing assistant. New assistant capabilities must evolve from this system instead of creating a competing assistant.
- `apps/web/src/context/` owns canvas, auth, billing, startup, and related runtime Contexts. Assistant prompts must receive sanitized summaries rather than raw high-frequency state.
- `apps/web/src/services/llm/` owns model routing, provider capabilities, user-key routing, and secure proxy flows. Browser code must not directly call protected providers.
- `server/` owns privileged backend behavior, including billing authority and protected provider proxying.
- `packages/shared/`, `packages/api-client/`, and `packages/ui/` must stay inside their module boundaries as described in `AGENTS.md`.

## AI assistant structure

Current assistant work must follow this upgrade path:

```text
apps/web/src/features/ai-takeover/
  -> CanvasRuntimeState
  -> ToolRegistry + Executor
  -> DurableQueue
  -> KnowledgeSync
  -> docs/ai-assistant/*
```

The first implementation layer may remain compatible with legacy `AssistantAction` values, but tool names and documentation must converge on namespaced tools such as `canvas.getState`, `assets.zipOriginals`, and `generation.createBatchJob`.

## Local artifact policy

Temporary scripts, screenshots, diagnostics, and scratch files do not belong at the repo root. Move them into `workspace/diagnostics`, `workspace/local-artifacts`, or task-specific folders under `docs/` when they are useful records.
