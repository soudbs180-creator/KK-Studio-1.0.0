# Prompt Optimizer Autoroute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the visible prompt-library/template entrypoints and upgrade prompt optimization so one toggle can auto-route short user input through the right hidden optimization archetype.

**Architecture:** Keep the existing `enablePromptOptimization` toggle as the only user-facing control. Move template selection and instruction assembly into the optimizer service so `App` no longer persists or stitches together template-specific config, while the UI and prompt-node rendering consume the service result as an automatic optimization strategy instead of a user-picked template.

**Tech Stack:** React 19, TypeScript, Node test runner, Vite

---

### Task 1: Lock the new contract with failing tests

**Files:**
- Create: `tests/unit/prompt-optimizer-autoroute-contract.test.ts`
- Modify: `tests/unit/prompt-bar-layout-regression.test.ts`

- [ ] **Step 1: Write the failing autoroute contract test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildAutomaticOptimizationInstruction,
  inferPromptOptimizationArchetype,
} from '../../src/config/promptOptimizerTemplates';

test('short product prompts auto-route to the product archetype', () => {
  assert.equal(
    inferPromptOptimizationArchetype('白底耳机产品图', 'image'),
    'product-hero',
  );
});

test('automatic optimization instruction includes the matched template guidance', () => {
  const instruction = buildAutomaticOptimizationInstruction('AI 数据看板 UI', {
    mode: 'image',
    aspectRatio: '16:9',
  });

  assert.match(instruction, /grid|hierarchy|layout/i);
  assert.match(instruction, /16:9/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/prompt-optimizer-autoroute-contract.test.ts`
Expected: FAIL because the helper exports do not exist yet.

- [ ] **Step 3: Extend the PromptBar layout regression test to forbid prompt-library entrypoints**

```ts
assert.doesNotMatch(promptBarSource, /提示词库/);
assert.doesNotMatch(promptBarSource, /showPromptLibrary/);
```

- [ ] **Step 4: Run the regression test to verify it fails**

Run: `node --test tests/unit/prompt-bar-layout-regression.test.ts`
Expected: FAIL because the current source still contains the prompt-library UI.

---

### Task 2: Implement service-side automatic optimizer routing

**Files:**
- Modify: `src/config/promptOptimizerTemplates.ts`
- Modify: `src/services/llm/promptOptimizerService.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add pure archetype-selection helpers to the template config**

```ts
export type PromptOptimizerArchetypeId = PromptOptimizerTemplate['id'];

export const inferPromptOptimizationArchetype = (
  input: string,
  mode: GenerationMode = GenerationMode.IMAGE,
): PromptOptimizerArchetypeId => {
  // keyword-led routing for product / cinematic / ui / ppt / fallback
};
```

- [ ] **Step 2: Add a single service-facing instruction builder**

```ts
export const buildAutomaticOptimizationInstruction = (
  input: string,
  options?: { mode?: GenerationMode | string; aspectRatio?: string; referenceImageCount?: number },
): string => {
  // select archetype internally and append compact contextual constraints
};
```

- [ ] **Step 3: Remove front-end-only optimizer config fields from `GenerationConfig`**

```ts
export interface GenerationConfig {
  prompt: string;
  enablePromptOptimization?: boolean;
  aspectRatio: AspectRatio;
  // promptOptimizationMode/template/customPrompt removed
}
```

- [ ] **Step 4: Refactor `optimizePromptForImage` to use the internal autoroute helpers**

```ts
const autoInstruction = buildAutomaticOptimizationInstruction(input, {
  mode: options?.mode,
  aspectRatio: options?.aspectRatio,
  referenceImageCount: options?.referenceImages?.length || 0,
});
```

- [ ] **Step 5: Keep prompt-node metadata explainable even without user-picked templates**

```ts
meta: {
  template_id: selectedTemplate.id,
  template_title: selectedTemplate.title,
  strategy,
  validation_status,
}
```

- [ ] **Step 6: Run the autoroute contract test to verify it passes**

Run: `node --test tests/unit/prompt-optimizer-autoroute-contract.test.ts`
Expected: PASS

---

### Task 3: Remove visible prompt-library entrypoints and migrate app config

**Files:**
- Modify: `src/components/layout/PromptBar.tsx`
- Modify: `src/components/mobile/MobileWorkspaceQuickBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/canvas/PromptNodeComponent.tsx`

- [ ] **Step 1: Delete desktop PromptBar prompt-library state, handlers, drag path, and popover**

```tsx
// remove showPromptLibrary, promptLibrarySearch, favorites, applyPromptTemplate,
// and the entire prompt-library button + panel block
```

- [ ] **Step 2: Delete the mobile quick-bar prompt-library pill and dead callback**

```tsx
// remove onOpenPromptLibrary prop and button
```

- [ ] **Step 3: Simplify `App` config persistence to only keep the optimization toggle**

```ts
enablePromptOptimization: parsed.enablePromptOptimization || false,
```

- [ ] **Step 4: Update the generation path to call the optimizer without template/mode/custom config plumbing**

```ts
const optimized = await optimizePromptForImage(rawPrompt, {
  preferredModelId: config.model,
  aspectRatio: config.aspectRatio,
  imageSize: config.imageSize,
  mode: config.mode,
  supportsThinking: !!getModelCapabilities(config.model)?.supportsThinking,
  thinkingMode: config.thinkingMode || 'minimal',
  referenceImages: finalReferenceImages,
});
```

- [ ] **Step 5: Make prompt-node rendering treat the template badge as automatic strategy metadata**

```tsx
{node.promptOptimizerResult?.meta?.template_title && (
  <span>自动策略：{node.promptOptimizerResult.meta.template_title}</span>
)}
```

- [ ] **Step 6: Run the PromptBar regression test to verify it passes**

Run: `node --test tests/unit/prompt-bar-layout-regression.test.ts`
Expected: PASS

---

### Task 4: Run repository verification for code and docs

**Files:**
- Verify only

- [ ] **Step 1: Run repository type checks**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run docs governance because the plan file was added**

Run: `npm run governance:agent-docs`
Expected: PASS

- [ ] **Step 3: Run encoding verification**

Run: `npm run check:encoding`
Expected: PASS
