import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { CanvasGroup } from '../../apps/web/src/types.ts';

const ROOT_DIR = process.cwd();

type CollapsedCanvasGroupsModule = {
  getCollapsedCanvasGroupNodeIds: (groups: readonly CanvasGroup[] | null | undefined) => Set<string>;
};



async function loadCollapsedCanvasGroupsModule(): Promise<CollapsedCanvasGroupsModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/app/collapsedCanvasGroups.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/app/collapsedCanvasGroups.ts must exist');
  return await import('../../apps/web/src/app/collapsedCanvasGroups.ts') as CollapsedCanvasGroupsModule;
}

test('CanvasGroup persists collapsed state for lightweight manual groups', () => {
  const typesSource = readSource('apps/web/src/types.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-collapsed-groups-contract\.test\.ts/);
  assert.match(typesSource, /color\?: string; \/\/ Group glow color/);
  assert.match(typesSource, /hidden\?: boolean;/);
  assert.match(typesSource, /collapsed\?: boolean;/);
});

test('collapsed canvas group helper returns only node ids from collapsed groups', async () => {
  const { getCollapsedCanvasGroupNodeIds } = await loadCollapsedCanvasGroupsModule();
  const groups = [
    {
      id: 'expanded-group',
      nodeIds: ['prompt-visible', 'image-visible'],
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      type: 'custom',
    },
    {
      id: 'collapsed-group',
      nodeIds: ['prompt-hidden', 'image-hidden'],
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      collapsed: true,
      type: 'custom',
    },
    {
      id: 'blurred-group',
      nodeIds: ['prompt-blurred', 'image-blurred'],
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      hidden: true,
      type: 'custom',
    },
  ] as CanvasGroup[];

  assert.deepEqual(
    [...getCollapsedCanvasGroupNodeIds(groups)].sort(),
    ['image-hidden', 'prompt-hidden'],
  );
});

test('manual selection grouping stores the default white group glow', () => {
  const source = readSource('apps/web/src/app/useSelectionMenuOverlay.ts');

  assert.match(source, /const group: CanvasGroup = \{/);
  assert.match(source, /color: '#ffffff',/);
});

test('App excludes collapsed manual group members from render queues and image prefetch scheduling', () => {
  const source = readSource('apps/web/src/App.tsx');
  const imageSchedulingHelperSource = readSource('apps/web/src/canvas/largeCanvasVirtualization.ts');
  const viewportMemoStart = source.indexOf('export function useVisibleCanvasItems');
  const sharedPropsStart = source.indexOf('const getSharedImageNodeProps = useCallback');
  const imageSchedulingStart = source.indexOf('const imageLoadSchedulingById = React.useMemo');
  const imagePrefetchStart = source.indexOf('useEffect(() => {', imageSchedulingStart);
  const canvasItemsStart = source.indexOf('const canvasRenderItems = React.useMemo');
  const renderedGroupsStart = source.indexOf('const renderedVisibleGroups = React.useMemo');
  const infiniteCanvasStart = source.indexOf('<InfiniteCanvas');
  const canvasClickStart = source.indexOf('onCanvasClick={', infiniteCanvasStart);
  const followUpConnectorStart = source.indexOf('{connectorRenderPromptNodes.map(pn => {');
  const pendingConnectorStart = source.indexOf('{activeSourceImage && (() => {');
  const workflowConnectorStart = source.indexOf('{(activeCanvas?.workflow?.edges || []).map((edge) => {');

  assert.match(source, /import \{ getCollapsedCanvasGroupNodeIds \} from '\.\/app\/collapsedCanvasGroups';/);
  assert.match(source, /const collapsedCanvasGroupNodeIds = React\.useMemo/);
  assert.match(source, /const syncedStack = group\.hidden && Number\.isFinite\(highestMemberStack\)/);

  assert.notEqual(viewportMemoStart, -1);
  assert.notEqual(sharedPropsStart, -1);
  const viewportMemoEnd = viewportMemoStart > sharedPropsStart ? source.length : sharedPropsStart;
  const viewportMemoSource = source.slice(viewportMemoStart, viewportMemoEnd);
  assert.match(viewportMemoSource, /const resolvedGroupBounds = getComputedGroupBounds\(g\) \|\| g\.bounds;/);
  assert.match(viewportMemoSource, /const groupViewportBounds = g\.collapsed\s*\?\s*\{\s*x: resolvedGroupBounds\.x,\s*y: resolvedGroupBounds\.y,\s*width: Math\.max\(180, Math\.min\(320, resolvedGroupBounds\.width\)\),\s*height: 44,\s*\}\s*: resolvedGroupBounds;/);
  assert.match(viewportMemoSource, /if \(collapsedCanvasGroupNodeIds\.has\(n\.id\)\) \{\s*return false;\s*\}/);
  assert.match(viewportMemoSource, /if \(collapsedCanvasGroupNodeIds\.has\(node\.id\)\) \{\s*return false;\s*\}/);

  assert.notEqual(imageSchedulingStart, -1);
  assert.notEqual(imagePrefetchStart, -1);
  const imageSchedulingSource = source.slice(imageSchedulingStart, imagePrefetchStart);
  assert.match(imageSchedulingSource, /buildViewportImageLoadScheduling\(\{[\s\S]*collapsedCanvasGroupNodeIds/);
  assert.match(imageSchedulingHelperSource, /if \(collapsedCanvasGroupNodeIds\.has\(node\.id\)\) \{\s*return;\s*\}/);

  assert.notEqual(canvasItemsStart, -1);
  assert.notEqual(renderedGroupsStart, -1);
  const canvasItemsSource = source.slice(canvasItemsStart, renderedGroupsStart);
  assert.match(canvasItemsSource, /visiblePromptGroupViews\s*\.filter\(\(groupView\) => !collapsedCanvasGroupNodeIds\.has\(groupView\.rootPrompt\.id\)\)/);
  assert.match(canvasItemsSource, /const visibleChildImages = groupView\.childImages\.filter\(\(imageNode\) => !collapsedCanvasGroupNodeIds\.has\(imageNode\.id\)\);/);
  assert.match(canvasItemsSource, /childImages: visibleChildImages,/);
  assert.match(canvasItemsSource, /childNodes: visibleChildImages,/);
  assert.match(canvasItemsSource, /visibleWorkflowUtilityNodes\.filter\(\(node\) => !collapsedCanvasGroupNodeIds\.has\(node\.id\)\)/);

  assert.notEqual(infiniteCanvasStart, -1);
  assert.notEqual(canvasClickStart, -1);
  const infiniteCanvasSource = source.slice(infiniteCanvasStart, canvasClickStart);
  assert.match(infiniteCanvasSource, /id="canvas-container"/);

  assert.notEqual(followUpConnectorStart, -1);
  assert.notEqual(pendingConnectorStart, -1);
  assert.notEqual(workflowConnectorStart, -1);
  const followUpConnectorSource = source.slice(followUpConnectorStart, pendingConnectorStart);
  const pendingConnectorSource = source.slice(pendingConnectorStart, workflowConnectorStart);
  const workflowConnectorSource = source.slice(workflowConnectorStart, workflowConnectorStart + 1000);
  assert.match(followUpConnectorSource, /if \(collapsedCanvasGroupNodeIds\.has\(pn\.sourceImageId\)\) return null;/);
  assert.match(pendingConnectorSource, /if \(collapsedCanvasGroupNodeIds\.has\(activeSourceImage\)\) return null;/);
  assert.match(workflowConnectorSource, /if \(collapsedCanvasGroupNodeIds\.has\(edge\.from\) \|\| collapsedCanvasGroupNodeIds\.has\(edge\.to\)\) return null;/);
});

test('CanvasGroupComponent exposes hide and compact expand controls for collapsed groups', () => {
  const source = readSource('apps/web/src/components/canvas/CanvasGroupComponent.tsx');

  assert.match(source, /import \{[^}]*Eye[^}]*EyeOff[^}]*Archive[^}]*Maximize2[^}]*Check[^}]*\} from 'lucide-react';/);
  assert.match(source, /const GROUP_BORDER_COLOR_SWATCHES = \[/);
  assert.match(source, /const isCollapsed = Boolean\(group\.collapsed\);/);
  assert.match(source, /const isHidden = Boolean\(group\.hidden\);/);
  assert.match(source, /const groupBorderColor = group\.color \|\| '#ffffff';/);
  assert.match(source, /boxShadow: \[[\s\S]*'var\(--frost-card-framework-shadow\)'[\s\S]*groupBorderColor/);
  assert.match(source, /borderColor: highlighted[\s\S]*'var\(--frost-card-framework-border\)'/);
  assert.match(source, /const hiddenLabelFontSize = Math\.max/);
  assert.match(source, /title=\{hiddenDisplayLabel\}/);
  assert.match(source, /const handleToggleCollapsed = useCallback\(/);
  assert.match(source, /onUpdateGroup\?\.\(\{ \.\.\.group, collapsed: !group\.collapsed \}\);/);
  assert.match(source, /const handleToggleHidden = useCallback\(/);
  assert.match(source, /onUpdateGroup\?\.\(\{ \.\.\.group, hidden: !group\.hidden \}\);/);
  assert.match(source, /const handleUpdateColor = useCallback\(/);
  assert.match(source, /onUpdateGroup\?\.\(\{ \.\.\.group, color \}\);/);
  assert.match(source, /canvas-group-collapsed-card/);
  assert.match(source, /const defaultGroupLabel = '.{2}';/);
  assert.match(source, /const hiddenToggleLabel = isHidden \? '[^']+' : '[^']+';/);
  assert.match(source, /const collapsedToggleLabel = isCollapsed \? '[^']+' : '[^']+';/);
  assert.match(source, /aria-label=\{collapsedToggleLabel\}/);
  assert.match(source, /<Maximize2 size=\{14\} \/>/);
  assert.match(source, /<Archive size=\{14\} \/>/);
  assert.match(source, /setIsEditing\(true\)/);
  assert.match(source, /GROUP_BORDER_COLOR_SWATCHES\.map/);
  assert.match(source, /type="color"/);
  assert.match(source, /onUngroup\(group\.id\)/);
  assert.doesNotMatch(source, /Settings|SlidersHorizontal/);
  assert.doesNotMatch(source, /Expand group|Hide group|>\s*Group\s*</);
});

test('manual canvas group drag applies live positions before committing node positions', () => {
  const source = readSource('apps/web/src/App.tsx');
  const renderedGroupsStart = source.indexOf('const renderedVisibleGroups = React.useMemo');
  const renderedItemsStart = source.indexOf('const renderedCanvasItems = React.useMemo');

  assert.match(source, /const applyLiveCanvasGroupNodeDelta = useCallback/);
  assert.match(source, /applyLiveNodeDeltaToDraggedSet\(`canvas-group:\$\{groupId\}`, nodeIds, delta\);/);
  assert.match(source, /const clearLiveCanvasGroupNodePositions = useCallback/);
  assert.notEqual(renderedGroupsStart, -1);
  assert.notEqual(renderedItemsStart, -1);
  const renderedGroupsSource = source.slice(renderedGroupsStart, renderedItemsStart);
  assert.match(renderedGroupsSource, /applyLiveCanvasGroupNodeDelta\(group\.id, nodeIds, delta\);/);
  assert.match(renderedGroupsSource, /moveSelectedNodesImmediate\(delta, nodeIds, \{ snapToGrid \}\);/);
  assert.match(renderedGroupsSource, /clearLiveCanvasGroupNodePositions\(group\.id, group\.nodeIds\);/);
});
