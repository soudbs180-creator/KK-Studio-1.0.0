import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { buildDockedPromptChildRegroupLayout } from '../../src/utils/generatedImageLayout.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt-group regroup keeps the right-most child on the right-most dock slot', () => {
  const layout = buildDockedPromptChildRegroupLayout({
    basePosition: { x: 0, y: 0 },
    items: [
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
    ],
    regroupStartPositions: [
      { x: -154, y: 400 },
      { x: 154, y: 400 },
      { x: 0, y: 748 },
    ],
    fastRegroupProgress: 1,
    settleRegroupProgress: 0,
  });

  assert.equal(layout.length, 3);
  assert.ok(layout[1]!.dockedPosition.x > layout[2]!.dockedPosition.x);
});

test('prompt-group regroup keeps a wider dock gap below the main card during recycle', () => {
  const [layout] = buildDockedPromptChildRegroupLayout({
    basePosition: { x: 0, y: 0 },
    items: [{ aspectRatio: '1:1' as never }],
    regroupStartPositions: [{ x: 0, y: 400 }],
    fastRegroupProgress: 1,
    settleRegroupProgress: 0,
  });

  assert.ok(layout);
  assert.equal(layout!.dockedPosition.y - layout!.height, 56);
});

test('prompt-group recycle keeps full-size child cards from overlapping each other while docked', () => {
  const layout = buildDockedPromptChildRegroupLayout({
    basePosition: { x: 0, y: 0 },
    items: [
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
    ],
    regroupStartPositions: [
      { x: -154, y: 400 },
      { x: 154, y: 400 },
      { x: 0, y: 748 },
    ],
    fastRegroupProgress: 1,
    settleRegroupProgress: 0,
  });

  assert.equal(layout.length, 3);

  for (let index = 0; index < layout.length; index += 1) {
    const current = layout[index]!;
    const currentLeft = current.dockedPosition.x - (current.width / 2);
    const currentRight = current.dockedPosition.x + (current.width / 2);
    const currentTop = current.dockedPosition.y - current.height;
    const currentBottom = current.dockedPosition.y;

    for (let nextIndex = index + 1; nextIndex < layout.length; nextIndex += 1) {
      const next = layout[nextIndex]!;
      const nextLeft = next.dockedPosition.x - (next.width / 2);
      const nextRight = next.dockedPosition.x + (next.width / 2);
      const nextTop = next.dockedPosition.y - next.height;
      const nextBottom = next.dockedPosition.y;
      const horizontalOverlap = Math.min(currentRight, nextRight) - Math.max(currentLeft, nextLeft);
      const verticalOverlap = Math.min(currentBottom, nextBottom) - Math.max(currentTop, nextTop);

      assert.ok(
        horizontalOverlap <= 0 || verticalOverlap <= 0,
        `expected docked cards ${current.index} and ${next.index} not to overlap, got horizontal=${horizontalOverlap}, vertical=${verticalOverlap}`,
      );
    }
  }
});

test('prompt-group connector svg uses stable group bounds during regroup rendering', () => {
  const layoutSource = readSource('src/app/promptGroupRenderLayout.ts');

  assert.match(layoutSource, /const connectorBounds = \{\s*minX: groupView\.bounds\.x,/);
  assert.match(layoutSource, /maxX: groupView\.bounds\.x \+ groupView\.bounds\.width,/);
  assert.match(layoutSource, /minY: groupView\.bounds\.y,/);
  assert.match(layoutSource, /maxY: groupView\.bounds\.y \+ groupView\.bounds\.height,/);
});

test('prompt-group settle phase keeps animating after drop instead of snapping to the final layout', () => {
  const appSource = readSource('src/App.tsx');
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');

  assert.match(promptGroupLayoutSource, /if \(state\.layoutMode === 'docked' && state\.settleUntil !== null\) \{/);
  assert.match(promptGroupLayoutSource, /const settleDuration = Math\.max\(1, state\.settleUntil - state\.startedAt\);/);
  assert.match(promptGroupLayoutSource, /regroupProgress: nextProgress,/);
  assert.match(promptGroupLayoutSource, /layoutMode: 'docked',\s*regroupProgress: 0,/);
  assert.match(promptGroupLayoutSource, /const fastRegroupProgress = layoutState\.layoutMode === 'docked'\s*\?\s*0/);
  assert.match(promptGroupLayoutSource, /const settleRegroupProgress = layoutState\.layoutMode === 'docked'\s*\?\s*layoutState\.regroupProgress/);
  assert.match(appSource, /settlePromptGroupRegroup\(promptNode\.id\)/);
});

test('prompt-group and follow-up connectors opt into stable svg rendering flags', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /<svg[\s\S]*shapeRendering="geometricPrecision"/);
  assert.match(appSource, /strokeDasharray=\{groupConnectorDash\}[\s\S]*vectorEffect="non-scaling-stroke"/);
  assert.match(appSource, /strokeDasharray=\{connectorStrokeDasharray\}[\s\S]*vectorEffect="non-scaling-stroke"/);
  assert.match(appSource, /strokeDasharray=\{`\$\{activeDragDashA\} \$\{activeDragDashB\}`\}[\s\S]*vectorEffect="non-scaling-stroke"/);
});

test('explicit regroup target slots keep recycle assignments stable even if live positions jitter', () => {
  const baseInput = {
    basePosition: { x: 0, y: 0 },
    items: [
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
    ],
    fastRegroupProgress: 1,
    settleRegroupProgress: 0,
    targetSlotIndices: [0, 2, 1],
  } as const;

  const firstPass = buildDockedPromptChildRegroupLayout({
    ...baseInput,
    regroupStartPositions: [
      { x: -154, y: 400 },
      { x: 154, y: 400 },
      { x: 0, y: 748 },
    ],
  } as never);
  const secondPass = buildDockedPromptChildRegroupLayout({
    ...baseInput,
    regroupStartPositions: [
      { x: -146, y: 404 },
      { x: 166, y: 396 },
      { x: 12, y: 736 },
    ],
  } as never);

  assert.deepEqual(
    firstPass.map((item) => item.dockedPosition.x),
    secondPass.map((item) => item.dockedPosition.x),
  );
});

test('recycle motion can have layered speed while still converging to one final layout', () => {
  const layout = buildDockedPromptChildRegroupLayout({
    basePosition: { x: 0, y: 0 },
    items: [
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
      { aspectRatio: '1:1' as never },
    ],
    regroupStartPositions: [
      { x: -154, y: 400 },
      { x: 154, y: 400 },
      { x: 0, y: 748 },
    ],
    targetSlotIndices: [0, 2, 1],
    fastRegroupProgress: 0.5,
    settleRegroupProgress: 0,
  });

  const nearCard = layout[0]!;
  const farCard = layout[2]!;

  const nearRemainingRatio = Math.hypot(
    nearCard.position.x - nearCard.dockedPosition.x,
    nearCard.position.y - nearCard.dockedPosition.y,
  ) / Math.hypot(
    -154 - nearCard.dockedPosition.x,
    400 - nearCard.dockedPosition.y,
  );
  const farRemainingRatio = Math.hypot(
    farCard.position.x - farCard.dockedPosition.x,
    farCard.position.y - farCard.dockedPosition.y,
  ) / Math.hypot(
    0 - farCard.dockedPosition.x,
    748 - farCard.dockedPosition.y,
  );

  assert.ok(farRemainingRatio < nearRemainingRatio);
});

test('App locks regroup slot assignment when recycle starts', () => {
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');
  const dragHookSource = readSource('src/app/usePromptGroupDragHandlers.ts');

  assert.match(promptGroupLayoutSource, /targetSlotIndicesByChildId/);
  assert.match(promptGroupLayoutSource, /targetSlotIndices:\s*childImages\.map\(\(imageNode\) => layoutState\.targetSlotIndicesByChildId\[imageNode\.id\]/);
  assert.match(dragHookSource, /beginPromptGroupRegroup\(node\.id,\s*childImages\)/);
});

test('App does not recreate regroup presentation state on every drag frame when slot targets stay the same', () => {
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');

  assert.match(promptGroupLayoutSource, /const hasSameTargetSlots = Boolean\(existing\?\.targetSlotIndicesByChildId\)/);
  assert.match(promptGroupLayoutSource, /existing\.layoutMode === 'regrouping'/);
  assert.match(promptGroupLayoutSource, /hasSameTargetSlots/);
  assert.match(promptGroupLayoutSource, /return prev;/);
});

test('usePromptGroupLayout owns prompt-group presentation state mutations', () => {
  const appSource = readSource('src/App.tsx');
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');

  assert.match(promptGroupLayoutSource, /const syncPromptGroupLayoutState = useCallback/);
  assert.match(promptGroupLayoutSource, /const schedulePromptGroupRegroupAnimation = useCallback/);
  assert.match(promptGroupLayoutSource, /const beginPromptGroupRegroup = useCallback/);
  assert.match(promptGroupLayoutSource, /const settlePromptGroupRegroup = useCallback/);
  assert.match(promptGroupLayoutSource, /const clearPromptGroupRegroup = useCallback/);
  assert.doesNotMatch(appSource, /const syncPromptGroupLayoutState = useCallback/);
  assert.doesNotMatch(appSource, /const schedulePromptGroupRegroupAnimation = useCallback/);
  assert.doesNotMatch(appSource, /const beginPromptGroupRegroup = useCallback/);
  assert.doesNotMatch(appSource, /const settlePromptGroupRegroup = useCallback/);
  assert.doesNotMatch(appSource, /const clearPromptGroupRegroup = useCallback/);
});

test('App snaps regrouping child render positions to dock slots while the main card is actively dragged', () => {
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');
  const layoutSource = readSource('src/app/promptGroupRenderLayout.ts');

  assert.match(promptGroupLayoutSource, /const renderPosition = !layout/);
  assert.match(promptGroupLayoutSource, /:\s*layout\.position;/);
  assert.match(layoutSource, /visualPosition:\s*regroupLayout\?\.renderPosition \?\? livePosition/);
  assert.match(layoutSource, /settledPosition:\s*regroupLayout\?\.settledPosition \?\? livePosition/);
});

test('App keeps child live positions owned by regroup layout during single main-card drag', () => {
  const dragHookSource = readSource('src/app/usePromptGroupDragHandlers.ts');

  assert.match(dragHookSource, /if \(shouldRegroup\) \{/);
  assert.match(dragHookSource, /applyLiveNodeDeltaToDraggedSet\(sourceNodeId, \[sourceNodeId\], delta\);/);
});

test('App upgrades live-scene sync to immediate mode while prompt-group regroup drag is active', () => {
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');

  assert.match(promptGroupLayoutSource, /const hasActivePromptGroupDragPresentation = isNodeDragActive/);
  assert.match(promptGroupLayoutSource, /Object\.values\(promptGroupLayoutStateByIdRef\.current\)\.some/);
  assert.match(promptGroupLayoutSource, /if \(hasActivePromptGroupDragPresentation\) \{/);
  assert.match(promptGroupLayoutSource, /setLiveNodePositionVersion\(\(prev\) => prev \+ 1\)/);
});

test('App freezes overlap-map recomputation while node drag is active', () => {
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');

  assert.match(promptGroupLayoutSource, /if \(isNodeDragActive\) \{\s*return currentGroupOverlapMap;/);
});

test('App skips prompt-layout auto-repair while node drag is active', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /useEffect\(\(\) => \{\s*if \(!activeCanvas \|\| isNodeDragActive\) return;/);
});

test('App resolves live prompt/image positions from the ref-backed live scene snapshot', () => {
  const hookSource = readSource('src/app/useConnectorRenderer.ts');

  assert.match(hookSource, /resolveLiveSceneNodePosition\(\s*liveSceneRef\.current,/);
});

test('App reuses the last stable visible-canvas scene while node drag is active', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const stableVisibleCanvasSceneRef = useRef/);
  assert.match(appSource, /if \(isNodeDragActive\) \{\s*return stableVisibleCanvasSceneRef\.current;/);
  assert.match(appSource, /stableVisibleCanvasSceneRef\.current = \{\s*visiblePromptNodes,/);
});

test('App reuses the last stable prompt-group bounds and views while node drag is active', () => {
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');

  assert.match(promptGroupLayoutSource, /const stablePromptGroupBoundsByIdRef = useRef\(new Map<string/);
  assert.match(promptGroupLayoutSource, /if \(isNodeDragActive && stablePromptGroupBoundsByIdRef\.current\.size > 0\) \{\s*return stablePromptGroupBoundsByIdRef\.current;/);
  assert.match(promptGroupLayoutSource, /stablePromptGroupBoundsByIdRef\.current = boundsMap;/);
  assert.match(promptGroupLayoutSource, /const stablePromptGroupViewsRef = useRef<PromptGroupView\[]>\(\[]\);/);
  assert.match(promptGroupLayoutSource, /if \(isNodeDragActive && stablePromptGroupViewsRef\.current\.length > 0\) \{\s*return stablePromptGroupViewsRef\.current;/);
  assert.match(promptGroupLayoutSource, /stablePromptGroupViewsRef\.current = nextPromptGroupViews;/);
});

test('App only builds prompt-group regroup layouts for groups with active presentation state', () => {
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');
  const regroupMemoStart = promptGroupLayoutSource.indexOf('const promptGroupRegroupLayoutsById = useMemo(() => {');
  const regroupMemoEnd = promptGroupLayoutSource.indexOf('const promptGroupBoundsById = useMemo(() => {');

  assert.notEqual(regroupMemoStart, -1);
  assert.notEqual(regroupMemoEnd, -1);

  const regroupMemoSource = promptGroupLayoutSource.slice(regroupMemoStart, regroupMemoEnd);

  assert.match(regroupMemoSource, /const promptGroupLayoutEntries = Object\.entries\(promptGroupLayoutStateByIdRef\.current\);/);
  assert.match(regroupMemoSource, /if \(promptGroupLayoutEntries\.length === 0\) \{\s*return regroupLayoutMap;\s*\}/);
  assert.match(regroupMemoSource, /promptGroupLayoutEntries\.forEach\(\(\[promptNodeId, layoutState\]\) => \{/);
  assert.match(regroupMemoSource, /const promptNode = currentPromptNodesById\.get\(promptNodeId\);/);
  assert.doesNotMatch(regroupMemoSource, /activeCanvas\.promptNodes\.forEach/);
  assert.match(regroupMemoSource, /buildPromptGroupRegroupLayouts\(\s*promptNode,\s*childImages,\s*promptPosition,\s*layoutState,/s);
});
