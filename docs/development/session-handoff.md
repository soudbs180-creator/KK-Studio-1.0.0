# KK Studio Project Handoff (v1.5.4)

Last updated: 2026-06-05

## 1. Project Overview

- Project name: `KK Studio`
- Stable version: `v1.5.4`
- Version authority: `config/release-manifest.json`
- Package projection: root `package.json` and workspace package manifests
- Primary rules: `AGENTS.md`
- Primary companion plan: `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`

## 2. Current Runtime Facts

- Primary Web runtime: `apps/web/` (Vite + React 19 + TypeScript + Tailwind + AntD / Lobe UI Bridge)
- Mobile workspace: `apps/mobile/` (Expo)
- Backend runtime: `server/` Express / VPS routes and related proxy behavior
- Shared logic: `packages/shared/`
- Unified API client: `packages/api-client/`
- UI adapter layer: `packages/ui/`
- Database schema changes: `migrations/` only
- AI assistant knowledge base: `docs/ai-assistant/`
- Version governance: `config/release-manifest.json` is the 主版本源.
- Version governance: `apps/web/src/config/appInfo.ts` is the 运行时只读导出.
- Version governance: `release/publish/stable/manifest.json` is the portable stable 发布清单.

Do not describe root `src/` as the current live frontend runtime. Do not describe `.agent` files as the current AI rule baseline. The current AI rule baseline is `AGENTS.md` plus `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md`.

## 3. Current AI Assistant Baseline

- Existing assistant entry: `apps/web/src/features/ai-takeover/`
- Existing pieces: `LocalAssistantBrain`, `LLMBrain`, `IntentGate`, `ActionExecutor`, `SafetyPolicy`, `ConfirmationPolicy`, `ProjectContextBuilder`, and a lightweight `toolRegistry.ts`
- Current partial work: `SanitizedProjectContext` already has `runtime?: CanvasRuntimeState`, and `docs/ai-assistant/` has an initial knowledge directory
- Current partial work: `toolRegistry.ts` now exposes legacy action tools plus initial namespaced aliases such as `canvas.getState`, `canvas.getSelectedNodes`, `assets.zipOriginals`, and `generation.createBatchJob`, and records脱敏 `AgentToolCallLog` entries. Alias registration is idempotent so real namespaced tools are not overwritten by legacy wrappers.
- Current partial work: `canvas.arrangeNodes` is registered and delegates to the existing `CanvasContext.arrangeAllNodes(mode)` path through `AITakeoverContext`, preserving selection-first arrange rules.
- Current partial work: `KnowledgeStore` now provides a redacted browser projection/cache for `knowledge.searchProject`, `knowledge.recordChange`, `ui.recordLayoutChange`, and `skills.upsertSkill`; it is not authoritative long-term storage.
- Current partial work: ToolRegistry execution logging now prints redacted `inputSummary` instead of raw tool input, so token-like strings and API-key-like values stay out of console logs.
- Current partial work: `assets.resolveOriginals` and `generation.getJobStatus` are registered as safe preflight/read tools.
- Current partial work: `AITakeoverContext` re-runs safety and confirmation policy on both local and cloud-generated plans before execution
- Important gap: the namespaced registry is still a compatibility layer, not the final `AgentRuntime + ToolRegistry + DurableQueue + KnowledgeSync` split
- Important gap: AI takeover generation queue is still not fully wired end-to-end. `DurableGenerationQueue` exists, is safe to import in non-browser tests, enforces `maxBatchSize=100`, derives stable idempotency keys, and clamps concurrency to `1..8`; executor registration, recovery UX, and layout tagging still need hardening.
- Current partial work: selected-card ZIP download now enforces selected scope, expands selected Prompt child images, de-dupes image nodes, and resolves originals in `originalUrl -> apiResultUrl -> url -> storageId -> localFile` order. ZIP archives always include `manifest.json`, including all-failed manifest-only archives.

## 4. Current Priority Order

1. Keep `AGENTS.md` and `AI_ASSISTANT_CAPABILITY_OPTIMIZATION.md` as mandatory dual-entry governance docs.
2. Keep `docs/ai-assistant/` updated whenever assistant, canvas, generation, download, or UI-map behavior changes.
3. Extend `CanvasRuntimeState` from a partial context into a tested runtime contract.
4. Upgrade `ActionExecutor` toward `ToolRegistry + Executor` while preserving legacy action compatibility.
5. Fix selected-card original image ZIP download.
6. Upgrade the AI takeover memory queue into a durable batch job queue.
7. Add knowledge index and skill consistency checks.
8. Add assistant-specific tests for tool registry, selected ZIP, queue, and knowledge sync.

## 5. Validation Guidance

Preferred full validation:

```bash
npm run verify:changes
```

Smaller relevant validation:

```bash
npm run governance:check
npm run typecheck
npm run test:unit
npm run build
npm run check:encoding
```

## 6. Latest Validation

- Passed: `npm run typecheck` (类型检查完全通过，确保无语法与类型断开)
- Passed: `npm run check:encoding` (文件编码及乱码防护验证通过，符合 UTF-8 without BOM 和 LF 要求)
- Passed: `npm run architecture:check` (架构与模块导入边界检查通过)
- Fixed: 解决了图片卡片在加载和切换质量时，由于浏览器原生重绘导致的破损图片图标闪烁视觉 Bug。
- Passed: 侧边和桌面工具栏折叠/展开测试以及所有的单元和集成测试。
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/openai-compatible-wuyin-route-contract.test.ts tests/unit/wuyin-refactor-extra.test.ts tests/unit/wuyin-user-route-image-mode-contract.test.ts tests/unit/wuyin-async-video-route-contract.test.ts tests/unit/wuyin-async-image-state-machine.test.ts` (32 个 Wuyin 路由、请求体、taskId、状态机单元测试通过)
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/wuyin-pricing-catalog-contract.test.ts tests/unit/key-manager-wuyin-route-regression.test.ts tests/unit/request-profile-registry.test.ts tests/unit/key-manager-shared-pricing-contract.test.ts tests/unit/key-manager-pricing-url-contract.test.ts tests/unit/model-pricing-credit-specs.test.ts tests/unit/pricingRules.test.ts` (28 个 Wuyin 目录、定价、Key Manager 回归测试通过)
- Passed: `npm run typecheck`, `npm run build` after fixing the lightbox closing behavior during active redraw sessions (preventing accidental lightbox dismissals on background clicks, Escape key, double clicks, and swipe gestures).
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/wuyin-user-route-image-mode-contract.test.ts tests/unit/wuyin-refactor-extra.test.ts tests/unit/openai-compatible-wuyin-route-contract.test.ts tests/unit/vercel-user-model-proxy.test.ts`, `npm run typecheck`, `npm run check:encoding`, and `npm run build` after removing Wuyin image model substitution and updating the proxy error copy.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/frontend-key-boundary-hardening.test.ts --test-name-pattern "ApiSettingsView"`, `npm run typecheck`, and `npm run check:encoding` after tightening API Key display/save boundaries.
- Noted: `npm run test:unit -- --test-name-pattern="ApiSettingsView|keyManager blocks"` was attempted but PowerShell treated `|` as a pipeline and ran the broader unit suite; it exposed an unrelated existing `clay-frosted-surface-contract.test.ts` failure in `UserProfileModal.tsx`.
- Passed: `node --import ./scripts/test/set-log-level.mjs --test --test-isolation=none tests/unit/key-manager-canonical-ids-contract.test.ts tests/unit/key-manager-provider-presets-contract.test.ts tests/unit/key-manager-route-ids-contract.test.ts tests/unit/user-api-cloud-storage.test.ts tests/unit/frontend-key-boundary-hardening.test.ts` after unifying user API record IDs and the Wuyin preset logo.
- Passed: `npm run typecheck -- --pretty false`, `npm run check:encoding`, and the `build` phase inside `npm run verify:changes`.
- Noted: `npm run verify:changes` still stops in the broader `test:unit` suite on the pre-existing `tests/unit/clay-frosted-surface-contract.test.ts` assertion against `apps/web/src/components/user/UserProfileModal.tsx` hardcoded dark/shadow tokens; this is outside the API ID / Wuyin logo change set.

## 7. Handoff Notes For Next Agent

- Always read `AGENTS.md`, `package.json`, and `config/release-manifest.json` before editing.
- Ensure that any new frontend components containing `<img>` or media elements handle the pending load state gracefully by managing their `opacity` via `isMediaLoaded` or a comparable local state, to avoid raw broken-image indicators displaying momentarily.
- Wuyin / 速创 model routing is now endpoint-aware across image, video, audio, chat, Sora2, and utility endpoints. The frontend serializes per-model request bodies with the documented `Content-Type`, browser-side Wuyin direct calls are disabled in favor of the user-route proxy, and `local_proxy` task IDs can include the Wuyin model ID so polling can pick special detail endpoints such as `/api/sora2/detail`.
- Wuyin image generation must submit the user-selected image model exactly; do not silently substitute another Wuyin image model. If production still shows the old NanoBanana2 502/404 copy, check `https://kkai.plus/app-version.json`; on 2026-06-05 production was still at commit `27f6931`, while the Wuyin branch fix was not deployed to production main yet.
- API Key settings behavior: `SettingInput` now reveals the real in-form secret when the eye is open, while server-returned read-only placeholders still show only `keyPreview`/masked text. `ApiSettingsView` must keep `sk-readonly-0000` and `__kk_redacted__:*` as cloud reuse placeholders only; local runtime updates must use the persisted real secret or require re-entry.
- User API ID behavior: `keyManagerCanonicalIds.ts` is now the single canonical helper for user API record IDs. New IDs use `channel-prefix-index` such as `wuyinkeji-google-omni-1015-1`; legacy IDs like `provider_wuyin`, `slot_wuyin`, `key_*`, and `provider_*` must be retained in `legacyIds` for route compatibility rather than displayed as the current ID.
- Wuyin / 速创 preset logo: use `WUYIN_PRESET_LOGO_URL` from `keyManagerProviderPresets.ts` (`https://api.wuyinkeji.com/assets/img/%E6%9C%AA%E5%91%BD%E5%90%8D-2.png`) instead of a text fallback icon.
- If user or another AI changes files in parallel, inspect `git status` and current diffs first; never revert unrelated work.
- For assistant work, prefer small sprint-sized changes and update this file plus `docs/ai-assistant/*` with touched files, validation, and next step.
- Lightbox redraw safety: When `redrawWorkspaceMode !== null` in `apps/web/src/components/image/GlobalLightbox.tsx`, all non-explicit close actions (Escape key, double clicking images/videos, clicking background container, mobile swipe gesture) are blocked, forcing the user to close the lightbox only via the explicit top-right "X" button.
