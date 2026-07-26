Status: reference

# KK Studio Execution Roadmap

## Product Goal

Build KK Studio into a multi-provider AI workspace that can:

1. Route across many API providers reliably
2. Generate image/video with resilient recovery
3. Offer GPT-like chat UX for daily use
4. Keep media loading near-instant with cache + local fallback

## Phase Plan

## Phase 1 - Multi API compatibility foundation (In Progress)

### Delivered in this batch

- Added provider capability registry with explicit capability matrix
  - file: `apps/web/src/services/llm/providerCapabilities.ts`
- Added capability/profile methods in the generation service
  - file: `apps/web/src/features/generation/generateService.ts`
    (the former `LLMService` was merged into it; `apps/web/src/services/llm/index.ts` keeps a compatibility export)
- Added provider-model sanity check before chat/image generation routing

### Next tasks

- Wire capability profile into Settings UI for provider/model validation hints
- Add fallback policy per provider (priority + cooldown)
- Add model capability labels (chat/image/video/multimodal) in model picker

## Phase 2 - Image/video generation reliability

### Core tasks

- Standardize generation task states: queued/running/success/fail/retryable
- Add task-level retry policy with backoff and reason codes
- Persist generation logs with requestId/provider/model for diagnosis
- Ensure generated output is always written to both browser cache and local fallback

## Phase 3 - GPT-style chat assistant UX

### Core tasks

- Streaming message UX with partial rendering and cancellation
- Message actions: retry/edit/regenerate/branch conversation
- Session list improvements: pin/search/archive
- Multimodal message attachments linked to canvas nodes

## Phase 4 - Performance and observability

### Core tasks

- Add loading SLA metrics (thumbnail hit rate / first paint latency)
- Add cache health panel (memory/idb/local)
- Add chunking optimization and lazy split for large bundles
- Add error taxonomy and actionable user hints

## Kelivo Parity Track (New)

Reference baseline: `Chevey339/kelivo` feature set.

### Mobile-first UX

- Compact mobile assistant layout (single-column action rail + sticky input)
- Mobile-safe model/provider selector with vertical-only scroll
- Background-safe task state restore after app resume

### Desktop assistant upgrades

- Stronger assistant mode: intent planning -> route to chat/image/edit/document
- Built-in web search provider abstraction (Exa/Tavily/Brave/Bing/SearXNG)
- Message-level tool actions (retry/edit/branch/regenerate)

### Multi-provider depth

- Per-provider custom request headers/body templates
- Endpoint strategy fallback chain (`chat/completions` -> `images/generations`)
- Quota/429/503 precise user messages (avoid misleading normalized errors)
- Provider-level health + cooldown policy with auto failover

### Configuration portability

- QR import/export for provider configs
- One-click backup/restore for keys + assistant presets + sessions

## Current Bugfix Priorities

> Status verified against source on 2026-07-26. Each item below records what was actually
> found in code, so the list stops drifting from reality.

## P0 (Now)

- **Inconsistent storage binding between image.id and storageId — PARTIALLY FIXED.**
  The main write path (`apps/web/src/context/CanvasContext.tsx`) and the card read path
  (`ImageCard2.tsx`) are unified on `storageId || id`. But retry generation deliberately
  diverges the two (`apps/web/src/app/useGenerationRuntime.ts` sets `id` to a timestamp string
  and `storageId` to a content hash), so every retried image has `id !== storageId` — and the
  cross-canvas node migration path in `CanvasContext.tsx` still probes and writes by `id` alone,
  duplicating bytes under a key nothing reads.

## Fixed (2026-07-26)

- **Retry button not forcing true re-hydration path.** Was worse than described: `handleRetryLoad`
  in `apps/web/src/components/image/ImageCard2.tsx` was defined but bound to nothing, so no media
  retry control rendered at all and the "本地临时图片已失效" state was a dead end. Wiring it alone
  would not have helped, because `getImage` short-circuits on a memory-cache hit with no liveness
  check and there was no per-id invalidation API. Now: `invalidateImageCache` /`rehydrateImage` in
  `apps/web/src/services/storage/imageStorage.ts` (evict without revoking — the blob URL is shared
  across the lightbox, PromptBar and canvas nodes), the ordering contract "invalidate before read"
  is pinned by `apps/web/src/services/storage/imageCacheKeys.ts`, and the retry control renders in
  both the inline error state and the overlay that covers it.

- **Sub-card preview load delays despite existing IDs.** Two independent root causes, both closed:
  1. The write path never persisted the `THUMBNAIL` tier, while the 0.35–0.8 zoom band and all
     `thumbnail-preferred` cards request exactly that tier — every read missed and fell back to
     decoding the full-size original. The tier is now written by
     `apps/web/src/services/image/qualityTierPersistence.ts`, and `getImageByQuality` lazily
     backfills the tier for pre-existing images on an idle frame.
  2. `imageLoader.cancel(imageId)` ignored quality, so the viewport prefetch cleanup — which
     re-runs on every pan/zoom — resolved the card's own in-flight promise with `null` and dropped
     it into the retry ladder. Cancellation is now quality-scoped.

## P1 (Short term)

- Long-session chat rendering lag
- Generation queue contention under high parallel count
- Local permission loss recovery issues

## Acceptance Targets

- Provider onboarding: add a new provider in less than one day
- Preview load: cache-hit cards render in under one second
- Recovery: failed generation retries succeed above 95% (transient failures)
- Chat: first stream token appears in under 300ms in normal network conditions

> None of these targets is currently measurable. The Phase 4 items above
> (cache health panel, loading SLA metrics) are the prerequisite: `getCacheStats()` in
> `apps/web/src/services/storage/imageStorage.ts` has no callers, and
> `apps/web/src/services/system/localPerformanceTrace.ts` is a dev-only `window.__KK_PERF__`
> buffer with no UI consumer that does not instrument the canvas card load path at all.
> Treat the numbers above as goals, not as anything the product reports on today.
