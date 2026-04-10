# Partial Redraw Flow Design

**Goal**

Replace the current mask-based redraw feature with a crop-based partial redraw workflow that:

- starts from the lightbox
- lets the user pick a supported image-to-image model
- lets the user pick a supported fixed aspect ratio
- lets the user freely box-select the region that should change
- crops an expanded generation region from the original image
- sends only that cropped region plus optional reference images to the selected image-to-image model
- composites the generated result back into the original image at the original location
- creates a new redraw prompt card with one modified full-image child card
- preserves the original source image and shows the final composited full image in the lightbox

**Scope**

- Redesign the desktop redraw flow launched from the image lightbox.
- Remove the existing mask/brush/eraser/rectangle inpaint UX.
- Stop using `maskUrl` and frontend `editMode='inpaint'` as the redraw execution path.
- Build a new partial redraw modal that supports:
  - model selection
  - supported-ratio selection
  - freeform selection rectangle
  - generated crop preview
  - prompt input
  - optional reference-image attachments
- Execute redraw through standard image-to-image generation using the cropped source region as the first required reference image.
- Composite the generated crop result back into the original image and persist the composited full image as the visible result.
- Create a new redraw prompt node linked to the source image and attach the new composited full-image child card to that prompt node.
- Preserve existing canvas lineage and lightbox viewing behavior where practical.

**Non-Goals**

- Mobile redraw UX in this phase.
- Multi-region redraw in one request.
- Brush-based masking, feathering, or manual alpha painting.
- True vendor-native inpaint orchestration as the primary workflow.
- Replacing the original image in place.
- Exposing the intermediate cropped generation image as a visible canvas card.

**Current Problems**

- The current redraw entry is wired as `GlobalLightbox -> InpaintModal -> App.tsx onInpaint -> PromptNode(mode=INPAINT) -> executeGeneration`.
- The current modal in [`src/components/image/InpaintModal.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/InpaintModal.tsx) is built around painting a mask:
  - brush
  - rectangle fill
  - eraser
  - mask export
- The current execution path stores redraw intent as `maskUrl` plus `GenerationMode.INPAINT`, then forwards that through the generation stack.
- This couples redraw to vendor-specific mask semantics and does not match the desired workflow of:
  - free box selection
  - ratio-constrained crop expansion
  - crop-based image-to-image generation
  - local composite back into the original image
- The current flow does not distinguish between:
  - the user-selected area that should actually change
  - the larger crop area that should be sent to the model to preserve local context
- The current UI and node metadata do not persist enough normalized geometry to reproduce or audit the redraw region accurately.

**Approved Product Decisions**

1. The redesign uses the crop-based workflow, not the legacy mask workflow.
2. The user chooses:
   - a model
   - a concrete supported aspect ratio
   - a freeform change region
3. The selection box itself is freeform.
4. The system automatically expands the selected region outward to the chosen ratio for model input.
5. The actual edited content that gets pasted back is only the user-selected inner region.
6. The redraw model list uses allowlist behavior:
   - only models that support image-to-image style input should appear
   - the flow should not show models that cannot participate
7. The original cropped region is treated as the required primary reference image.
8. Optional user-uploaded reference images may be added in addition to the primary cropped region.
9. The original image remains unchanged on the canvas.
10. A new redraw prompt card is created.
11. That redraw prompt card gets one composited full-image child card.
12. The lightbox for the redraw result shows the composited full image, not the intermediate crop.
13. Desktop only for this phase.

**User Experience**

**Entry**

- The lightbox keeps the `Redraw` action for still images.
- Clicking `Redraw` opens a new modal component instead of the current inpaint mask modal.

**Modal Layout**

- Center canvas:
  - displays the original source image
  - supports pointer-based box selection
- Top toolbar:
  - model picker
  - aspect-ratio picker
  - reset selection
  - toggle to preview the generated crop region
- Bottom panel:
  - prompt input
  - optional reference-image upload row
  - submit button
  - concise geometry summary

**Selection Behavior**

- The user drags any freeform rectangle to define the true changed area.
- The modal shows two overlays:
  - `selectionRect`: the true replacement region
  - `generationRect`: the ratio-constrained expanded crop region that will be sent to the model
- `generationRect` must always fully contain `selectionRect`.
- If expansion reaches image boundaries, the crop clamps to the source image edges instead of overflowing beyond the image.

**Execution Behavior**

- Submit is enabled only when:
  - a supported redraw model is selected
  - a concrete ratio is selected
  - the selection rectangle is valid
  - the prompt is non-empty or at least one optional reference image is attached
- The original cropped generation region is always the first input image to the model.
- Optional user reference images are appended after that primary crop.

**Result Behavior**

- The system composites the generated result back into the full original image.
- The final persisted result is the composited full image.
- The canvas gets:
  - a new redraw prompt node linked to the source image
  - one child generated image node containing the final composited full image
- The source image remains in place and visible.

**Architecture**

**1. New Redraw Modal**

Replace [`src/components/image/InpaintModal.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/InpaintModal.tsx) with a new [`src/components/image/PartialRedrawModal.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/PartialRedrawModal.tsx).

Responsibilities:

- load and display the source image
- manage viewport zoom/pan for inspection
- collect:
  - selected model
  - selected aspect ratio
  - selection rectangle
  - prompt
  - optional reference images
- compute and preview `generationRect`
- return a single redraw request payload back to the app shell

This modal does not generate images itself.

**2. Redraw Execution Service**

Add a pure helper module at [`src/services/image/partialRedraw.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/services/image/partialRedraw.ts).

Responsibilities:

- normalize source image dimensions
- convert between screen coordinates and normalized coordinates
- compute `generationRect` from:
  - source image dimensions
  - `selectionRect`
  - target aspect ratio
- crop the source image to the generation rectangle
- compute the inner offset of `selectionRect` relative to `generationRect`
- normalize and resample the generated crop result
- cut out the replacement region that corresponds to the original `selectionRect`
- composite that region back onto the full original image

This module should be deterministic and unit-tested without React.

**3. App-Shell Integration**

[`src/components/image/GlobalLightbox.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/GlobalLightbox.tsx):

- replace `onInpaint` with `onPartialRedraw`
- open `PartialRedrawModal` instead of the legacy inpaint modal

[`src/App.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/App.tsx):

- build the redraw prompt node
- link it with `sourceImageId`
- prepare redraw generation references
- call the standard image generation stack in image-to-image mode
- composite the generated result back into the original image
- add a new child image node under the redraw prompt node
- close or retarget lightbox state to the final composited result as appropriate

**Execution Model**

**1. Geometry Terms**

- `selectionRect`
  - the user-selected rectangle that should actually change
- `generationRect`
  - the expanded rectangle that matches the selected aspect ratio and is sent to the model
- `selectionRect` is always inside `generationRect`

Both rectangles should be persisted in normalized coordinates relative to the original full image:

- `x`
- `y`
- `width`
- `height`

All values are in `[0, 1]` after normalization.

**2. Crop Preparation**

Before generation:

1. Resolve the best available original source for the selected image.
2. Decode the original image dimensions.
3. Convert the modal selection to normalized `selectionRect`.
4. Expand outward to a ratio-constrained `generationRect`.
5. Crop the full original image to `generationRect`.
6. Store the crop as the first required generation reference image.
7. Append optional user-uploaded references after that first crop reference.

**3. Generation Request Rules**

- Do not send `maskUrl`.
- Do not rely on `editMode='inpaint'`.
- Treat redraw as standard image generation with reference images.
- The first reference image is always the generated crop from the original image.
- User-added reference images occupy remaining slots.

**4. Composite Rules**

After generation:

1. Load the returned generated crop image.
2. Resample it to the exact pixel size of `generationRect`.
3. Compute the offset of `selectionRect` inside `generationRect`.
4. Extract only that inner sub-rectangle from the generated crop result.
5. Composite that extracted region onto the original full image at the original `selectionRect` pixel coordinates.
6. Persist the composited full image as the final visible result.

This preserves untouched content outside the user-selected area regardless of model behavior.

**Model and Ratio Rules**

**1. Model Filtering**

The redraw modal model picker uses allowlist behavior.

Only show models that satisfy all of the following:

- image-generation capable
- support image-to-image or reference-image driven generation
- have at least one concrete supported ratio

This should reuse the existing model capability source in [`src/services/model/modelCapabilities.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/services/model/modelCapabilities.ts) instead of introducing a parallel capability registry.

**2. Ratio Filtering**

- Redraw requires a concrete ratio.
- `AUTO` must not appear in the redraw ratio picker.
- The ratio list comes from the selected model's supported ratios after removing `AUTO`.

**3. Reference Slot Budget**

- The original crop consumes the first reference slot.
- Additional user references are capped at:
  - `maxRefImages - 1`
- If a model only effectively supports one input image, the modal should hide or disable optional user references.

**Data Model**

Add a shared `partialRedraw` metadata block that can be attached to both `PromptNode` and `GeneratedImage`.

Suggested shape:

```ts
type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PartialRedrawMetadata = {
  sourceImageId: string;
  sourceImageStorageId?: string;
  sourcePromptId?: string;
  sourceImageDimensions: { width: number; height: number };
  selectionRect: NormalizedRect;
  generationRect: NormalizedRect;
  targetAspectRatio: AspectRatio;
  extraReferenceImageIds: string[];
  compositeVersion: 1;
};
```

**Prompt Node Storage**

The redraw prompt node should store:

- `mode: GenerationMode.REDRAW`
- `sourceImageId`
- `partialRedraw`
- user prompt text
- selected model
- selected aspect ratio
- references needed for generation

**Image Node Storage**

The final composited child image node should store:

- `parentPromptId`
- final composited full-image URL
- `partialRedraw`
- optional lineage metadata copied from the prompt node

The intermediate crop image is not stored as a visible image node.

**Legacy Compatibility**

- Existing `GenerationMode.INPAINT` data may still exist in saved canvases.
- Loading logic should preserve compatibility for old history, but new redraw requests must not create new `INPAINT` nodes.
- New code should introduce `GenerationMode.REDRAW`.
- If needed, historical `INPAINT` cards can be displayed with redraw-like labeling while continuing to load without migration loss.

**Deletion and Replacement Boundaries**

**Remove or stop using**

- [`src/components/image/InpaintModal.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/InpaintModal.tsx)
- `GlobalLightbox` redraw callback contract based on `(image, maskBase64, prompt)`
- `App.tsx` creation of `PromptNode` with:
  - `maskUrl`
  - `GenerationMode.INPAINT`
- prompt-bar mask indicator behavior for redraw
- prompt-bar redraw state based on `config.maskUrl` and `config.editMode === 'inpaint'`
- frontend redraw reliance on mask-specific request fields

**Add or replace with**

- [`src/components/image/PartialRedrawModal.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/PartialRedrawModal.tsx)
- [`src/services/image/partialRedraw.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/services/image/partialRedraw.ts)
- redraw execution callback from `GlobalLightbox` returning a structured redraw request
- `GenerationMode.REDRAW`
- new partial redraw metadata on prompt and image nodes

**Primary File Boundaries**

- [`src/components/image/GlobalLightbox.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/GlobalLightbox.tsx)
- [`src/components/image/InpaintModal.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/image/InpaintModal.tsx)
- [`src/components/layout/PromptBar.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/layout/PromptBar.tsx)
- [`src/App.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/App.tsx)
- [`src/hooks/useImageGeneration.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/hooks/useImageGeneration.ts)
- [`src/services/model/modelCapabilities.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/services/model/modelCapabilities.ts)
- [`src/context/CanvasContext.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/context/CanvasContext.tsx)
- [`src/types.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/types.ts)

**Risks**

- Different providers may still alter context inside the generation crop more aggressively than expected. The local composite step limits the blast radius to the selected area, but visual seam quality may vary.
- Boundary-adjacent selections may produce smaller-than-ideal generation context when the expanded ratio crop clamps to the source image edge.
- If the best available original source is only a compressed preview, composite quality may be lower than desired. The flow should prefer original/high-resolution recovery where available.
- Introducing `GenerationMode.REDRAW` affects lineage rendering, styling, and saved-canvas compatibility. Historical load behavior must be checked carefully.
- PromptBar still contains legacy redraw state today. Leaving any of that active would create split-brain redraw behavior between prompt bar and lightbox.

**Acceptance Criteria**

- The lightbox `Redraw` action opens the new partial redraw modal.
- The old mask painting UI is gone from the redraw flow.
- The redraw modal only shows supported image-to-image models.
- The redraw modal only shows supported concrete ratios for the selected model.
- The user can freely draw a selection rectangle.
- The UI clearly shows both:
  - the true changed region
  - the expanded generated crop region
- Submit sends a cropped source region plus optional reference images through normal image generation.
- No new redraw request uses `maskUrl` as its primary execution path.
- The final generated result is composited back into the original full image.
- The canvas keeps the original image unchanged.
- A new redraw prompt card is created and linked to the source image.
- That prompt card gets one final composited full-image child card.
- Opening the result in the lightbox shows the final composited full image.
- Desktop flow works end-to-end without introducing mobile-only UI regressions.

**Verification**

- Spec review for clarity, contradictions, and missing decisions before implementation.
- During implementation, require at least:
  - `npm run typecheck`
  - `npm run check:encoding`
- Because this spec is a docs change, also require:
  - `npm run governance:agent-docs`
- Add unit coverage for:
  - ratio expansion math
  - crop-to-composite coordinate mapping
  - redraw model filtering
  - removal of legacy mask redraw entry points
