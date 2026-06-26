# Partial Redraw Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy mask-based redraw flow with a desktop-only crop-based partial redraw workflow that creates a new redraw prompt card and a composited full-image result card while leaving the original image untouched.

**Architecture:** Introduce a pure partial-redraw helper module for geometry and crop/composite orchestration, then move the lightbox redraw entry to a new `PartialRedrawModal` that returns structured redraw requests instead of mask payloads. Wire the result through `App.tsx` and `useImageGeneration.ts` so redraw runs through normal image-to-image generation and composites the returned crop back into the original full image before the child image node is created.

**Tech Stack:** React 19, TypeScript, Vite, node:test, existing canvas/image storage helpers, existing `modelCapabilities` registry.

---

## File Structure

- `src/types.ts`
  - Add `GenerationMode.REDRAW`
  - Add `NormalizedRect`, `PartialRedrawMetadata`, and `PartialRedrawRequest`
  - Attach `partialRedraw?: PartialRedrawMetadata` to `PromptNode` and `GeneratedImage`
- `src/services/image/partialRedraw.ts`
  - New pure helper module for rectangle math and redraw crop/composite orchestration
- `src/services/model/modelCapabilities.ts`
  - Add redraw-specific capability helpers that reuse existing capability data
- `src/components/image/PartialRedrawModal.tsx`
  - New desktop redraw modal for model selection, ratio selection, region selection, prompt, and optional references
- `src/components/image/GlobalLightbox.tsx`
  - Replace `InpaintModal` integration with `PartialRedrawModal`
  - Replace `onInpaint` contract with `onPartialRedraw`
- `src/App.tsx`
  - Build redraw prompt nodes from lightbox requests
  - Prepare cropped source references
  - Keep original image untouched
  - Preserve redraw lineage and lightbox behavior
- `src/hooks/useImageGeneration.ts`
  - Detect `GenerationMode.REDRAW`
  - Composite returned crop results back into the full source image before image-node creation
- `src/components/layout/PromptBar.tsx`
  - Remove old mask-based redraw state and modal wiring
- `src/components/mobile/MobileTabBar.tsx`
  - Add `REDRAW` label mapping so the new mode compiles cleanly and historical mode labels remain coherent
- `tests/unit/partial-redraw.test.ts`
  - Geometry helper coverage
- `tests/unit/partial-redraw-model-capabilities.test.ts`
  - Redraw-model filtering coverage
- `tests/unit/partial-redraw-lightbox-contract.test.ts`
  - Source-regression coverage for lightbox/modal contract swap
- `tests/unit/partial-redraw-pipeline-contract.test.ts`
  - Source-regression coverage for `App.tsx`, `useImageGeneration.ts`, and `PromptBar.tsx`

### Task 1: Add Redraw Types And Geometry Helpers

**Files:**
- Create: `src/services/image/partialRedraw.ts`
- Modify: `src/types.ts`
- Test: `tests/unit/partial-redraw.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AspectRatio } from '../../src/types.ts';
import {
  clampNormalizedRect,
  expandSelectionToAspectRatio,
  resolvePixelRect,
  resolveRelativeSelectionRect,
} from '../../src/services/image/partialRedraw.ts';

test('expandSelectionToAspectRatio grows the selection outward to the target ratio without leaving image bounds', () => {
  const selection = { x: 0.42, y: 0.20, width: 0.10, height: 0.28 };
  const result = expandSelectionToAspectRatio(
    selection,
    { width: 2400, height: 1600 },
    AspectRatio.LANDSCAPE_16_9,
  );

  assert.equal(result.x >= 0, true);
  assert.equal(result.y >= 0, true);
  assert.equal(result.x + result.width <= 1, true);
  assert.equal(result.y + result.height <= 1, true);
  assert.equal(result.x <= selection.x, true);
  assert.equal(result.y <= selection.y, true);
  assert.equal(result.x + result.width >= selection.x + selection.width, true);
  assert.equal(result.y + result.height >= selection.y + selection.height, true);

  const ratio = Number((result.width / result.height).toFixed(4));
  assert.equal(ratio, Number((16 / 9).toFixed(4)));
});

test('resolveRelativeSelectionRect maps the inner redraw slice inside the expanded crop', () => {
  const selection = { x: 0.40, y: 0.30, width: 0.15, height: 0.10 };
  const generation = { x: 0.25, y: 0.20, width: 0.40, height: 0.225 };

  assert.deepEqual(resolveRelativeSelectionRect(selection, generation), {
    x: 0.375,
    y: 0.4444444444444444,
    width: 0.375,
    height: 0.4444444444444444,
  });
});

test('resolvePixelRect rounds normalized rectangles against source dimensions', () => {
  assert.deepEqual(
    resolvePixelRect({ x: 0.125, y: 0.2, width: 0.25, height: 0.3 }, { width: 2000, height: 1000 }),
    { x: 250, y: 200, width: 500, height: 300 },
  );

  assert.deepEqual(
    clampNormalizedRect({ x: -0.05, y: 0.92, width: 0.2, height: 0.2 }),
    { x: 0, y: 0.8, width: 0.2, height: 0.2 },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw.test.ts
```

Expected: FAIL with a module resolution error for `src/services/image/partialRedraw.ts` or missing exports such as `expandSelectionToAspectRatio`.

- [ ] **Step 3: Write the minimal implementation**

Add the new redraw mode and metadata to `src/types.ts`:

```ts
export enum GenerationMode {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  PPT = 'ppt',
  EDIT = 'edit',
  INPAINT = 'inpaint',
  REDRAW = 'redraw',
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PartialRedrawMetadata {
  sourceImageId: string;
  sourceImageStorageId?: string;
  sourcePromptId?: string;
  sourceImageDimensions: { width: number; height: number };
  selectionRect: NormalizedRect;
  generationRect: NormalizedRect;
  targetAspectRatio: AspectRatio;
  extraReferenceImageIds: string[];
  compositeVersion: 1;
}

export interface PartialRedrawRequest {
  model: ModelType;
  aspectRatio: AspectRatio;
  prompt: string;
  selectionRect: NormalizedRect;
  generationRect: NormalizedRect;
  sourceImageDimensions: { width: number; height: number };
  referenceImages: ReferenceImage[];
}
```

Attach the metadata to image and prompt nodes:

```ts
export interface GeneratedImage {
  // existing fields...
  partialRedraw?: PartialRedrawMetadata;
}

export interface PromptNode {
  // existing fields...
  partialRedraw?: PartialRedrawMetadata;
}
```

Create `src/services/image/partialRedraw.ts`:

```ts
import { AspectRatio, type NormalizedRect } from '../../types';

export type PixelSize = { width: number; height: number };
export type PixelRect = { x: number; y: number; width: number; height: number };

const ASPECT_RATIO_NUMBERS: Record<AspectRatio, number> = {
  [AspectRatio.AUTO]: 1,
  [AspectRatio.SQUARE]: 1,
  [AspectRatio.PORTRAIT_1_8]: 1 / 8,
  [AspectRatio.PORTRAIT_1_4]: 1 / 4,
  [AspectRatio.PORTRAIT_2_3]: 2 / 3,
  [AspectRatio.PORTRAIT_3_4]: 3 / 4,
  [AspectRatio.PORTRAIT_4_5]: 4 / 5,
  [AspectRatio.PORTRAIT_9_16]: 9 / 16,
  [AspectRatio.LANDSCAPE_3_2]: 3 / 2,
  [AspectRatio.LANDSCAPE_4_3]: 4 / 3,
  [AspectRatio.LANDSCAPE_5_4]: 5 / 4,
  [AspectRatio.LANDSCAPE_16_9]: 16 / 9,
  [AspectRatio.LANDSCAPE_21_9]: 21 / 9,
  [AspectRatio.LANDSCAPE_4_1]: 4 / 1,
  [AspectRatio.LANDSCAPE_8_1]: 8 / 1,
  [AspectRatio.PORTRAIT_9_21]: 9 / 21,
};

export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect {
  const width = Math.min(1, Math.max(0, rect.width));
  const height = Math.min(1, Math.max(0, rect.height));
  const x = Math.min(1 - width, Math.max(0, rect.x));
  const y = Math.min(1 - height, Math.max(0, rect.y));
  return { x, y, width, height };
}

export function expandSelectionToAspectRatio(
  selectionRect: NormalizedRect,
  _sourceSize: PixelSize,
  aspectRatio: AspectRatio,
): NormalizedRect {
  const targetRatio = ASPECT_RATIO_NUMBERS[aspectRatio] ?? 1;
  let width = selectionRect.width;
  let height = selectionRect.height;
  const currentRatio = width / height;

  if (currentRatio > targetRatio) {
    height = width / targetRatio;
  } else {
    width = height * targetRatio;
  }

  const centerX = selectionRect.x + selectionRect.width / 2;
  const centerY = selectionRect.y + selectionRect.height / 2;
  return clampNormalizedRect({
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  });
}

export function resolveRelativeSelectionRect(
  selectionRect: NormalizedRect,
  generationRect: NormalizedRect,
): NormalizedRect {
  return {
    x: (selectionRect.x - generationRect.x) / generationRect.width,
    y: (selectionRect.y - generationRect.y) / generationRect.height,
    width: selectionRect.width / generationRect.width,
    height: selectionRect.height / generationRect.height,
  };
}

export function resolvePixelRect(rect: NormalizedRect, size: PixelSize): PixelRect {
  return {
    x: Math.round(rect.x * size.width),
    y: Math.round(rect.y * size.height),
    width: Math.round(rect.width * size.width),
    height: Math.round(rect.height * size.height),
  };
}
```

- [ ] **Step 4: Run tests and typecheck to verify they pass**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw.test.ts
cmd /c npm run typecheck
```

Expected:

- the new unit test file passes
- `typecheck` passes without adding `maskUrl` regressions

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/services/image/partialRedraw.ts tests/unit/partial-redraw.test.ts
git commit -m "feat: add partial redraw geometry primitives"
```

### Task 2: Add Redraw Model Filtering Helpers

**Files:**
- Modify: `src/services/model/modelCapabilities.ts`
- Test: `tests/unit/partial-redraw-model-capabilities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AspectRatio } from '../../src/types.ts';
import {
  getPartialRedrawSupportedRatios,
  modelSupportsPartialRedraw,
} from '../../src/services/model/modelCapabilities.ts';

test('modelSupportsPartialRedraw only allows models that can accept an input image and a concrete ratio', () => {
  assert.equal(modelSupportsPartialRedraw('gemini-2.5-flash-image'), true);
  assert.equal(modelSupportsPartialRedraw('gpt-image-1'), true);
  assert.equal(modelSupportsPartialRedraw('imagen-4.0-generate-001'), false);
});

test('getPartialRedrawSupportedRatios strips AUTO from redraw choices', () => {
  const ratios = getPartialRedrawSupportedRatios('gemini-2.5-flash-image');
  assert.equal(ratios.includes(AspectRatio.AUTO), false);
  assert.equal(ratios.includes(AspectRatio.LANDSCAPE_16_9), true);
  assert.equal(ratios.includes(AspectRatio.SQUARE), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw-model-capabilities.test.ts
```

Expected: FAIL because `modelSupportsPartialRedraw` and `getPartialRedrawSupportedRatios` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Add the helper exports to `src/services/model/modelCapabilities.ts`:

```ts
export function getPartialRedrawSupportedRatios(modelId: string): AspectRatio[] {
  const caps = getModelCapabilities(modelId);
  return (caps.supportedRatios || []).filter((ratio) => ratio !== AspectRatio.AUTO);
}

export function modelSupportsPartialRedraw(modelId: string): boolean {
  const caps = getModelCapabilities(modelId);
  const concreteRatios = getPartialRedrawSupportedRatios(modelId);
  const maxRefImages = typeof caps.maxRefImages === 'number' ? caps.maxRefImages : 10;
  return concreteRatios.length > 0 && maxRefImages > 0;
}
```

Keep the implementation anchored to the existing single capability source of truth. Do not add a second redraw-specific registry.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw-model-capabilities.test.ts
cmd /c npm run typecheck
```

Expected:

- redraw capability tests pass
- `typecheck` passes with the new exports

- [ ] **Step 5: Commit**

```bash
git add src/services/model/modelCapabilities.ts tests/unit/partial-redraw-model-capabilities.test.ts
git commit -m "feat: add partial redraw model capability guards"
```

### Task 3: Swap The Lightbox To A Structured Partial Redraw Modal

**Files:**
- Create: `src/components/image/PartialRedrawModal.tsx`
- Modify: `src/components/image/GlobalLightbox.tsx`
- Test: `tests/unit/partial-redraw-lightbox-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('lightbox uses PartialRedrawModal and no longer wires the legacy inpaint contract', () => {
  const lightboxSource = readSource('src/components/image/GlobalLightbox.tsx');

  assert.match(lightboxSource, /import \{ PartialRedrawModal \} from '\.\/PartialRedrawModal';/);
  assert.match(lightboxSource, /onPartialRedraw\?: \(image: GeneratedImage, request: PartialRedrawRequest\) => void;/);
  assert.match(lightboxSource, /setShowPartialRedraw\(true\)/);
  assert.match(lightboxSource, /<PartialRedrawModal/);
  assert.doesNotMatch(lightboxSource, /InpaintModal/);
  assert.doesNotMatch(lightboxSource, /onInpaint/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw-lightbox-contract.test.ts
```

Expected: FAIL because `GlobalLightbox.tsx` still imports `InpaintModal` and still exposes `onInpaint`.

- [ ] **Step 3: Write the minimal implementation**

Create the new modal shell in `src/components/image/PartialRedrawModal.tsx`:

```tsx
import React, { useMemo, useState } from 'react';

import {
  AspectRatio,
  type GeneratedImage,
  type PartialRedrawRequest,
  type ReferenceImage,
} from '../../types';
import {
  expandSelectionToAspectRatio,
  type PixelSize,
} from '../../services/image/partialRedraw';
import {
  getPartialRedrawSupportedRatios,
  modelSupportsPartialRedraw,
} from '../../services/model/modelCapabilities';

interface PartialRedrawModalProps {
  image: GeneratedImage;
  imageUrl: string;
  onCancel: () => void;
  onSubmit: (request: PartialRedrawRequest) => void;
}

export const PartialRedrawModal: React.FC<PartialRedrawModalProps> = ({
  image,
  imageUrl,
  onCancel,
  onSubmit,
}) => {
  const [model, setModel] = useState(image.model);
  const [prompt, setPrompt] = useState('');
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [sourceSize, setSourceSize] = useState<PixelSize | null>(null);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);

  const availableModels = useMemo(
    () => [image.model].filter((candidate) => modelSupportsPartialRedraw(candidate)),
    [image.model],
  );
  const availableRatios = useMemo(
    () => getPartialRedrawSupportedRatios(model),
    [model],
  );
  const aspectRatio = availableRatios[0] ?? AspectRatio.SQUARE;
  const generationRect = selectionRect && sourceSize
    ? expandSelectionToAspectRatio(selectionRect, sourceSize, aspectRatio)
    : null;

  return (
    <div className="fixed inset-0 z-[100000]">
      {/* keep the final implementation desktop-only; render model picker, ratio picker, two overlays, prompt, refs, submit */}
      <button onClick={onCancel}>Cancel</button>
      <button
        onClick={() => {
          if (!selectionRect || !generationRect || !sourceSize) return;
          onSubmit({
            model,
            aspectRatio,
            prompt,
            selectionRect,
            generationRect,
            sourceImageDimensions: sourceSize,
            referenceImages,
          });
        }}
      >
        Redraw
      </button>
    </div>
  );
};
```

Update `src/components/image/GlobalLightbox.tsx`:

```tsx
import { PartialRedrawModal } from './PartialRedrawModal';

interface GlobalLightboxProps {
  // existing props...
  onPartialRedraw?: (image: GeneratedImage, request: PartialRedrawRequest) => void;
}

const [showPartialRedraw, setShowPartialRedraw] = useState(false);

{onPartialRedraw && !isVideo && !isAudio && displaySrc && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setShowPartialRedraw(true);
    }}
    className={`${actionButtonClass} hover:border-purple-500 hover:bg-purple-600/80`}
    title="重绘"
  >
    <Pen size={16} />
    重绘
  </button>
)}

{showPartialRedraw && displaySrc && (
  <PartialRedrawModal
    image={image}
    imageUrl={displaySrc}
    onCancel={() => setShowPartialRedraw(false)}
    onSubmit={(request) => {
      setShowPartialRedraw(false);
      onPartialRedraw?.(image, request);
      onClose();
    }}
  />
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw-lightbox-contract.test.ts
cmd /c npm run typecheck
```

Expected:

- the lightbox contract regression test passes
- the new modal compiles cleanly

- [ ] **Step 5: Commit**

```bash
git add src/components/image/PartialRedrawModal.tsx src/components/image/GlobalLightbox.tsx tests/unit/partial-redraw-lightbox-contract.test.ts
git commit -m "feat: replace lightbox inpaint modal with partial redraw modal"
```

### Task 4: Build The Redraw Prompt Node And Composite Pipeline

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useImageGeneration.ts`
- Modify: `src/services/image/partialRedraw.ts`
- Test: `tests/unit/partial-redraw-pipeline-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('App creates REDRAW prompt nodes from lightbox requests and useImageGeneration composites redraw outputs', () => {
  const appSource = readSource('src/App.tsx');
  const generationSource = readSource('src/hooks/useImageGeneration.ts');

  assert.match(appSource, /onPartialRedraw=\{\(image, request\) => \{/);
  assert.match(appSource, /mode:\s*GenerationMode\.REDRAW/);
  assert.match(appSource, /partialRedraw:\s*\{/);
  assert.match(appSource, /sourceImageId:\s*sourceImage\.id/);
  assert.match(appSource, /referenceImages:\s*\[\s*croppedSourceReference,\s*\.\.\.request\.referenceImages\s*\]/);
  assert.doesNotMatch(appSource, /maskUrl:\s*maskBase64/);

  assert.match(generationSource, /executionNode\.mode === GenerationMode\.REDRAW/);
  assert.match(generationSource, /await compositePartialRedrawResult\(/);
  assert.match(generationSource, /partialRedraw:\s*executionNode\.partialRedraw/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw-pipeline-contract.test.ts
```

Expected: FAIL because `App.tsx` still builds `INPAINT` prompt nodes and `useImageGeneration.ts` has no redraw composite branch.

- [ ] **Step 3: Write the minimal implementation**

Extend `src/services/image/partialRedraw.ts` with the async crop/composite helpers:

```ts
export async function buildPartialRedrawReferenceImage(
  sourceUrl: string,
  generationRect: NormalizedRect,
  sourceSize: PixelSize,
): Promise<ReferenceImage> {
  const cropRect = resolvePixelRect(generationRect, sourceSize);
  const dataUrl = await cropImageToDataUrl(sourceUrl, cropRect);
  return {
    id: `partial-redraw-source-${Date.now()}`,
    data: dataUrl,
    mimeType: 'image/png',
  };
}

export async function compositePartialRedrawResult(options: {
  originalImageUrl: string;
  generatedCropUrl: string;
  partialRedraw: PartialRedrawMetadata;
}): Promise<string> {
  const original = await loadImage(options.originalImageUrl);
  const generated = await loadImage(options.generatedCropUrl);
  const canvas = document.createElement('canvas');
  canvas.width = original.width;
  canvas.height = original.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PARTIAL_REDRAW_CANVAS_CONTEXT_MISSING');

  ctx.drawImage(original, 0, 0);

  const generationRectPx = resolvePixelRect(options.partialRedraw.generationRect, {
    width: original.width,
    height: original.height,
  });
  const selectionRectPx = resolvePixelRect(options.partialRedraw.selectionRect, {
    width: original.width,
    height: original.height,
  });
  const relativeSelection = resolveRelativeSelectionRect(
    options.partialRedraw.selectionRect,
    options.partialRedraw.generationRect,
  );

  const sliceX = Math.round(relativeSelection.x * generationRectPx.width);
  const sliceY = Math.round(relativeSelection.y * generationRectPx.height);
  const sliceWidth = selectionRectPx.width;
  const sliceHeight = selectionRectPx.height;

  ctx.drawImage(
    generated,
    sliceX,
    sliceY,
    sliceWidth,
    sliceHeight,
    selectionRectPx.x,
    selectionRectPx.y,
    selectionRectPx.width,
    selectionRectPx.height,
  );

  return canvas.toDataURL('image/png');
}
```

Update the lightbox callback in `src/App.tsx`:

```tsx
onPartialRedraw={(image, request) => {
  const sourceImage = activeCanvas?.imageNodes.find((img) => img.id === image.id) || image;
  const parentPromptId = sourceImage.parentPromptId;
  const sourcePrompt = parentPromptId
    ? activeCanvas?.promptNodes.find((promptNode) => promptNode.id === parentPromptId)
    : undefined;

  void (async () => {
    const croppedSourceReference = await buildPartialRedrawReferenceImage(
      sourceImage.originalUrl || sourceImage.url,
      request.generationRect,
      request.sourceImageDimensions,
    );

    const redrawPromptNode: PromptNode = {
      id: `${Date.now()}_partial_redraw_prompt`,
      prompt: request.prompt.trim(),
      originalPrompt: request.prompt.trim(),
      position: resolveFollowUpPromptPosition(sourceImage, sourcePrompt, activeCanvas),
      aspectRatio: request.aspectRatio,
      imageSize: sourceImage.imageSize || config.imageSize,
      model: request.model,
      modelLabel: resolveModelDisplayName(request.model, getModelMetadata(request.model)?.name),
      provider: sourceImage.provider,
      providerLabel: sourceImage.providerLabel,
      childImageIds: [],
      referenceImages: [croppedSourceReference, ...request.referenceImages],
      timestamp: Date.now(),
      sourceImageId: sourceImage.id,
      isGenerating: true,
      mode: GenerationMode.REDRAW,
      partialRedraw: {
        sourceImageId: sourceImage.id,
        sourceImageStorageId: sourceImage.storageId,
        sourcePromptId: sourcePrompt?.id,
        sourceImageDimensions: request.sourceImageDimensions,
        selectionRect: request.selectionRect,
        generationRect: request.generationRect,
        targetAspectRatio: request.aspectRatio,
        extraReferenceImageIds: request.referenceImages.map((ref) => ref.storageId || ref.id),
        compositeVersion: 1,
      },
      tags: [],
    };

    addPromptNode(redrawPromptNode);
    executeGeneration(redrawPromptNode);
  })();
}}
```

Update `src/hooks/useImageGeneration.ts` so redraw composites before image-node creation:

```ts
const isRedraw = mode === GenerationMode.REDRAW;
const sourceImageForRedraw = isRedraw && executionNode.partialRedraw?.sourceImageId
  ? activeCanvasRef.current?.imageNodes.find((imageNode) => imageNode.id === executionNode.partialRedraw?.sourceImageId)
  : undefined;

const finalizedUrl = isRedraw && executionNode.partialRedraw && sourceImageForRedraw
  ? await compositePartialRedrawResult({
      originalImageUrl: sourceImageForRedraw.originalUrl || sourceImageForRedraw.url,
      generatedCropUrl: item.originalUrl || item.url,
      partialRedraw: executionNode.partialRedraw,
    })
  : item.url;

return {
  id: uniqueId,
  storageId: uniqueId,
  url: finalizedUrl,
  originalUrl: finalizedUrl,
  // existing fields...
  mode,
  partialRedraw: executionNode.partialRedraw,
};
```

Keep the redraw branch off the legacy `maskUrl` path:

```ts
maskUrl: executionNode.mode === GenerationMode.REDRAW ? undefined : executionNode.maskUrl,
editMode: executionNode.mode === GenerationMode.EDIT ? 'edit' : undefined,
```

- [ ] **Step 4: Run tests and targeted verification to verify they pass**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw-pipeline-contract.test.ts
cmd /c npm run typecheck
```

Expected:

- the redraw pipeline contract test passes
- `typecheck` passes with the new redraw branch

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/hooks/useImageGeneration.ts src/services/image/partialRedraw.ts tests/unit/partial-redraw-pipeline-contract.test.ts
git commit -m "feat: wire crop-based partial redraw generation pipeline"
```

### Task 5: Remove Legacy PromptBar Inpaint State And Finish Compatibility Sweep

**Files:**
- Modify: `src/components/layout/PromptBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/mobile/MobileTabBar.tsx`
- Test: `tests/unit/partial-redraw-pipeline-contract.test.ts`

- [ ] **Step 1: Extend the failing regression test for cleanup and compatibility**

Append these assertions to `tests/unit/partial-redraw-pipeline-contract.test.ts`:

```ts
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const mobileTabBarSource = readSource('src/components/mobile/MobileTabBar.tsx');

  assert.doesNotMatch(promptBarSource, /import \{ InpaintModal \} from '\.\.\/image\/InpaintModal';/);
  assert.doesNotMatch(promptBarSource, /config\.maskUrl/);
  assert.doesNotMatch(promptBarSource, /editMode:\s*'inpaint'/);
  assert.doesNotMatch(promptBarSource, /inpaintImage/);

  assert.match(mobileTabBarSource, /\[GenerationMode\.REDRAW\]: '\u91cd\u7ed8'/);
  assert.match(appSource, /pn\.mode === GenerationMode\.REDRAW \|\| pn\.mode === GenerationMode\.INPAINT/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw-pipeline-contract.test.ts
```

Expected: FAIL because `PromptBar.tsx` still imports `InpaintModal`, still writes `maskUrl`, and the mode compatibility mapping is not updated yet.

- [ ] **Step 3: Write the minimal implementation**

Remove the legacy redraw state from `src/components/layout/PromptBar.tsx`:

```tsx
// delete:
import { InpaintModal } from '../image/InpaintModal';

// delete:
const [inpaintImage, setInpaintImage] = useState<{ url: string } | null>(null);

// delete the mask indicator and the bottom-of-file <InpaintModal ... /> block

// when removing a reference image, do not special-case config.maskUrl anymore:
removeReferenceImage(img.id);
```

Keep redraw connector compatibility in `src/App.tsx`:

```tsx
const isRedrawMode = pn.mode === GenerationMode.REDRAW || pn.mode === GenerationMode.INPAINT;
const baseColor = isRedrawMode ? '#22c55e' : '#eab308';
const hoverClass = isRedrawMode ? 'group-hover:stroke-green-400' : 'group-hover:stroke-yellow-400';
```

Add the new mode label in `src/components/mobile/MobileTabBar.tsx`:

```ts
[GenerationMode.REDRAW]: '\u91cd\u7ed8',
```

- [ ] **Step 4: Run the targeted tests plus final verification**

Run:

```bash
node --import ./scripts/test/set-log-level.mjs --test tests/unit/partial-redraw.test.ts tests/unit/partial-redraw-model-capabilities.test.ts tests/unit/partial-redraw-lightbox-contract.test.ts tests/unit/partial-redraw-pipeline-contract.test.ts
cmd /c npm run typecheck
cmd /c npm run check:encoding
```

Expected:

- all four redraw-related unit tests pass
- `typecheck` passes
- `check:encoding` passes

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/PromptBar.tsx src/App.tsx src/components/mobile/MobileTabBar.tsx tests/unit/partial-redraw-pipeline-contract.test.ts
git commit -m "feat: remove legacy inpaint state and finish partial redraw rollout"
```
