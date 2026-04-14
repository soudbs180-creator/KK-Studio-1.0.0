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
  }).sort((left, right) => left.dockedPosition.x - right.dockedPosition.x);

  assert.equal(layout.length, 3);

  for (let index = 0; index < layout.length - 1; index += 1) {
    const current = layout[index]!;
    const next = layout[index + 1]!;
    const horizontalGap = (next.dockedPosition.x - (next.width / 2))
      - (current.dockedPosition.x + (current.width / 2));

    assert.ok(
      horizontalGap >= 24,
      `expected docked cards ${current.index} and ${next.index} to keep at least 24px gap, got ${horizontalGap}`,
    );
  }
});

test('prompt-group connector svg uses stable group bounds during regroup rendering', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const connectorBounds = \{\s*minX: groupView\.bounds\.x,/);
  assert.match(appSource, /maxX: groupView\.bounds\.x \+ groupView\.bounds\.width,/);
  assert.match(appSource, /minY: groupView\.bounds\.y,/);
  assert.match(appSource, /maxY: groupView\.bounds\.y \+ groupView\.bounds\.height,/);
});

test('prompt-group settle phase keeps animating after drop instead of snapping to the final layout', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /if \(state\.layoutMode === 'docked' && state\.settleUntil !== null\) \{/);
  assert.match(appSource, /const settleDuration = Math\.max\(1, state\.settleUntil - state\.startedAt\);/);
  assert.match(appSource, /regroupProgress: nextProgress,/);
  assert.match(appSource, /layoutMode: 'docked',\s*regroupProgress: 0,/);
  assert.match(appSource, /const fastRegroupProgress = layoutState\.layoutMode === 'docked'\s*\?\s*0/);
  assert.match(appSource, /const settleRegroupProgress = layoutState\.layoutMode === 'docked'\s*\?\s*layoutState\.regroupProgress/);
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
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /targetSlotIndicesByChildId/);
  assert.match(appSource, /beginPromptGroupRegroup\(node\.id,\s*groupView\.childImages\)/);
  assert.match(appSource, /targetSlotIndices:\s*childImages\.map\(\(imageNode\) => layoutState\.targetSlotIndicesByChildId\[imageNode\.id\]/);
});

test('App does not recreate regroup presentation state on every drag frame when slot targets stay the same', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const hasSameTargetSlots = Boolean\(existing\?\.targetSlotIndicesByChildId\)/);
  assert.match(appSource, /existing\.layoutMode === 'regrouping'/);
  assert.match(appSource, /hasSameTargetSlots/);
  assert.match(appSource, /return prev;/);
});

test('App snaps regrouping child render positions to dock slots while the main card is actively dragged', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const renderPosition = !layout/);
  assert.match(appSource, /isNodeDragActive && layoutState\.layoutMode === 'regrouping'/);
  assert.match(appSource, /\?\s*layout\.dockedPosition/);
  assert.match(appSource, /:\s*layout\.position/);
});

test('App keeps child live positions owned by regroup layout during single main-card drag', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /else if \(shouldRegroup\) \{/);
  assert.match(appSource, /applyLiveNodeDeltaToDraggedSet\(sourceNodeId, \[sourceNodeId\], delta\)/);
});

test('App upgrades live-scene sync to immediate mode while prompt-group regroup drag is active', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const hasActivePromptGroupDragPresentation = isNodeDragActive/);
  assert.match(appSource, /Object\.values\(promptGroupLayoutStateByIdRef\.current\)\.some/);
  assert.match(appSource, /if \(hasActivePromptGroupDragPresentation\) \{/);
  assert.match(appSource, /setLiveNodePositionVersion\(\(prev\) => prev \+ 1\)/);
});

test('App freezes overlap-map recomputation while node drag is active', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /if \(isNodeDragActive\) \{\s*return groupOverlapMap;/);
});

test('App skips prompt-layout auto-repair while node drag is active', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /useEffect\(\(\) => \{\s*if \(!activeCanvas \|\| isNodeDragActive\) return;/);
});

test('App resolves live prompt/image positions from the ref-backed live scene snapshot', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /resolveLiveSceneNodePosition\(\s*liveSceneRef\.current,/);
});

test('App reuses the last stable visible-canvas scene while node drag is active', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const stableVisibleCanvasSceneRef = useRef/);
  assert.match(appSource, /if \(isNodeDragActive\) \{\s*return stableVisibleCanvasSceneRef\.current;/);
  assert.match(appSource, /stableVisibleCanvasSceneRef\.current = \{\s*visiblePromptNodes,/);
});

test('App reuses the last stable prompt-group bounds and views while node drag is active', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const stablePromptGroupBoundsByIdRef = useRef\(new Map<string/);
  assert.match(appSource, /if \(isNodeDragActive && stablePromptGroupBoundsByIdRef\.current\.size > 0\) \{\s*return stablePromptGroupBoundsByIdRef\.current;/);
  assert.match(appSource, /stablePromptGroupBoundsByIdRef\.current = boundsMap;/);
  assert.match(appSource, /const stablePromptGroupViewsRef = useRef<PromptGroupView\[]>\(\[]\);/);
  assert.match(appSource, /if \(isNodeDragActive && stablePromptGroupViewsRef\.current\.length > 0\) \{\s*return stablePromptGroupViewsRef\.current;/);
  assert.match(appSource, /stablePromptGroupViewsRef\.current = nextPromptGroupViews;/);
});

test('App only builds prompt-group regroup layouts for groups with active presentation state', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /const layoutState = promptGroupLayoutStateByIdRef\.current\[promptNode\.id\];/);
  assert.match(appSource, /if \(!layoutState\) \{\s*return;/);
  assert.match(appSource, /buildPromptGroupRegroupLayouts\(\s*promptNode,\s*childImages,\s*promptPosition,\s*layoutState,/s);
});
