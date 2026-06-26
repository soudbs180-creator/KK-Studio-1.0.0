# Ecommerce Item Reference Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ecommerce requirement analysis show prompt + reference images per item, allow per-item manual reference uploads, and keep desktop/mobile layouts viewport-safe.

**Architecture:** Keep the existing XLSX image extraction path, improve item-level image ordering/binding heuristics, and add a lightweight runtime layer for per-item manual reference files in `App.tsx`. Surface the combined auto/manual references in the pre-confirm analysis review UI and reuse the merged references for post-confirm generation sync.

**Tech Stack:** React 19, TypeScript, Vite, existing ecommerce analysis services, source-contract tests plus focused behavior tests.

---

### Task 1: Parser Ordering and Binding

**Files:**
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\services\ecommerce\types.ts`
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\services\ecommerce\xlsx\openXmlWorkbookParser.ts`
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\services\ecommerce\normalize\ecommerceAnalysisNormalizer.ts`
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\services\ecommerce\xlsx\referenceBindingResolver.ts`
- Test: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\tests\unit\ecommerce-xlsx-parser.test.ts`

- [ ] Write failing parser tests for reversed floating-image order / left-right semantics and any row-binding rule being changed.
- [ ] Run the focused parser test file and confirm the new assertions fail for the intended reason.
- [ ] Implement the smallest heuristic improvement that sorts row assets spatially and improves ambiguous floating-image assignment without regressing current fixtures.
- [ ] Re-run the focused parser tests and confirm they pass.

### Task 2: Item-Level Manual Reference Runtime State

**Files:**
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\App.tsx`
- Test: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\tests\unit\ecommerce-runtime-upload-sync-contract.test.ts`

- [ ] Add failing contract assertions for item-level manual reference files being represented in ecommerce runtime sync.
- [ ] Run the focused runtime sync contract test and confirm it fails.
- [ ] Add per-item manual reference file state keyed by ecommerce source row key, clear it when requirement file/analysis resets, and merge it into the ecommerce node reference sync path.
- [ ] Re-run the focused runtime sync contract test and confirm it passes.

### Task 3: Analysis Review UI

**Files:**
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\components\ecommerce\EcommerceAnalysisReviewPanel.tsx`
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\components\layout\prompt-bar\DesktopComposerEcommercePanel.tsx`
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\App.tsx`
- Modify: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\src\index.css`
- Test: `C:\Users\Administrator\Downloads\KK-Studio-1.0.0\tests\unit\ecommerce-analysis-review-panel-contract.test.ts`

- [ ] Add failing review-panel contract assertions for item prompt preview, reference image surface, per-item upload/remove hooks, and viewport-safe container classes.
- [ ] Run the focused review-panel contract test and confirm it fails.
- [ ] Update the review panel to show a list/detail flow with prompt summary, full prompt preview, auto/manual references, and per-item upload/remove controls.
- [ ] Ensure desktop uses contained two-column layout and mobile uses stacked contained layout with internal scroll and no horizontal overflow.
- [ ] Re-run the focused review-panel contract test and confirm it passes.

### Task 4: End-to-End Validation

**Files:**
- Verify current change set only

- [ ] Run focused tests covering parser, review panel, and runtime sync.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run check:encoding`.
- [ ] Summarize any residual ambiguity still reported as `reviewWarnings` rather than silently force-binding.
