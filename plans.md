# KK-Studio v1.4.2 Single-Line Convergence Plan

Last updated: 2026-05-06
Branch policy: continue on the current branch and current workspace unless the user explicitly asks for a branch or worktree.

## Summary

The plain `.git` metadata currently still reports baseline commit `4c448660 Refactor Clay UI and PPT runtime boundaries` and may show stale dirty state. The development fact source is the writable full Git metadata copy at `node_modules/.codex-git-full`; the latest committed baseline before the current M127 OpenAI-compatible image reference cleanup slice is `342ae802 fix: harden openai image payload extraction`. A docs-only ledger sync commit may sit above that code baseline; use alternate-git `log -1` for the exact HEAD. Use only `git --git-dir=node_modules/.codex-git-full --work-tree=.` for status, staging, diffs, and commits in this session.

The two prior execution threads are merged into one line:
- `019dd551...` remains the main refactor history.
- `019de168...` is treated as continuation work.
- Both are part of `Stage One M6 ecommerce runtime extraction`.

The active execution model for this thread has resumed Stage One convergence:
- Clay UI surface cleanup and browser evidence closed in `9e7ae2b5`.
- Ecommerce source selection closed in `ccf965c3`.
- Ecommerce partial redraw closed in `d12731ce`.
- Stage One M6 closeout scan found no remaining ecommerce-owned business branch in `src/App.tsx`; remaining ecommerce references are hook wiring, state adapters, UI prop forwarding, and render predicates.
- Connector renderer boundary hardening closed in `5f5b76e0`; the connector public-type review follow-up closed in `f06f1880`.
- Stage One Backfill M2 `usePromptGroupLayout` boundary hardening is completed in `8a458cd4`.
- Stage One Backfill M3 `useGenerationRuntime` boundary hardening is completed in `ab719c4a`; the generation billing follow-up is completed in `083db7f8`.
- Stage One Backfill M5 `usePptRuntime` quality check is completed in `569383aa`.
- Stage Two M1 `CanvasContext` state/default/context boundary extraction is completed in `92a9dc41`: it moves state model/defaults/context into `src/context/canvasContextState.ts` and canvas compatibility syncing into `src/context/canvasCompatibility.ts`.
- Stage Two M2 `CanvasContext` selection reducer extraction is completed in `e0f1b583`: it moves replace/add/remove/toggle selection semantics into `src/context/canvasSelection.ts`, without touching drag, persistence, or mutation ownership.
- Stage Two M3 `CanvasContext` prompt child image resolver extraction is completed in `83cc8d7f`: it moves prompt-to-generated-image child ID resolution into `src/context/canvasPromptChildImages.ts`, without touching startup recovery, persistence writes, drag, node mutations, UI, or release metadata.
- Stage Two M4 `CanvasContext` workflow source node ID resolver extraction is completed in `9ec4dbb1`: it moves utility workflow `data.sourceNodeIds` filtering/deduping into `src/context/canvasWorkflowSourceNodeIds.ts`, without touching workflow edge creation/pruning, drag, persistence, node mutations, UI, or release metadata.
- Stage Two M5 `CanvasContext` media recovery extraction is completed in `002ee6fe`: it moves recovered media cache hydration and original-source resolution into `src/context/canvasMediaRecovery.ts`, without touching startup restore ordering, persisted task hydration, local folder refresh behavior, UI, release metadata, drag, or node mutations.
- Security/release cleanup completed after M5: `4cdbf4cf` overrides `protobufjs` to `7.5.5`; `567f85aa` refreshes portable stable release metadata; `0c5cadde` keeps Nutrient OCR keys server-side; `333f2551` updates `postcss` to `8.5.13`; `b6620ef2` removes the dead AI12 service file after reference-proofed pruning.
- Stage Two M6 `CanvasContext` prompt recovery normalization extraction completed in `53f80d80`: it moved startup prompt recovery normalization into `src/context/canvasPromptRecovery.ts`, while leaving async persisted-result recovery and hydration effects in `CanvasContext.tsx`.
- Stage Two M7 `CanvasContext` persisted image recovery helper extraction completed in `0a5c2339`: it moved persisted task/result recovery entries, URL resolution, and recovery-signature construction into `src/context/canvasPersistedImageRecovery.ts`, while leaving the React hydration effect in `CanvasContext.tsx`.
- Stage Two M8 `CanvasContext` canvas merge helper extraction completed in `b68867dd`: it moved canvas card counting, snapshot merge, and preferred active-canvas selection into `src/context/canvasMerge.ts`, while leaving cloud/local-folder restore effects in `CanvasContext.tsx`.
- Stage Two M9 `CanvasContext` invalid-card cleanup helper extraction completed in `7d8a4331`: it moved invalid prompt/image cleanup, utility workflow pruning, group pruning, and selection filtering into `src/context/canvasCleanup.ts`, while leaving public context orchestration in `CanvasContext.tsx`.
- Stage Two M10 `CanvasContext` placement helper extraction completed in `3abdd250`: it moved next-card, smart-collision, and next-group position calculations into `src/context/canvasPlacement.ts`, while leaving public context callbacks in `CanvasContext.tsx`.
- Stage Two M11 `CanvasContext` layering helper extraction completed in `c171de38`: it moved bring-to-front z-index expansion and assignment into `src/context/canvasLayering.ts`, while leaving the public context callback in `CanvasContext.tsx`.
- The legacy Netlify raw-key endpoint cleanup completed in `0603547a`: it removed public raw-key BYOK function endpoints and extended security governance while preserving the legitimate `pricing-proxy` function.
- Stage Two M12 `CanvasContext` group management helper extraction completed in `5994c34b`: it moved `addGroup`, `removeGroup`, and `updateGroup` canvas transforms into `src/context/canvasGroups.ts`.
- Stage Two M13 `CanvasContext` selected-node movement helper extraction completed in `4722acbe`: it moved pure movement transforms into `src/context/canvasMovement.ts`, while preserving RAF batching and public move callbacks in `CanvasContext.tsx`.
- Stage Two M14 `CanvasContext` node tag helper extraction completed in `d7a9d0a7`: it moved tag update transforms into `src/context/canvasTags.ts`, while preserving public `setNodeTags` and `updateCanvas` ownership.
- Stage Two M15 `CanvasContext` node update helper extraction completed in `c9d39bb2`: it moved image dimension, image update, and batch node update transforms into `src/context/canvasNodeUpdates.ts`.
- Stage Two M16 `CanvasContext` position update helper extraction completed in `c80ffa70`: it moved prompt/image position update transforms into `src/context/canvasPositionUpdates.ts`, preserving public position wrappers and `updateCanvas` ownership.
- Stage Two M17 `CanvasContext` prompt-image relationship helper extraction completed in `c46a4c49`: it moved prompt/image link and unlink transforms into `src/context/canvasPromptImageLinks.ts`, preserving public relationship wrappers, history/urgent-save side effects, and `updateCanvas` ownership.
- Stage Two M18 `CanvasContext` workflow update helper extraction completed in `fbe26764`: it moved workflow utility node transforms into `src/context/canvasWorkflowUpdates.ts`, preserving public workflow wrappers, the legacy-node warning/guard, history side effects, and `updateCanvas` ownership.
- Stage Two M19 `CanvasContext` image deletion helper extraction completed in `16d805cb`: it extended `src/context/canvasPromptImageLinks.ts` with the pure image deletion transform, preserving storage deletion, Blob URL revocation, urgent-save, history, and `updateCanvas` ownership in `CanvasContext.tsx`.
- Stage Two M20 `CanvasContext` merge-into helper extraction completed in `943af671`: it moved the pure `mergeCanvasInto` state transform into `src/context/canvasMergeInto.ts`, preserving the public wrapper, `setState` ownership, summary return shape, duplicate skipping, position offsets, source delete/empty behavior, and selection clearing.
- Stage Two M21 `CanvasContext` unused-code cleanup completed in `c0c37736`: it removed source-proven unused imports, unused auto-arrange constants, and write-only layout variables.
- Stage Two M22 `CanvasContext` arrange-selection helper extraction completed in `bfc6fb8a`: it moved the single selected prompt child-card arrangement branch into `src/context/canvasArrangeSelection.ts`.
- Stage Two M23 `CanvasContext` duplicate selected-arrange cleanup completed in `9769ea7f`: it removed the unreachable duplicate selected-arrange fallback.
- Stage Two M24 `CanvasContext` selected-root arrange extraction completed in `c1a76a43`: it moved multi-root selected arrange into `src/context/canvasArrangeSelection.ts`, preserving row/grid/column root positioning and child sync while removing the local `any[]` root list from `CanvasContext.tsx`.
- Stage Two M25 `CanvasContext` selected-group arrange extraction completed in `1318d84d`: it moved the remaining selected grouped arrange fallback into `src/context/canvasArrangeSelection.ts`, preserving prompt+child single-root layout, PPT column override, selected-count fallthrough, and `subCardLayoutMode` behavior.
- Stage Two M26 `CanvasContext` full-canvas auto-arrange extraction completed in `7cbd7346`: it moved full-canvas auto-arrange position calculation into `src/context/canvasAutoArrange.ts`, preserving normal/follow-up/orphan/error layout behavior while keeping `setState`, `lastModified`, and localStorage persistence in `CanvasContext.tsx`.
- Stage Two M27 `CanvasContext` prompt node update extraction completed in `b16843ee`: it extends `src/context/canvasNodeUpdates.ts` with pure prompt add/update reducers while keeping reference-image persistence, logging, and user notifications in `CanvasContext.tsx`.
- Stage Two M28 `keyManager` model helper extraction completed in `a174b557`: it moves model parsing, migration, normalization, variant parsing, and variant label helpers into `src/services/auth/keyManagerModelHelpers.ts` while preserving `keyManager.ts` compatibility exports.
- Stage Two M29 `keyManager` key type helper extraction is completed in `3ce7ae59`: it moves `determineKeyType` into `src/services/auth/keyManagerKeyType.ts`, preserves `keyManager.ts` compatibility re-export, and removes the `keyManagerEffectiveSlot.ts -> keyManager.ts` back edge.
- Stage Two M30 `modelIdNormalization` parity consolidation is completed in `08eb89d8`: it makes `src/utils/modelIdNormalization.ts` a compatibility facade over `src/services/auth/keyManagerModelHelpers.ts` so the migration map, normalization, and variant parser have one source of truth.
- Stage Two M31 `keyManager` provider runtime-state merge extraction is completed in `56debf21`: it moves the pure cloud/local provider pricing and activity merge into `src/services/auth/keyManagerProviders.ts`, while leaving cloud persistence, localStorage policy, credential redaction, token refresh, and backoff behavior in their existing owners.
- Stage Two M32 `keyManager` provider linked-slot matching extraction is completed in `615b7969`: it moves duplicated provider-to-legacy-slot matching into `src/services/auth/keyManagerProviderLinks.ts`, while leaving slot mutation, saveState, runtime/auth/model resolution, and provider persistence orchestration in `keyManager.ts`.
- Stage Two M33 `keyManager` provider usage helper extraction is completed in `dd3ad358`: it moves usage limit checks and provider usage delta math into `src/services/auth/keyManagerProviderUsage.ts`, while leaving provider lookup, load/save, notifications, and cloud sync in `keyManager.ts`.
- Stage Two M34 `keyManager` route ID helper extraction is completed in `a598312d`: it moves route suffix decoding, slot/provider suffix matching, and stable route ID builders into `src/services/auth/keyManagerRouteIds.ts`, while leaving routing selection, model filtering, slot/provider lookup, and persistence orchestration in `keyManager.ts`.
- Stage Two M35 `keyManager` credential sanitizer extraction is completed in `531eae6b`: it moves the duplicated ASCII API-key sanitizer into `src/services/auth/keyManagerCredentialSanitizer.ts`, while leaving credential storage, provider persistence, browser diagnostics policy, and runtime routing unchanged.
- Stage Two M36 `keyManager` channel config secret redaction extraction is completed in `7b54fd1a`: it moves the channel config API-key blanking policy into `src/services/auth/keyManagerChannelConfigSecrets.ts`, while leaving channel config construction, credential storage, provider persistence, and runtime routing unchanged.
- Stage Two M37 `keyManager` dead-code pruning is completed in `4658d947`: it removes only source-proven unused local helper definitions from `src/services/auth/keyManager.ts`, while leaving exported APIs, credential storage, provider persistence, channel config behavior, and runtime routing unchanged.
- Stage Two M38 `keyManager` browser-direct diagnostics message wrapper pruning is completed in `afe89b71`: it removes a private message passthrough wrapper and points the three browser-runtime diagnostic returns at the storage-owned constant directly.
- Stage Two M39 `keyManager` legacy Google model constant pruning is completed in `1214ab98`: it removes a now-unreferenced migration-era constant from `src/services/auth/keyManager.ts` and extends the existing dead-code contract.
- Stage Two M40 `keyManager` pricing model ID extraction helper split is completed in `031f3ec7`: it moves only the pure `extractModelIdsFromPricingData` helper into `src/services/auth/keyManagerModelHelpers.ts`, preserving model discovery fallback behavior.
- Stage Two M41 `keyManager` model category helper split is completed in `46045a80`: it moves only the pure public `categorizeModels` helper into `src/services/auth/keyManagerModelHelpers.ts`, preserving `keyManager.ts` compatibility exports.
- Stage Two M42 `keyManager` model type inference helper split is completed in `ea2ad869`: it moves only the pure `inferModelType` classifier and `GlobalModelType` type into `src/services/auth/keyManagerModelHelpers.ts`, preserving global model list classification.
- Stage Two M43 `keyManager` silent pricing URL helper split is completed in `54cd8312`: it moves only the pure pricing endpoint URL normalization used by the non-blocking model-discovery pricing probe into `src/services/auth/keyManagerPricingUrl.ts`.
- Stage Two M44 `keyManager` deprecated-model helper split is completed in `c435de27`: it moves only the pure `isDeprecatedModel` membership helper into `src/services/auth/keyManagerModelHelpers.ts`.
- Stage Two M45 `keyManager` 12AI base URL dead-code pruning is completed in `6cada9ad`: it removes only the source-proven unused local `get12AIBaseUrl` wrapper and now-unused `RegionService` import from `src/services/auth/keyManager.ts`.
- Stage Two M46 `keyManager` Google official model predicate split is completed in `eb3ac527`: it moves only the pure `isGoogleOfficialModelId` predicate into `src/services/auth/keyManagerModelHelpers.ts`.
- Stage Two M47 `keyManager` channel capabilities helper split is completed in `8b40e892`: it moves only the pure `buildChannelCapabilities` builder into `src/services/auth/keyManagerChannelCapabilities.ts`.
- Stage Two M48 `keyManager` API type detector helper split is completed in `f812b66c`: it moves only the pure `detectApiType` string classifier into `src/services/auth/keyManagerApiType.ts`.
- Stage Two M49 `keyManager` default model constants helper split is completed in `7005bd50`: it moves only default/whitelist model constants into `src/services/auth/keyManagerDefaultModels.ts`.
- Stage Two M50 `keyManager` provider presets helper split is completed in `549a2422`: it moves only preset provider data into `src/services/auth/keyManagerProviderPresets.ts`.
- Stage Two M51 `keyManager` documented static model helper split is completed in `81ba2a24`: it moves only the 12AI documented static model fallback lookup into `src/services/auth/keyManagerProviderPresets.ts`, preserving `keyManager.ts` compatibility exports and existing call sites.
- Stage Two M52 `keyManager` model-list normalization helper split is completed in `f5153811`: it moves only `BLACKLIST_MODELS`, the private model-filter predicate, and `normalizeModelList` into `src/services/auth/keyManagerModelList.ts`, preserving `keyManager.ts` compatibility exports and existing call sites.
- Stage Two M53 `keyManager` global-model dead-code cleanup is completed in `74d6345a`: it removes only the duplicate `getGlobalModelList` JSDoc block and the source-proven unused local `chatModelIds` allocation, preserving model list assembly, provider state, remote fetch behavior, and runtime routing.
- Stage Two M54 `keyManager` effective provider model helper split is completed in `dd2295d3`: it moves only official-default and documented-provider model fallback selection into `src/services/auth/keyManagerEffectiveProviderModels.ts`, preserving `keyManager.ts` compatibility exports and existing call sites.
- Stage Two M55 `keyManager` provider limit delegator pruning is completed in `6902b79b`: it removes only redundant private provider limit forwarding methods and calls the already extracted `keyManagerEffectiveSlot` helpers directly.
- The final-gate fixture repair closed in `ff419de9`; the payment sidecar dependency audit gap closed in `58be183d`.
- Stage Two M56 `OpenAICompatibleAdapter` diagnostics preview extraction is completed in `0edb13f5`: it moves safe JSON/multipart request preview redaction into `src/services/llm/openAICompatibleDiagnostics.ts` without changing provider routing, endpoints, auth, fetch behavior, UI, or release metadata.
- Stage Two M57 `OpenAICompatibleAdapter` image-routing error classifier extraction is completed in `8f878b3a`: it moves chat/images compatibility and quota fail-closed error classifiers into `src/services/llm/openAICompatibleImageRoutingErrors.ts` without changing provider routing, endpoints, auth, fetch behavior, UI, or release metadata.
- Stage Two M58 `OpenAICompatibleAdapter` unreachable image fallback cleanup is completed in `96b94e5e`: it removes post-throw automatic fallback code that could not execute after billing-safe compatibility errors, without changing provider routing, endpoint selection, auth, fetch behavior, UI, or release metadata.
- Stage Two M107 `OpenAICompatibleAdapter` image dispatch helper extraction is completed in `9764ba70`: it moves post-surface image dispatch planning into `src/services/llm/openAICompatibleImageDispatch.ts` while leaving doc URL rejection, `resolveChannelRuntime`, `resolveImageSurface`, endpoint builders, auth, fetch behavior, logging, and billing-safe fallback throws in `OpenAICompatibleAdapter.ts`.
- Stage Two M108 `OpenAICompatibleAdapter` image payload helper extraction is completed in `268ed882`: it moves response image URL and base64 extraction into `src/services/llm/openAICompatibleImagePayload.ts` while leaving endpoint selection, auth, fetch behavior, task polling, and compatibility fallback ordering in `OpenAICompatibleAdapter.ts`.
- Stage Two M109 `OpenAICompatibleAdapter` image sizing/profile helper extraction is completed in `f2de4377`: it moves OpenAI image profile, aspect orientation, image count clamping, generation size, and edit size resolution into `src/services/llm/openAICompatibleImageSizing.ts` while leaving endpoint selection, auth, fetch behavior, task polling, and edit endpoint routing in `OpenAICompatibleAdapter.ts`.
- Stage Two M110 `OpenAICompatibleAdapter` task payload helper extraction is completed in `d229c791`: it moves generic task ID extraction, task status mapping, and task-item list extraction into `src/services/llm/openAICompatibleTaskPayload.ts` while leaving endpoint selection, auth, fetch behavior, polling request URLs, backoff, provider branch selection, and result metadata assembly in `OpenAICompatibleAdapter.ts`.
- Stage Two M111 `OpenAICompatibleAdapter` task result helper extraction is completed in `3dab3056`: it moves provider message extraction and polled task result assembly into `src/services/llm/openAICompatibleTaskPayload.ts` while leaving endpoint selection, auth, fetch behavior, polling request URLs, backoff, provider branch selection, immediate result handling, and fallback ordering in `OpenAICompatibleAdapter.ts`.
- Stage Two M112 `local-user-route-proxy-service` auth helper extraction is completed in `296c1203`: it moves local user-route auth/header/query-key, route strategy, route format, and image-surface pure helpers into `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts` while leaving endpoint selection, fetch execution, task operations, credential retrieval/storage, provider branch execution, fallback ordering, billing metadata, release metadata, and UI behavior in the service.
- Stage Two M113 `local-user-route-proxy-service` endpoint helper extraction is completed in `617491b3`: it moves direct OpenAI/Claude/Gemini endpoint URL normalization into `apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts` while leaving auth/header/query-key behavior, endpoint call sites, fetch execution, task operations, credential retrieval/storage, provider branch execution, fallback ordering, billing metadata, release metadata, and UI behavior in the service.
- The post-M113 review/gate repair is completed in `5c269e78`: it hardens KK API session signing, system proxy task signing, refresh-token rotation, release guardrails, OCR defaults, and canvas id forwarding.
- Stage Two M114 `keyManager` shared pricing helper extraction is completed in `245bdd4b`: it moves raw shared pricing catalog normalization and pricing snapshot construction into `src/services/auth/keyManagerSharedPricing.ts`, while leaving provider fetches, provider persistence, cloud sync, key storage, route selection, runtime model resolution, and UI behavior unchanged.
- Stage Two M115 `keyManager` remote model discovery helper extraction is completed in `ed444606`: it moves pure Google/Gemini/OpenAI-compatible model discovery response parsing and canonical dedupe into `src/services/auth/keyManagerRemoteModelDiscovery.ts`, while leaving fetch execution, endpoint selection, auth/header behavior, provider persistence, cloud sync, key storage, route selection, runtime model resolution, and UI behavior unchanged.
- Stage Two M124 `OpenAICompatibleAdapter` AceData route helper extraction is completed in `53338975`: it moves AceData base URL normalization, direct route extraction, alias/candidate route resolution, reference-image normalization, and image-size delegation into `src/services/llm/openAICompatibleAceDataRoute.ts`, while leaving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata unchanged.
- Stage Two M125 `OpenAICompatibleAdapter` 12AI async and chat-image helper extraction is completed in `42dcaa17`: it moves pure 12AI async route/base-url/size/quality/reference helpers into `src/services/llm/openAICompatible12AIAsyncRoute.ts` and moves structured chat-image candidate selection into `src/services/llm/openAICompatibleImagePayload.ts`, while leaving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata unchanged.
- Stage Two M126 `OpenAICompatibleAdapter` image payload security hardening is completed in `342ae802`: it allowlists structured response URL schemes to `http(s)` or safe image data URLs, constrains base64 MIME types to common raster images, skips unsafe candidates before best-image selection, and falls back invalid raw base64 MIME labels to `image/png`, while leaving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata unchanged.
- Stage Two M127 `OpenAICompatibleAdapter` image reference cleanup is completed in the current slice: it moves repeated reference-image formatting into `src/services/llm/openAICompatibleImageReferences.ts` and deletes unreachable commented legacy delegate bodies, while leaving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata unchanged.
- The source-proven unused cleanup line now includes the M60-M106 cleanup commits through secure proxy route-gate wiring, plus later M114-M119, the post-M120 UI closure commits `da4ffc79` / `485a6bef` / `1ca080eb`, and the `5aaccf50` ecommerce analysis fallback hotfix. The active line is now finalization audit plus fresh seam-map giant-file splitting after the M127 OpenAI-compatible image reference cleanup slice.
- The project is functionally green after the 2026-05-06 full finalization gate, but not final-complete while `App.tsx`, `PromptBar.tsx`, `OpenAICompatibleAdapter.ts`, `keyManager.ts`, and `CanvasContext.tsx` remain giant-file split targets and Stage Three/Stage Four remain open.

The Clay UI source remains `C:/Users/Administrator/Downloads/DESIGN-clay.md`, `DESIGN.md`, `docs/DESIGN.md`, `.agent/rules/skills/SKILL.md`, shared CSS tokens, and existing UI surfaces. Current user override: inputs, main cards, sub cards, and framework cards use controlled frosted material. Dark mode uses neutral black-gray surfaces (`#0b0b0c`, `#141414`, `#1f1f1f`), not teal/blue/indigo canvas. Clay brand colors are emphasis only.

Commit boundary going forward: UI fixes, runtime/PPT/ecommerce fixes, release metadata, final audit fixes, and Stage Two architecture splits must be staged separately. Key storage, permission checks, encryption helpers, provider credential management, cloud sync, provider persistence, shared pricing cache construction, runtime routing, fetch/header behavior, endpoint selection, 12AI runtime URL resolution, and channel config behavior remain excluded unless a future scoped milestone explicitly maps one of those seams.

## Current Baseline

- `src/App.tsx`: 4328 physical lines after the latest Stage Two cleanup line.
- `src/app/useConnectorRenderer.ts`: 253 lines, boundary hardened in `5f5b76e0` and review-follow-up typechecked in `f06f1880`.
- `src/app/usePromptGroupLayout.ts`: 1348 lines, extracted and boundary-hardened in `8a458cd4`.
- `src/app/useGenerationRuntime.ts`: 2603 lines, extracted and boundary-hardened in `ab719c4a`; generation billing cleanup completed in `083db7f8`; unused import cleanup completed in `d4291729`.
- `src/app/usePptRuntime.ts`: 1289 lines, extracted in `4c448660` and semantically boundary-checked in `569383aa`.
- `src/app/pptRuntimeHelpers.ts`: 152 lines, semantically boundary-checked in `569383aa`.
- `src/context/CanvasContext.tsx`: 2197 physical lines after Stage Two CanvasContext extractions and later cleanup, down from 5218 text lines at the start of Stage Two.
- `src/context/canvasContextState.ts`: 114 lines, new Stage Two M1 state/default/context boundary module.
- `src/context/canvasArrangeSelection.ts`: 601 lines, Stage Two M22/M24/M25 selected arrange helper.
- `src/context/canvasAutoArrange.ts`: 360 lines, Stage Two M26 full-canvas auto-arrange position helper.
- `src/context/canvasCompatibility.ts`: 8 lines, new Stage Two M1 canvas workflow/ecommerce compatibility helper.
- `src/context/canvasSelection.ts`: 35 lines, new Stage Two M2 selection reducer helper.
- `src/context/canvasPromptChildImages.ts`: 55 lines, new Stage Two M3 prompt child image resolver helper.
- `src/context/canvasWorkflowSourceNodeIds.ts`: 19 lines, Stage Two M4 workflow source ID resolver helper.
- `src/context/canvasMediaRecovery.ts`: 82 lines, Stage Two M5 media recovery helper.
- `src/context/canvasPromptRecovery.ts`: 184 lines, Stage Two M6 prompt recovery helper.
- `src/context/canvasPersistedImageRecovery.ts`: 301 lines, Stage Two M7 persisted image recovery helper.
- `src/context/canvasMerge.ts`: 122 lines, Stage Two M8 canvas merge helper.
- `src/context/canvasMergeInto.ts`: 130 lines, Stage Two M20 merge-into helper.
- `src/context/canvasCleanup.ts`: 155 lines, Stage Two M9 invalid-card cleanup helper.
- `src/context/canvasPlacement.ts`: 189 lines, Stage Two M10 placement helper.
- `src/context/canvasLayering.ts`: 185 lines, Stage Two M11 layering helper.
- `src/context/canvasGroups.ts`: 41 lines, Stage Two M12 group management helper.
- `src/context/canvasMovement.ts`: 84 lines, Stage Two M13 selected-node movement helper.
- `src/context/canvasTags.ts`: 9 lines, Stage Two M14 tag update helper.
- `src/context/canvasNodeUpdates.ts`: 108 lines, Stage Two M15/M27 node update helper.
- `src/context/canvasPositionUpdates.ts`: 104 lines, Stage Two M16 position update helper.
- `src/context/canvasPromptImageLinks.ts`: 62 lines, Stage Two M17 prompt-image relationship helper plus Stage Two M19 image deletion transform.
- `src/context/canvasWorkflowUpdates.ts`: 148 lines, Stage Two M18 workflow update helper.
- `src/services/auth/keyManager.ts`: 3594 physical lines after the latest keyManager cleanup/extraction line.
- `src/services/auth/keyManagerApiType.ts`: 23 lines, Stage Two M48 API type detector helper boundary.
- `src/services/auth/keyManagerChannelCapabilities.ts`: 23 lines, Stage Two M47 channel capabilities helper boundary.
- `src/services/auth/keyManagerDefaultModels.ts`: 53 lines, Stage Two M49 default model constants helper boundary.
- `src/services/auth/keyManagerProviderPresets.ts`: 156 lines, Stage Two M50 provider presets helper boundary plus Stage Two M51 documented static model fallback helper.
- `src/services/auth/keyManagerChannelConfigSecrets.ts`: 3 lines in the completed M36 channel config secret boundary.
- `src/services/auth/keyManagerCredentialSanitizer.ts`: 3 lines in the active M35 credential sanitizer boundary.
- `src/services/auth/keyManagerProviderLinks.ts`: 154 lines in the active M32 provider link helper boundary.
- `src/services/auth/keyManagerProviderUsage.ts`: 67 lines in the active M33 provider usage helper boundary.
- `src/services/auth/keyManagerRouteIds.ts`: 94 lines in the active M34 route ID helper boundary.
- `src/services/auth/keyManagerProviders.ts`: 102 lines in the active M31 provider helper boundary.
- `src/services/auth/keyManagerStorage.ts`: 34 lines after the Node ESM import compatibility adjustment.
- `src/services/auth/keyManagerModelHelpers.ts`: 342 lines, Stage Two M28/M30/M40/M41/M42/M44/M46 pure model helper boundary.
- `src/services/auth/keyManagerModelList.ts`: 80 lines, Stage Two M52 model-list normalization helper boundary.
- `src/services/auth/keyManagerEffectiveProviderModels.ts`: 54 lines, Stage Two M54 effective provider model fallback helper boundary.
- `src/services/auth/keyManagerKeyType.ts`: 9 lines, Stage Two M29 key type helper boundary.
- `src/services/auth/keyManagerPricingUrl.ts`: 12 lines, Stage Two M43 silent pricing URL helper boundary.
- `src/services/auth/keyManagerSharedPricing.ts`: 136 lines, Stage Two M114 shared pricing catalog/snapshot helper boundary.
- `src/services/auth/keyManagerRemoteModelDiscovery.ts`: 130 lines, Stage Two M115 remote model discovery response parsing helper boundary.
- `src/utils/modelIdNormalization.ts`: 6 lines after M30 compatibility-facade consolidation, down from 84 duplicated helper lines.
- `src/components/layout/PromptBar.tsx`: 3631 physical lines.
- `src/components/canvas/PromptNodeComponent.tsx`: 2121 physical lines after the latest ecommerce canvas-workbench wiring and cleanup.
- `src/components/layout/ChatSidebar.tsx`: 2477 physical lines after `3108a29f`.
- `src/components/settings/ApiSettingsView.tsx`: 3071 physical lines.
- `src/components/settings/views/SystemLogsView.tsx`: 421 physical lines after the current unused cleanup working tree.
- `src/components/settings/views/SystemLogsView.localized.tsx`: 450 physical lines after the current unused cleanup working tree.
- `src/components/Onboarding/AchievementToast.tsx`: 60 physical lines after the current unused cleanup working tree.
- `src/components/Onboarding/OnboardingManager.tsx`: 262 physical lines after the current unused cleanup working tree.
- `src/components/Onboarding/OnboardingOverlay.tsx`: 200 physical lines after the current unused cleanup working tree.
- `src/components/Onboarding/useOnboardingProgress.ts`: 137 physical lines after the current unused cleanup working tree.
- `src/services/storage/fileSystemService.ts`: 1384 physical lines.
- `src/services/llm/OpenAICompatibleAdapter.ts`: 2862 physical lines after the current M127 image reference cleanup working tree; `src/services/llm/openAICompatible12AIAsyncRoute.ts`: 100 physical lines; `src/services/llm/openAICompatibleAceDataRoute.ts`: 153 physical lines; `src/services/llm/openAICompatibleChatPayload.ts`: 66 physical lines; `src/services/llm/openAICompatibleGoogleExtraBody.ts`: 62 physical lines; `src/services/llm/openAICompatibleImageDispatch.ts`: 91 physical lines; `src/services/llm/openAICompatibleImagePayload.ts`: 254 physical lines after M126 URL/MIME hardening; `src/services/llm/openAICompatibleImageReferences.ts`: 57 physical lines in the current M127 working tree; `src/services/llm/openAICompatibleImageSizing.ts`: 99 physical lines; `src/services/llm/openAICompatibleTaskPayload.ts`: 219 physical lines.
- `apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts`: 1907 physical lines after the M123 task-token helper extraction; `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts`: 370 physical lines; `apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts`: 46 physical lines; `apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts`: 160 physical lines.
- `src/services/llm/openAICompatibleDiagnostics.ts`: 86 physical lines in the diagnostics preview helper boundary.
- `src/services/llm/openAICompatibleImageRoutingErrors.ts`: 49 physical lines in the completed M57 image-routing error classifier boundary.
- `apps/web/`: migration target, not the first edit location.
- `apps/api/`: DDD back-end structure, not part of this refactor unless compatibility checks require it.

## Execution Loop

Every milestone follows this order:

1. Read the local implementation and relevant tests.
2. Add or update a focused contract/unit test first when behavior or structure changes.
3. Implement only the scoped extraction or cleanup.
4. Run the milestone validation commands from `validation.md`.
5. Fix any new failure before continuing.
6. Update `status.md` with line counts, validation output, risks, and the next step.
7. Stage only files in scope.
8. Create one scoped git commit.
9. Continue to the next milestone.

## Milestones

### 0. Clay Frosted UI Audit (Completed In `9e7ae2b5`)

Goal: replace the older Apple/dark-heavy/Airtable UI drift with a Clay system: warm cream light theme, neutral black-gray dark theme, controlled frosted material for inputs/main cards/sub cards/framework cards, near-black or cream readable text, saturated color blocks for emphasis, no blue/teal dark canvas, and no whole-page theme flicker.

Current status: completed in this thread. Runtime/PPT/ecommerce work has resumed and must stay in separate runtime commits.

Scope:
- Create the root `DESIGN.md` Clay reference from the cached `getdesign` Clay guidance.
- Rewrite `docs/DESIGN.md` and `.agent/rules/skills/SKILL.md` so Clay is canonical.
- Refactor `src/index.css` tokens toward Clay canvas `#fffaf0`, ink `#0a0a0a`, neutral dark canvas `#0b0b0c`, neutral dark surfaces `#141414` / `#1f1f1f`, controlled frosted surface tokens, and Clay pink/coral/teal accents.
- Rework `SearchPalette.tsx`, `ThemeContext.tsx`, canvas-card shadow helpers, settings surface tokens, and responsive surface contracts around shared Clay tokens.
- Apply frosted tokens to search palette, sidebar, mobile shell, prompt/composer input, settings inputs/cards/shells, storage/tag/image option modals, prompt/image/framework canvas cards, and ecommerce panels where those surfaces already exist.
- Preserve unrelated billing/API backend work and do not stage unrelated paths.

Acceptance:
- UI contract tests cover Clay manual/rule presence, light/dark contrast, dark canvas neutrality, flat card depth, search palette constraints, responsive settings/search surfaces, and no whole-document theme transition.
- Search palette has no heavy Tailwind shadows, no local indigo selected state, no inline focus mutation, and uses separate desktop command-surface and mobile bottom-sheet geometry.
- Settings and onboarding keep separate mobile and desktop logic.
- Infinite canvas dark background is `#0b0b0c`, not blue/teal; main/sub/framework surfaces use tokenized frosted material with readable solid fallbacks.
- Documentation and agent rules name Clay as the canonical UI system and preserve existing governance-required rule sections.
- Clay/UI changes are reviewed separately from runtime/PPT changes, with browser evidence recorded before a UI commit.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/clay-global-ui-refit-contract.test.ts tests/unit/clay-frosted-surface-contract.test.ts tests/unit/theme-contrast-contract.test.ts tests/unit/responsive-surface.test.ts tests/unit/theme-system-adaptation.test.ts tests/unit/settings-entry-surface-style-regression.test.ts`
- `npm.cmd run verify:mobile-settings-smoke`
- `npm.cmd run verify:desktop-settings-smoke`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Commit:
- `refactor: audit clay frosted ui surfaces`

### 1. Refactor Ledger Alignment

Goal: make `plans.md`, `implement.md`, `status.md`, and `validation.md` describe the v1.4.2 refactor line.

Acceptance:
- The four ledger files identify `d12731ce` as the then-current alternate-git baseline, name plain `.git` as stale/historical, and describe the single merged execution line.
- The previous recovery stream and dual-thread state remain acknowledged as history, not the active plan.
- The next active step is Stage One Backfill M1 `useConnectorRenderer` hardening.
- Documentation validation and encoding checks pass.

Validation:
- `npm.cmd run governance:agent-docs`
- `npm.cmd run check:encoding`

Commit:
- `docs: align v1.4.2 refactor plan`

### 2. Stage One M6 Closeout: Remaining Ecommerce Branch Scan (Completed)

Goal: finish Stage One M6 by proving whether any ecommerce-owned branch remains in `src/App.tsx`.

Scope:
- Scan `src/App.tsx` for remaining ecommerce-owned handlers, state branches, redraw/source-selection branches, and framework-status glue.
- If a clear remaining ecommerce branch exists, split exactly one smallest runtime hook and contract test.
- If no clear branch exists, update the ledger to mark Stage One M6 complete and move to Stage One backfill.
- Do not mix this scan with connector, prompt-group, generation, PPT, UI, or release metadata work.
- Result: no new M6 runtime slice is required. Remaining ecommerce hits in `src/App.tsx` are orchestration-only: source selection calls `resetEcommerceSourceSelectionState`, partial redraw calls `resolveEcommercePartialRedrawContext` and `finalizeEcommercePartialRedrawResult`, submit uses `handleEcommerceSubmitGuard`, and the state adapter block only patches hook state.

Acceptance:
- A source map records every remaining ecommerce reference category in `src/App.tsx`.
- The next action is explicit: either one named smallest hook slice with tests, or M6 completion.
- Browser QA is skipped only if no UI surface changed, with the reason recorded in `status.md`.

Validation:
- If docs/scan-only: `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited `git diff --check`.
- If runtime code changes: the active ecommerce targeted tests, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build`, `npm.cmd run governance:agent-docs`, `npm.cmd run check:encoding`, and path-limited `git diff --check`.

Commit:
- `docs: close ecommerce runtime extraction map` if scan-only.
- `refactor: extract ecommerce <slice> runtime` if code changes.

### 3. Stage One Backfill M1: Connector Renderer Extraction Hardening (Completed In `5f5b76e0`, Follow-Up In `f06f1880`)

Goal: finish the already-started connector renderer extraction without re-creating the hook.

Scope:
- Audit `src/App.tsx` and `src/app/useConnectorRenderer.ts`.
- Confirm these methods live only inside the hook: `buildConnectorRenderSnapshot`, `commitConnectorRenderSnapshot`, `scheduleConnectorRenderSnapshot`, `resolveLivePromptPosition`, `resolveLiveImagePosition`, `resolveConnectorRenderPosition`.
- Tighten hook types with existing `CanvasPerformanceProfile` and `CanvasPoint` types.
- Add explicit `UseConnectorRendererResult`.
- Keep `App.tsx` as hook orchestration plus render usage only.

Acceptance:
- No duplicate connector snapshot logic remains in `App.tsx`.
- Connector rendering lists and position resolvers are returned from `useConnectorRenderer`.
- Connector throttling and live scene contract tests pass.
- `src/App.tsx` line count is recorded after the milestone.

Validation:
- `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/canvas-connector-throttling-contract.test.ts tests/unit/canvas-local-performance-trace-contract.test.ts tests/unit/canvas-live-scene-contract.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run check:encoding`

Commit:
- `refactor: harden connector renderer boundary`

### 4. Stage One Backfill M2: Prompt Group Layout Runtime (Completed In Prompt-Group Commit)

Goal: harden the already extracted prompt group layout, bounds, overlap, regroup, and live scene derivation runtime in `src/app/usePromptGroupLayout.ts`.

Scope:
- Export `PromptGroupBounds`, `UsePromptGroupLayoutDeps`, `UsePromptGroupLayoutResult`, `UsePromptGroupStackingDeps`, and `UsePromptGroupStackingResult`.
- Confirm prompt group bounds, visible group views, regroup presentation state coordination, and live scene derivation remain in the hook.
- Keep drag handler hooks and rendering code compatible through explicit returned methods and state.

Acceptance:
- `App.tsx` does not reintroduce prompt group layout blocks after extraction.
- Existing prompt-group regroup and live-scene tests pass.
- Drag, focus, auto-repair, regroup settle, and connector rendering behavior stay contract-compatible.

Validation:
- Prompt group and live scene targeted tests.
- `npm.cmd run typecheck`
- `npm.cmd run test:unit`
- `npm.cmd run build`
- `npm.cmd run check:encoding`

Commit:
- `refactor: harden prompt group layout boundary`

### 5. Stage One Backfill M3: Generation Runtime Quality Check (Completed In `ab719c4a`, Follow-Up In `083db7f8`)

Goal: verify the already extracted generation execution runtime remains clean and does not need immediate follow-up before Stage Two.

Scope:
- Confirm generation start, billing attempt coordination, cancellation, retry, failure state, result node persistence, and preview state wiring remain in `src/app/useGenerationRuntime.ts`.
- Semantically typecheck the public generation runtime boundary through `tests/unit/generation-runtime-contract.test.ts`.
- Semantically typecheck generation billing boundary coverage through `tests/unit/generation-billing-runtime-contract.test.ts`.
- Remove stale App-side generation billing imports/destructures after ownership has moved into the runtime hook.
- Preserve current billing, API, storage, and generation service contracts.

Acceptance:
- Generation lifecycle behavior remains unchanged.
- Cancellation, retry, balance consume/refund, and result placement tests stay green.
- No API or billing protocol changes are introduced.
- `UseGenerationRuntimeDeps`, `UseGenerationRuntimeResult`, and retry/submission public boundary types are imported by a semantic test included in `tsconfig.tests.json`.

Commit:
- `refactor: harden generation runtime` if code changes.
- `docs: record generation runtime backfill` if scan-only.

### 6. Stage One Backfill M5: PPT Runtime Quality Check (Completed In `569383aa`)

Status: completed in `569383aa`. The first extraction pass landed in `4c448660`; this follow-up stayed separate from Clay UI files and hardened the semantic public boundary through contract tests.

Goal: verify the already extracted PPT editing, preview, export, and deck child image management boundaries remain clean and do not need immediate follow-up before Stage Two.

Scope:
- Keep `src/app/usePptRuntime.ts` as owner of PPT editable page building, slide synchronization, PPTX export, PPT preview, and deck child filtering orchestration.
- Keep `src/app/pptRuntimeHelpers.ts` as owner of PPT image ordering, stale child fallback, parent prompt rejection, deck child detection, and nullish image array guards.
- Semantically typecheck the public PPT runtime boundary through `tests/unit/ppt-runtime-contract.test.ts`.
- Add all three PPT contract tests to `tsconfig.tests.json`: `tests/unit/ppt-runtime-contract.test.ts`, `tests/unit/ppt-runtime-helper-contract.test.ts`, and `tests/unit/ppt-deck-single-container-contract.test.ts`.
- Preserve existing helper modules such as PPTX skeleton and slide document builders.

Acceptance:
- PPT preview and editable export behavior remains unchanged.
- Deck child image filtering remains compatible with canvas rendering.
- `UsePptRuntimeDeps`, `UsePptRuntimeResult`, PPT bundle/editor/preview public boundary types, and `PptRuntimeCanvasSnapshot` are imported by a semantic test included in `tsconfig.tests.json`.
- PPT-related targeted tests, typecheck, unit suite, build, agent-doc governance, encoding check, and path-limited `diff --check` pass.

Commit:
- `refactor: harden ppt runtime` if code changes.
- `docs: record ppt runtime backfill` if scan-only.

### 7. Stage One M6: Ecommerce Runtime

Goal: extract ecommerce framework/runtime logic last because it has the highest cross-reference count.

Scope:
- Build an ecommerce reference map before editing.
- Add source contract tests for framework cards, import/review flows, scheduler state, and product image result binding.
- Create `src/app/useEcommerceRuntime.ts`.
- Completed slice: extract ecommerce sheet defaults, A+ sizing policy resolution, node generation setting resolution, and sheet-setting update propagation into `src/app/useEcommerceSheetSettingsRuntime.ts`.
- Completed slice: extract initial ecommerce task-state building and task edit synchronization into `src/app/useEcommerceTaskStateRuntime.ts`.
- Completed slice: extract requirement-file pick/clear/reset and requirement analysis execution into `src/app/useEcommerceRequirementAnalysisRuntime.ts`.
- Completed slice in `d0a95f79`: extract ecommerce confirmation, framework/group/task node building, initial group slot creation, and framework runtime bootstrapping into `src/app/useEcommerceBuildRuntime.ts`.
- Completed slice in `5acf9c27`: extract active task prompt/display synchronization and post-confirm built-card upload/reference rehydration into `src/app/useEcommercePostBuildSyncRuntime.ts`.
- Completed slice in `6dc8e391`: extract ecommerce node generation execution, desktop confirmation, and mobile retry callbacks into `src/app/useEcommerceNodeGenerationRuntime.ts`.
- Completed slice in `782d30d3`: extract mobile ecommerce continuation lookup/edit/toggle/confirm/mobile-generate handlers into `src/app/useEcommerceMobileContinuationRuntime.ts`.
- Completed slice in `184b158c`: extract source-key ecommerce task activation fallback and prompt-node activation into `src/app/useEcommerceTaskActivationRuntime.ts`.
- Completed slice: extract the ecommerce submit branch in `handleGenerate` into `src/app/useEcommerceSubmitRuntime.ts`.
- Completed slice in `cc24e19d`: extract the ecommerce mode guard/reset and prompt activation branches into `src/app/useEcommerceModeRuntime.ts` and `src/app/useEcommercePromptActivationRuntime.ts`.
- Completed slice in `ccf965c3`: extract the image-source ecommerce reset branch in `handleImageClick` into `src/app/useEcommerceSourceSelectionRuntime.ts`.
- Completed slice in `d12731ce`: extract the ecommerce partial-redraw inheritance and result-finalization branch in `handlePartialRedrawRequest` into `src/app/useEcommercePartialRedrawRuntime.ts`.
- Closeout scan: completed. No remaining ecommerce-owned business branch blocks M6 completion; remaining App references are hook orchestration, state adapter wiring, UI prop forwarding, and duplicated render predicates to handle later.

Acceptance:
- Ecommerce references are routed through an explicit hook interface.
- Existing ecommerce contract tests do not regress.
- No unrelated generation or PPT behavior changes.
- Sheet settings runtime exposes explicit deps/result interfaces and App no longer owns inline sheet settings helpers.
- Task state runtime exposes explicit deps/result interfaces; App no longer owns inline task-state sizing/edit callbacks.
- Requirement analysis runtime exposes explicit deps/result interfaces; App no longer owns inline requirement reset/analyze callbacks.
- Build runtime exposes explicit deps/result interfaces; App no longer owns inline ecommerce framework/group/task builders or confirmation flow.
- Post-build sync runtime exposes explicit deps/result interfaces; App no longer owns active ecommerce task prompt/display synchronization or built-card upload/reference rehydration effects.
- Node generation runtime exposes explicit deps/result interfaces; App no longer owns ecommerce node state patching, prompt optimization execution, single-card generation, desktop confirmation, or mobile retry callbacks.
- Mobile continuation runtime exposes explicit deps/result interfaces; App no longer owns mobile ecommerce prompt-node resolution, task editing activation, selection toggles, desktop confirmation forwarding, or mobile generation queue fallback handlers.
- Task activation runtime exposes explicit deps/result interfaces; App no longer owns source-key ecommerce task activation lookup or fallback active-task/group-sheet restoration.
- Ecommerce submit runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce-specific submit guard branch inside `handleGenerate`.
- Ecommerce mode runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce mode guard/reset effect.
- Ecommerce prompt activation runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce prompt activation state block or prompt-node framework status callback.
- Ecommerce source selection runtime exposes explicit deps/result interfaces; App no longer owns the image-source ecommerce reset block inside `handleImageClick`.
- Ecommerce partial redraw runtime exposes explicit deps/result interfaces; App no longer owns the ecommerce inherited redraw context resolution or ecommerce redraw result finalization branch inside `handlePartialRedrawRequest`.

Commit:
- `refactor: extract ecommerce partial redraw runtime` completed in `d12731ce`.
- M6 is complete after the closeout ledger update.

### 8. Stage Two: Secondary Giant File Split

Goal: split the next largest files while preserving public behavior.

Scope:
- Completed M1 slice in `92a9dc41`: extracted `CanvasState`, `CanvasContextType`, `CanvasContext`, layout mode types, `MAX_CANVASES`, default canvas/state construction, id generation, and workflow creation into `src/context/canvasContextState.ts`; canvas compatibility syncing lives in `src/context/canvasCompatibility.ts`.
- Completed M2 slice in `e0f1b583`: extracted the Canvas selection reducer from `src/context/CanvasContext.tsx` into a pure focused helper, preserving current selection ordering and duplicate semantics.
- Completed M3 slice in `83cc8d7f`: extracted `resolvePromptChildImageIds` from `src/context/CanvasContext.tsx` into a pure focused helper, preserving strong ownership, listed-order, duplicate filtering, source-image exclusion, and legacy fallback semantics.
- Completed M4 slice in `9ec4dbb1`: extracted `getWorkflowSourceNodeIds` from `src/context/CanvasContext.tsx` into a pure focused helper, preserving utility-only gating, first-seen string ID order, blank/non-string filtering, and non-trimming return semantics.
- Completed M5 slice in `002ee6fe`: extracted `hydrateRecoveredMediaCacheEntry` and `resolveOriginalPersistSourceForDisk` from `src/context/CanvasContext.tsx` into `src/context/canvasMediaRecovery.ts`, preserving protected original-slot behavior, video fallback behavior, and blob-source rejection.
- Completed M6 slice in `53f80d80`: extracted startup prompt recovery normalization from `src/context/CanvasContext.tsx` into `src/context/canvasPromptRecovery.ts`, preserving completed-prompt cleanup, interrupted synchronous-generation marking, and before-unload risk detection.
- Completed M7 slice in `0a5c2339`: extracted persisted image recovery helpers from `src/context/CanvasContext.tsx` into `src/context/canvasPersistedImageRecovery.ts`, preserving completed/persisted task entry merge, storage/original URL resolution order, recovery signature gating, and the existing React hydration effect.
- Completed M8 slice in `b68867dd`: extracted canvas merge helpers from `src/context/CanvasContext.tsx` into `src/context/canvasMerge.ts`, preserving non-empty snapshot preference, local item override during ID merge, max `lastModified`, and preferred active-canvas fallback ordering.
- Completed M9 slice in `7d8a4331`: extracted invalid-card cleanup helpers from `src/context/CanvasContext.tsx` into `src/context/canvasCleanup.ts`, preserving invalid prompt/image removal, utility workflow source/output pruning, workflow edge pruning, group pruning, selection filtering, and summary reporting.
- Completed M10 slice in `3abdd250`: extracted placement helpers from `src/context/CanvasContext.tsx` into `src/context/canvasPlacement.ts`, preserving fixed card-grid slots, smart collision shifts, utility workflow collision checks, and dynamic child-card group width accumulation.
- Completed M11 slice in `c171de38`: extracted layering helpers from `src/context/CanvasContext.tsx` into `src/context/canvasLayering.ts`, preserving prompt-group expansion, linked canvas group expansion, workflow node z-index promotion, and group z-index ordering.
- Completed security slice in `0603547a`: removed legacy Netlify raw-key BYOK endpoints `netlify/functions/keys.ts` and `netlify/functions/generate.ts`, kept `netlify/functions/pricing-proxy.ts`, and extended security governance to scan `netlify/`.
- Completed M12 slice in `5994c34b`: extracted Canvas group management helpers into `src/context/canvasGroups.ts`, preserving explicit z-index behavior, next z-index computation over prompt/image/group nodes only, remove-all matching group IDs, and replace-only update semantics.
- Completed M13 slice in `4722acbe`: extracted selected-node movement helpers into `src/context/canvasMovement.ts`, preserving source override semantics, prompt-child image movement, direct image `userMoved` marking, workflow utility-only movement, no-op behavior for empty effective selection, and no `lastModified` mutation.
- Completed M14 slice in `d7a9d0a7`: extracted node tag update helpers into `src/context/canvasTags.ts`, preserving prompt/image-only tag replacement, clear-tags behavior, untouched groups/drawings, and `updateCanvas` `lastModified` ownership.
- Completed M15 slice in `c9d39bb2`: extracted node update helpers into `src/context/canvasNodeUpdates.ts`, preserving image dimension updates, image shallow-merge updates, batch prompt/image updates, duplicate-ID last-write-wins semantics, empty/no-match batch no-ops, and `updateCanvas` `lastModified` ownership.
- Completed M16 slice in `c80ffa70`: extracted prompt/image position update helpers into `src/context/canvasPositionUpdates.ts`, preserving selected-group movement, prompt child-image movement, `moveChildren`, `ignoreSelection`, missing-target no-ops, and `updateCanvas` `lastModified` ownership.
- Completed M17 slice in `c46a4c49`: extracted prompt/image relationship helpers into `src/context/canvasPromptImageLinks.ts`, preserving deleted-prompt child orphaning, duplicate link no-ops, missing prompt link no-ops, missing image link behavior, unlink orphaning, and `updateCanvas` `lastModified` ownership.
- Completed M18 slice in `fbe26764`: extracted workflow utility node update helpers into `src/context/canvasWorkflowUpdates.ts`, preserving utility add duplicate checks, source-control edge creation, update ID/kind preservation, source-edge rebuilding, position updates, delete edge pruning, and `updateCanvas` `lastModified` ownership.
- Completed M19 slice in `16d805cb`: extracted the image-node deletion transform into `src/context/canvasPromptImageLinks.ts`, preserving image removal, parent `childImageIds` pruning, `sourceImageId` clearing, and Context-owned storage deletion / Blob revoke side effects.
- Completed M20 slice in `943af671`: extracted `mergeCanvasInto` pure state merging into `src/context/canvasMergeInto.ts`, preserving target duplicate filtering, card offset behavior, group filtering, optional source emptying, active canvas reassignment, selection clearing, and summary counts.
- Completed M21 slice in `c0c37736`: removed source-proven unused `CanvasContext.tsx` imports, unused initial auto-arrange constants, and write-only layout variables.
- Completed M22 slice in `bfc6fb8a`: extracted the single selected prompt child-card arrangement branch into `src/context/canvasArrangeSelection.ts`, preserving row/grid/column positions and PPT column behavior.
- Completed M23 slice in `9769ea7f`: removed the unreachable duplicate selected-arrange fallback from `CanvasContext.tsx` and extended the cleanup contract to keep it from returning.
- Completed M24 slice in `c1a76a43`: extracted the multi-root selected arrange branch into `src/context/canvasArrangeSelection.ts`, preserving selected image-only row layout, prompt-root child syncing, and null behavior when selection collapses to one root.
- Completed M25 slice in `1318d84d`: extracted the remaining selected grouped arrange fallback into `src/context/canvasArrangeSelection.ts`, preserving prompt+child grouped layout, selected-count fallthrough, PPT child column override, deterministic `lastModified`, and requested `subCardLayoutMode` behavior.
- Completed M26 slice in `7cbd7346`: extracted full-canvas auto-arrange position calculation into `src/context/canvasAutoArrange.ts`, preserving normal prompt groups, follow-up source prompt placement, orphan prompt/image placement, error prompt rows, and Context-owned state/persistence side effects.
- Completed M27 slice in `b16843ee`: extracted prompt add/update canvas reducers into `src/context/canvasNodeUpdates.ts`, preserving prompt z-index promotion, duplicate skip behavior, defensive prompt/reference merges, stale generating guards, and Context-owned reference-image persistence side effects.
- Completed M28 slice in `a174b557`: extracted `keyManager` model parsing/normalization helpers into `src/services/auth/keyManagerModelHelpers.ts`, preserved compatibility exports from `keyManager.ts`, and made `keyManagerEffectiveSlot.ts` import `parseModelString` directly from the helper.
- Completed M29 slice in `3ce7ae59`: extracted `determineKeyType` into `src/services/auth/keyManagerKeyType.ts`, preserved `keyManager.ts` compatibility re-export, and made `keyManagerEffectiveSlot.ts` free of direct `keyManager.ts` imports.
- Completed M30 slice in `08eb89d8`: parity-guarded and consolidated duplicated `src/utils/modelIdNormalization.ts` behavior against `src/services/auth/keyManagerModelHelpers.ts`.
- Completed M31 slice in `56debf21`: extracted only `mergeCloudProvidersWithLocalRuntimeState` from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerProviders.ts`, preserving cloud-provider precedence and local runtime fallback for omitted pricing/activity fields.
- Completed M32 slice in `615b7969`: extracted only provider linked-slot matching from `src/services/auth/keyManager.ts` into `src/services/auth/keyManagerProviderLinks.ts`, preserving exact apiKey/name matching and the sync-only single-baseUrl fallback.
- Completed M33 slice in `dd3ad358`: extracted provider usage limit checks and usage delta math into `src/services/auth/keyManagerProviderUsage.ts`.
- Completed M34 slice in `a598312d`: extracted route suffix decoding, slot/provider suffix matching, and stable route ID builders into `src/services/auth/keyManagerRouteIds.ts`.
- Completed M35 slice in `531eae6b`: extracted duplicated ASCII credential sanitization into `src/services/auth/keyManagerCredentialSanitizer.ts`.
- Completed M36 slice in `7b54fd1a`: extracted channel config API-key redaction into `src/services/auth/keyManagerChannelConfigSecrets.ts`.
- Completed M37 slice in `4658d947`: pruned only source-proven unused local helper definitions from `src/services/auth/keyManager.ts`, preserving exported APIs and all credential/provider/runtime behavior.
- Completed M38 slice in `afe89b71`: pruned only the browser-direct diagnostics message wrapper from `src/services/auth/keyManager.ts`, preserving the storage-owned disabled message and all browser fail-closed behavior.
- Completed M39 slice in `1214ab98`: pruned only the source-proven unused `LEGACY_GOOGLE_MODELS` constant from `src/services/auth/keyManager.ts`, preserving exported APIs and model fallback behavior.
- Completed M40 slice in `031f3ec7`: extracted only the pure pricing catalog model ID parser into `src/services/auth/keyManagerModelHelpers.ts`, preserving candidate priority, `models/` prefix stripping order, empty filtering, first-seen dedupe, and model discovery fallback behavior.
- Completed M41 slice in `46045a80`: extracted only the pure public model categorization helper into `src/services/auth/keyManagerModelHelpers.ts`, preserving video-first category priority, image/chat/other heuristics, and `keyManager.ts` compatibility re-export.
- Completed M42 slice in `ea2ad869`: extracted only the pure global model type inference classifier into `src/services/auth/keyManagerModelHelpers.ts`, preserving video-before-image/audio/chat/OpenRouter fallback behavior and `keyManager.ts` type compatibility export.
- Completed M43 slice in `54cd8312`: extracted only the pure silent provider pricing URL builder into `src/services/auth/keyManagerPricingUrl.ts`, preserving marketing-suffix stripping, trailing-slash trimming, `/v1` removal, and final `/pricing` endpoint behavior while leaving the fetch, headers, pricing cache, and provider persistence untouched.
- Completed M44 slice in `c435de27`: extracted only the pure deprecated-model membership helper into `src/services/auth/keyManagerModelHelpers.ts`, preserving exact `DEPRECATED_MODELS.includes(modelId)` behavior and `keyManager.ts` compatibility re-export.
- Completed M45 slice in `6cada9ad`: pruned only the source-proven unused local `get12AIBaseUrl` wrapper and unused `RegionService` import from `src/services/auth/keyManager.ts`, preserving the actual 12AI base URL source of truth in `src/services/system/RegionService.ts` and the live direct callers outside `keyManager.ts`.
- Completed M46 slice in `eb3ac527`: extracted only the pure `isGoogleOfficialModelId` predicate into `src/services/auth/keyManagerModelHelpers.ts`, preserving case-sensitive `models/` prefix stripping, lowercase prefix matching, no trimming, the three existing `keyManager.ts` call sites, and the compatibility facade re-export.
- Completed M47 slice in `8b40e892`: extracted only the pure `buildChannelCapabilities` helper into `src/services/auth/keyManagerChannelCapabilities.ts`, preserving exact wildcard handling, parsed model category behavior, empty-list chat default, support-flag mapping, and the historical audio regex.
- Completed M48 slice in `f812b66c`: extracted only the pure `detectApiType` helper into `src/services/auth/keyManagerApiType.ts`, preserving historical case-sensitive substring matching and `keyManager.ts` compatibility re-export.
- Completed M49 slice in `7005bd50`: extracted only default/whitelist model constants into `src/services/auth/keyManagerDefaultModels.ts`, preserving exact array ordering, `DEFAULT_GOOGLE_MODELS` spreading `GOOGLE_IMAGE_WHITELIST`, and `keyManager.ts` compatibility re-exports.
- Completed M50 slice in `549a2422`: extracted only preset provider data into `src/services/auth/keyManagerProviderPresets.ts`, preserving documented built-in route order, special default keys, and `keyManager.ts` compatibility re-exports.
- Completed M51 slice in `81ba2a24`: extracted only `getDocumentedStaticModelsForProvider` into `src/services/auth/keyManagerProviderPresets.ts`, preserving 12AI documented model fallback behavior and `keyManager.ts` compatibility re-export.
- Completed M52 slice in `f5153811`: extracted only `BLACKLIST_MODELS`, the private model-filter predicate, and `normalizeModelList` into `src/services/auth/keyManagerModelList.ts`, preserving Google migration/filtering, 12AI compatibility filtering, and `keyManager.ts` compatibility re-export.
- Completed M53 slice in `74d6345a`: pruned only the duplicate `getGlobalModelList` JSDoc block and the unused local `chatModelIds` allocation from `src/services/auth/keyManager.ts`, with the dead-code contract preventing reintroduction.
- Completed M54 slice in `dd2295d3`: extracted only `resolveEffectiveProviderModels` and its official-default fallback selector into `src/services/auth/keyManagerEffectiveProviderModels.ts`, preserving `keyManager.ts` compatibility re-export and all existing call sites.
- Completed M55 slice in `6902b79b`: pruned only private `resolveProviderBudgetLimit` / `resolveProviderTokenLimit` delegator methods from `src/services/auth/keyManager.ts`, leaving the existing helpers in `src/services/auth/keyManagerEffectiveSlot.ts` as the single source of truth.
- Completed security slice in `58be183d`: patched the `payment-server` transitive Hono audit gap by overriding `@hono/node-server` and `hono` to non-vulnerable versions, then made root verification run dependency audit for both the root package and the payment sidecar.
- Completed M56 slice in `0edb13f5`: extracted OpenAI-compatible request diagnostics preview redaction into `src/services/llm/openAICompatibleDiagnostics.ts`, preserving all provider image routing and request execution behavior while adding direct coverage for JSON and multipart redaction.
- Completed M57 slice in `8f878b3a`: extracted OpenAI-compatible image-routing error classifiers into `src/services/llm/openAICompatibleImageRoutingErrors.ts`, preserving quota fail-closed behavior, chat/image compatibility signals, provider routing, request execution, auth, UI, and release metadata while adding direct coverage for extracted substring parity and historical message-only inputs.
- Completed M58 slice in `96b94e5e`: removed source-proven unreachable image fallback code after `buildImageCompatibilityModeError` throws in `OpenAICompatibleAdapter.ts`, preserving the billing-safe fail-closed policy and adding source-contract coverage to prevent the old automatic fallback snippets from returning.
- Completed M59 working-tree slice: removed compiler/source-proven unused imports, dead local helpers, unreachable JSX/state islands, stale lightbox remnants, and unused destructured parameters from `src/components/layout/PromptBar.tsx` and `src/components/image/ImageCard2.tsx`; added `tests/unit/ui-unused-cleanup-contract.test.ts` so the removed stale UI code does not return; kept `src/App.tsx` out of this slice despite fresh App TS6133 diagnostics.
- Completed M60 slice in `b6767e85`: removed compiler-proven unused `src/App.tsx` imports, hook/context destructures, the stale pending prompt state tuple, unused connector/workflow/prompt-group resolver outputs, dormant cut-connection/image-pin callbacks, and unused callback parameters; added `tests/unit/app-unused-cleanup-contract.test.ts` so the App stale symbols do not return.
- Completed M61 slice in `fafecef9`: removed compiler/source-proven unused `OpenAICompatibleAdapter.ts` imports, an unused private 12AI gateway helper, an unused static URL normalizer, and unread chat-image locals; added `tests/unit/openai-compatible-unused-cleanup-contract.test.ts` so those stale symbols do not return.
- Completed M62 slice in `783fddeb`: removed compiler/source-proven unused `LLMService.ts` imports, stale direct browser-call helper paths, unused adapter fields, and unread public parameters while preserving local user-route proxy first, secure proxy fallback, billing metadata, task-status routing, and browser-direct blocking contracts.
- Completed M63 slice in `92ee7a4f`: removed source-proven unused locals from `src/app/promptGroupRenderLayout.ts` and unused private helpers/constants from `src/utils/modelSorting.ts`, with a small App call-site cleanup for the removed layout argument. The full noUnused probe had zero `promptGroupRenderLayout.ts`, `modelSorting.ts`, and `App.tsx` matches and 135 remaining diagnostics overall.
- Completed M64 slice in `3108a29f`: removed compiler/source-proven unused imports, unused viewport state, stale derived session lists, and unused callbacks from `src/components/layout/ChatSidebar.tsx`; added `tests/unit/chat-sidebar-unused-cleanup-contract.test.ts`. The full noUnused probe had zero `ChatSidebar.tsx` matches and 123 remaining diagnostics overall.
- Completed M65 slice in `0efba271`: removed compiler/source-proven unused imports, destructured props, and write-only state from `src/components/canvas/PromptNodeComponent.tsx`; added `tests/unit/prompt-node-unused-cleanup-contract.test.ts`. The full noUnused probe had zero `PromptNodeComponent.tsx` matches and 112 remaining diagnostics overall.
- Completed M66 slice in `0797bf95`: removed compiler/source-proven unused `Activity` import and unused `importantLogs` derived values from `src/components/settings/views/SystemLogsView.tsx` and `src/components/settings/views/SystemLogsView.localized.tsx`; added `tests/unit/system-logs-unused-cleanup-contract.test.ts`. The full noUnused probe had zero `SystemLogsView` matches and 109 remaining diagnostics overall.
- Completed M67 slice in `f453cd9a`: removed the compiler-proven unused `Star` import from `src/components/Onboarding/AchievementToast.tsx`; added `tests/unit/onboarding-unused-cleanup-contract.test.ts`. The filtered noUnused probe had zero `AchievementToast.tsx` matches and 108 remaining diagnostics overall.
- Completed M68 slice in `e661630e`: removed compiler-proven unused `OnboardingProgress`, `updateProgress`, no-op task parameter, `ChevronLeft`, `Keyboard`, and the unread `getTasksByPhase` parameter from Onboarding residual files. The filtered noUnused probe had zero `src/components/Onboarding` matches and 102 remaining diagnostics overall.
- Completed M69 slice in `05394f83`: deleted the orphaned `src/services/image/imageCompression.ts` module after source/import proof that no production code imports it; extended `tests/unit/pure-utility-unused-cleanup-contract.test.ts` so the module and imports do not return. The full noUnused probe had 101 remaining diagnostics overall.
- Completed M70 slice in `eeb377d5`: deleted the orphaned `src/components/canvas/PixiCanvas.tsx` dormant renderer after source/import proof that no production code imports it; added `tests/unit/canvas-dormant-unused-cleanup-contract.test.ts` so Pixi canvas entrypoints do not return. The full noUnused probe had 95 remaining diagnostics overall.
- Completed M71 slice in `9ce70e96`: kept `Canvas.tsx` and `PendingNode.tsx` props interfaces stable while removing only compiler-proven unused destructured values and unread state values. The full noUnused probe had 91 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M72 slice in `58161f20`: removed compiler-proven unused `AlertTriangle`, `ShieldCheck`, and `Wallet` icon imports from the legacy plain `DashboardView.tsx`, while preserving the live localized dashboard route and billing remaining-balance source contract. The full noUnused probe had 88 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M73 slice in `7d2c2584`: renamed unused compatibility stub parameters in `src/services/storage/fileSystemService.ts` to `_handle` and `_isVideo`, preserving every public method, call signature order, no-op tag/settings behavior, and App call sites. The full noUnused probe had 78 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M74 slice in `5dac56e8`: removed import-only unused types/imports from `src/components/image/GlobalLightbox.tsx`, `src/hooks/useImageQuality.ts`, and `src/services/model/modelRegistry.ts`, while preserving lightbox partial-redraw, image-quality hook behavior, and model registry exports. The full noUnused probe had 74 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M75 slice in `bdb082d7`: removed unused `onAutoArrange` and `id` destructured values from live `src/components/canvas/InfiniteCanvas.tsx`, while preserving `InfiniteCanvasProps`, canvas behavior, and live canvas visual contracts. The full noUnused probe had 72 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M76 slice in `e714380b`: removed the unused `WORKFLOW_TEMPLATES` import from `src/app/useWorkflowActions.ts`, while preserving `WorkflowTemplateId`, workflow node factory imports, and `App.tsx` ownership of the template list passed to UI. The full noUnused probe had 71 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M77 slice in `57e8c05b`: renamed the unused `localizeBoundaryErrorText` language parameter in `src/components/common/ErrorBoundary.tsx` to `_language`, while preserving the call shape, captured-error localization, frosted error surface, and reload behavior. The full noUnused probe had 70 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M78 slice in `d4291729`: removed the compiler-proven unused `resolveModelDisplayName` import from `src/app/useGenerationRuntime.ts`, while preserving the deps boundary and every runtime call through the injected dependency. The full noUnused probe had 69 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M79 slice in `c29effe5`: removed the compiler-proven unused `CanvasContextType` and `SubCardLayout` type imports from `src/context/CanvasContext.tsx`, while preserving the existing type re-export compatibility boundary. The full noUnused probe had 67 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M80 slice in `c4526e6b`: removed compiler-proven unused mobile prompt optimization props from the `ProjectManager.tsx` destructuring list, while preserving the public `ProjectManagerProps` declarations and JSX/control behavior. The full noUnused probe had 63 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M81 slice in `d8845775`: renamed the compiler-proven unused private `buildTemplateCopySeed` template parameter to `_seriesTemplate`, while preserving call arity and ecommerce copy/style/layout/inherit merge behavior. The full noUnused probe had 62 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M82 slice in `37540efc`: renamed the compiler-proven unused public-compatible `getModelDisplayName` provider parameter to `_provider`, while preserving the third-argument call shape and custom-label/model-name behavior. The full noUnused probe had 61 TS6133 diagnostics plus 4 TS619x diagnostics.
- Completed M83 slice in `324b42a6`: removed or marked compiler-proven unused video-service locals across `OpenAIVideoService.ts`, `VeoVideoService.ts`, and `videoService.ts`, while preserving browser fail-closed behavior, Veo request/URL construction, progress labels, polling, downloading, and returned mode.
- Completed M84 slice in `b31edef5`: removed compiler-proven unused image priority/LOD locals across `imagePriorityLoader.ts` and `lodService.ts`, while preserving priority sorting, queue execution, LOD thresholds, storage lookup, cache updates, and fallback URL behavior.
- Completed M85 slice in `56ffe696`: removed or marked compiler-proven unused locals in `AudioCompatibleAdapter.ts` and `VolcengineAdapter.ts`, while preserving audio request body/duration/lyrics/continuation behavior and Volcengine chat/image request behavior.
- Completed M86 slice in `8dfa152a`: removed compiler-proven unused imports/locals from `src/services/chat/chatService.ts`, while preserving chat request URL/header construction, keyManager success/failure reporting, saved-message/session behavior, body-read error-path behavior, and thrown API error semantics.
- Completed M87 slice in `a4032085`: removed compiler-proven unused local source slices from `tests/unit/generation-runtime-contract.test.ts`, while preserving the generation runtime boundary assertions and avoiding production-code changes.
- Completed M88 slice in `d075e6fd`: removed the duplicate unused `DEFAULT_TABS` constant from `src/services/llm/promptOptimizerService.ts`, while preserving the `HUMAN_DEFAULT_TABS` UI payload wiring and prompt optimizer route behavior.
- Completed M89 slice in `0cc6c77c`: removed the unused `AdminRechargeSubmissionDto` direct import from `packages/contracts/src/client/kk-api-client.ts`, while preserving the public billing DTO export and the recharge-submission client response DTOs.
- Completed M90 slice in `63386046`: removed duplicate unused secret placeholder constants from `src/services/api/userApiPayload.ts`, while preserving the live placeholder/redaction policy in `src/services/api/userApiCloudRecordStorage.ts`.
- Completed M91 slice in `651b54c5`: removed import-only unused `ModelType` and `getRefImageTokenEstimate` from `src/services/billing/costService.ts`, while preserving cost estimation behavior and the live `getModelPricing` / `getImageTokenEstimate` calculation path.
- Completed M92 slice in `318e6b1e`: removed the uncalled private `buildInvocationError` helper from `src/services/model/secureModelProxy.ts`, while preserving the two source-contracted local route gate helpers.
- Completed M93 slice in `27f03e62`: removed the unused `loadUserApisPayloadFromCloudRecord` named import from `src/services/api/userApiProfileStorage.ts`, while preserving metadata/merge imports and user API profile fallback behavior.
- Completed M94 slice in `6c624909`: removed the stale duplicate `billingFeatureEnabled` alias from `src/components/modals/UserProfileModal.tsx` and updated `tests/unit/local-runtime-consistency-contract.test.ts` to assert the live `billingUiEnabled` gate instead.
- Completed M95 slice in `95c5fc16`: removed the uncalled private `getErrorMessage` helper from `src/services/api/userApiCloudRecordStorage.ts`, while preserving typed auth payload loading, local API fallback, cache behavior, payload compaction, and secret redaction. The full noUnused probe had 43 remaining diagnostics overall.
- Completed M96 slice in `d5e6a809`: removed the compiler-proven unused `notify` import from `src/services/billing/newApiManagementService.ts` and kept the `getAllChannels()` preflight as an awaited side-effect call without the unread `channels` binding.
- Completed M97 slice in `c465146b`: removed the uncalled private `normalizeRechargePaymentChannelConfig` helper from `src/services/billing/rechargeSubmissionService.ts` while preserving the default payment-channel config builder, `qrDisplay` mapping, and recharge channel list fallback behavior.
- Completed M98 slice in `51f6ff18`: removed the unused OPFS `compressIfNeeded` import and unused Promise `reject` executor parameter from `src/services/storage/storageAdapter.ts`, preserving import/read/delete behavior and image dimension fallback semantics.
- Completed M99 slice in `d49398c9`: renamed the compiler-proven unused `prompt` parameter in `src/services/storage/storagePreference.ts` to `_prompt`, preserving the public `saveOriginalToLocalFolder` arity, local-folder write behavior, and merge timestamp call shape.
- Completed M100 slice in `efe1bdf9`: removed the compiler-proven unused `db` local from `src/services/storage/imageStorage.ts` `cleanupOriginals()`, preserving batch image pagination, compression, save, and error behavior.
- Completed M101 slice in `9db2fe41`: removed import-only compiler-proven unused symbols from `src/services/llm/GoogleAdapter.ts`, preserving Google/Gemini chat, image, audio, and video request behavior plus inline video generation type references.
- Completed M102 slice in `574b3f41`: removed compiler-proven unused imports/helpers from `src/services/llm/geminiService.ts`, preserving Gemini request behavior, error classification, secure-proxy error handling, `llmService.generateImage(llmOptions)`, `calculateCost(...)`, and the `_negativePrompt` call shape.
- Completed M103 slice in `cedb3718`: removed compiler-proven unused imports/destructures/locals from `src/hooks/useImageGeneration.ts`, preserving generation recovery, billing, storage persistence, sync bridge recovery, and pending-task state transitions.
- Completed M104 slice in `6028e59a`: removed compiler-proven unused imports/constants/helpers from `src/components/settings/ApiSettingsView.tsx`, preserving API settings route visibility, readonly snapshot behavior, BYOK persistence, source encoding guards, and settings workbench UI contracts.
- Completed M105 slice in `c85ab3f9`: removed compiler-proven unused bindings from `src/services/auth/keyManager.ts`, preserving compatibility re-exports, key storage, provider persistence, cloud payload shape, and route selection behavior.
- Completed M106 slice in `426a0a0c`: wired the `secureModelProxy.ts` route-gate helpers into the live local user-route and local system proxy entrypoints while preserving the current routing behavior and the no-browser-direct / no-stale-fallback contracts.
- Completed M107 in `9764ba70`: extracted the post-surface `OpenAICompatibleAdapter.ts` image dispatch plan into `src/services/llm/openAICompatibleImageDispatch.ts`, preserving Wuyin/AceData short-circuits, `resolveImageSurface` ownership, endpoint/auth/fetch behavior, provider-specific method calls, and billing-safe fallback throws.
- Completed M108 in `268ed882`: extracted OpenAI-compatible image payload URL/base64 parsing into `src/services/llm/openAICompatibleImagePayload.ts`, preserving endpoint selection, auth, fetch behavior, task polling, compatibility fallback ordering, and provider routing ownership.
- Completed M109 in `f2de4377`: extracted OpenAI-compatible image profile, count, and size helpers into `src/services/llm/openAICompatibleImageSizing.ts`, preserving endpoint selection, auth, fetch behavior, task polling, compatibility fallback ordering, edit endpoint routing, and provider routing ownership.
- Completed M110 in `d229c791`: extracted OpenAI-compatible generic task payload parsing into `src/services/llm/openAICompatibleTaskPayload.ts`, preserving endpoint selection, auth, fetch behavior, polling request URLs, backoff, provider branch selection, result metadata assembly, and fallback ordering.
- Completed M111 in `3dab3056`: extracted OpenAI-compatible provider message extraction and polled task result assembly into `src/services/llm/openAICompatibleTaskPayload.ts`, preserving endpoint selection, auth, fetch behavior, polling request URLs, backoff, provider branch selection, immediate result handling, and fallback ordering.
- Completed M112 in `296c1203`: extracted local user-route auth/header/query-key, route strategy, route format, and image-surface pure helpers into `apps/api/src/modules/model-proxy/application/local-user-route-auth.ts`, preserving endpoint selection, fetch execution, task operation routing, credential storage/retrieval, provider branch execution, fallback ordering, billing metadata, release metadata, and UI behavior.
- Completed M113 in `617491b3`: extracted local user-route direct endpoint URL normalization into `apps/api/src/modules/model-proxy/application/local-user-route-endpoints.ts`, preserving auth/header/query-key behavior, endpoint call sites, fetch execution, task operation routing, credential storage/retrieval, provider branch execution, fallback ordering, billing metadata, release metadata, and UI behavior.
- Completed M114 in `245bdd4b`: extracted keyManager shared pricing catalog normalization and pricing snapshot construction into `src/services/auth/keyManagerSharedPricing.ts`, preserving provider fetches, persistence, cloud sync, key storage, route selection, model resolution, and UI behavior.
- Completed M115 in `ed444606`: extracted pure remote model discovery response parsing and canonical dedupe into `src/services/auth/keyManagerRemoteModelDiscovery.ts`, preserving fetch execution, endpoint selection, auth/header behavior, provider persistence, cloud sync, key storage, route selection, model resolution, and UI behavior.
- Completed M116 in `52074495`: closed ecommerce visibility/localization UI debt by keeping generated ecommerce task cards visible on canvas, hiding only `a-plus-group` helper nodes, localizing ecommerce/mobile post-build controls, and keeping card insertion responsive while reference images persist in the background.
- Completed hotfix in `5aaccf50`: hardened ecommerce requirement analysis so static-preview `200 text/html` responses from `/api/ecommerce-analysis` fall back to local `.xlsx` parsing instead of surfacing a JSON parser error.
- Completed ledger sync in `689a2cc2`: synchronized the post-hotfix control plane.
- Completed M117 in `c0c96808`: moved pure Gemini image-size and requested aspect-ratio normalization into `src/services/llm/openAICompatibleImageSizing.ts`, preserving endpoint selection, auth, fetch behavior, provider routing, fallback ordering, billing, UI, and release metadata.
- Completed M118 in `2dbb402e`: hard-failed legacy WeChat Pay webhook handling when required WeChat Pay credentials are missing, removed placeholder cert/private-key fallbacks, and derived legacy return/notify defaults from the current request origin instead of production `kkai.plus` URLs.
- Completed M119 in `8545513b`: moved the OpenAI-compatible New API Google `extra_body` merge/build helpers into `src/services/llm/openAICompatibleGoogleExtraBody.ts`, preserving endpoint selection, auth, fetch behavior, provider routing, fallback ordering, billing, UI, and release metadata.
- Completed M120 in `cff75d23`: moved the OpenAI-compatible chat message/body helpers into `src/services/llm/openAICompatibleChatPayload.ts`, preserving endpoint selection, auth, fetch behavior, provider routing, fallback ordering, billing, UI, and release metadata.
- Completed the post-M120 UI closure line in `da4ffc79`, `485a6bef`, and `1ca080eb`: moved the ecommerce workbench onto the canvas, flattened the prompt bar mobile actions, and flattened the settings workbench chrome without reopening runtime/provider seams.
- Completed M121 in `74dbdbf1`: moved pure Wuyin route/base-url/reference-image/task-status helpers from `OpenAICompatibleAdapter.ts` into `src/services/llm/openAICompatibleWuyinRoute.ts`, preserving endpoint selection, auth, fetch behavior, provider routing, fallback ordering, billing, UI, and release metadata.
- Completed M122 in `dcf38e87`: hardened local user-route task signing so public default task-secret fallback is not used unless an explicit insecure local/test fallback flag is supplied.
- Completed M123 in `9e4b409e`: extracted local user-route task token signing/verification into `apps/api/src/modules/model-proxy/application/local-user-route-task-token.ts`, preserving provider endpoint selection, auth/header assembly, route config persistence, fetch response parsing, billing, UI, release metadata, and unrelated server runtime config behavior.
- Completed post-M123 settings UI closure in `5dda8972`: closed the unrelated settings UI WIP by flattening nested settings shell/card/search chrome, aligning the Clay frosted-surface contract with the new desktop/mobile shell ownership, and updating trace contracts to follow the M123 helper split.
- Completed M124 in `53338975`: moved only pure AceData route/reference/size helpers from `OpenAICompatibleAdapter.ts` into `src/services/llm/openAICompatibleAceDataRoute.ts`, preserving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata.
- Completed M125 in `42dcaa17`: moved pure 12AI async route helpers into `src/services/llm/openAICompatible12AIAsyncRoute.ts` and centralized OpenAI-compatible structured chat-image candidate extraction in `src/services/llm/openAICompatibleImagePayload.ts`, preserving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata.
- Completed M126 in `342ae802`: allowlisted OpenAI-compatible image payload URL schemes and raster MIME types inside `src/services/llm/openAICompatibleImagePayload.ts`, preserving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata.
- Completed M127 in the current image reference cleanup slice: extracted repeated OpenAI-compatible reference-image formatting into `src/services/llm/openAICompatibleImageReferences.ts` and removed unreachable commented legacy delegate bodies from `OpenAICompatibleAdapter.ts`, preserving endpoint selection, auth/header behavior, fetch execution, polling, billing, fallback ordering, UI, and release metadata.
- Next step after M127: choose one fresh Stage Two seam from the read-only candidates, with high-confidence options including OpenAI-compatible error helpers, keyManager raw `updateKey` log redaction, dead Gemini cache cleanup, or shared user-route auth inference. Do not mix auth/header behavior, endpoint call-site behavior, fetch behavior, fallback-order changes, keyManager secrets/cloud sync, provider routing, storage persistence, release metadata, unrelated runtime behavior, or broad debt cleanup.
- Continue `src/context/CanvasContext.tsx` only for another high-confidence narrow seam; defer `migrateNodes`, IndexedDB/local-folder movement, and persistence orchestration until they can be split safely.
- Continue `src/services/auth/keyManager.ts` only after a fresh seam map. Defer key storage, permission checks, encryption helpers, provider credential management, cloud sync, provider persistence, shared pricing cache construction, runtime routing, fetch/auth behavior, endpoint selection, and localStorage policy until smaller seams are mapped.
- Split `src/components/layout/PromptBar.tsx` by composer state, attachments, ecommerce controls, and mobile/desktop presentation.
- Split `src/services/llm/OpenAICompatibleAdapter.ts` by request building, response parsing, provider quirks, and image/video/audio compatibility.
- Keep compatibility exports for existing import paths.

Acceptance:
- Public context/service APIs remain compatible.
- `CanvasContext.tsx` continues re-exporting public context types for existing import paths.
- Typecheck and related unit tests pass after each sub-split.
- Commits are scoped per submodule, not one large batch.

### 9. Stage Three: Global Quality Governance

Goal: reduce type ambiguity and repeated logic after the main extractions create stable seams.

Scope:
- Remove or narrow `any` only where it is touched by the current refactor.
- Reduce `@ts-ignore` / `@ts-expect-error` and bare `console.log` only in touched files unless a dedicated cleanup milestone is created.
- Consolidate repeated domain types into existing type files or focused domain files.
- Remove dead code introduced by the refactor.
- Extract repeated UI fragments only when the duplication is local and obvious.

Acceptance:
- No new type errors.
- Core UI contract tests do not regress.
- The cleanup does not alter visual flow or product behavior.

### 10. Stage Four: apps/web Migration

Goal: migrate stabilized front-end modules into `apps/web/` after boundaries are proven in `src/`.

Scope:
- Move modules by business domain.
- Preserve compatibility exports or update all imports atomically.
- Keep `apps/api/` untouched except for compatibility verification.

Acceptance:
- No duplicate source of truth remains between `src/` and `apps/web/`.
- Front-end build, typecheck, unit tests, and critical smoke checks pass.

## Historical Recovery Context

The earlier recovery convergence plan and its eleven milestones are considered complete historical work. The current line no longer uses those recovery milestones as active tasks, but their safety rules remain useful: protect the dirty worktree, avoid secret leakage, validate before committing, and keep commits scoped.
