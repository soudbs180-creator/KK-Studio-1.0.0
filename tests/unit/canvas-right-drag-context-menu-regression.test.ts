import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('right-drag selection consumes the trailing native context menu event', () => {
  const source = readSource('apps/web/src/app/useCanvasSelectionBox.ts');
  const utilityCardSource = readSource('apps/web/src/workflow/nodes/WorkflowUtilityCard.tsx');
  const menuBoundsSource = source.match(/const resolveSelectionMenuPosition[\s\S]*?const handleSelectionMouseDown/)?.[0] ?? '';

  assert.match(source, /function useRightDragContextMenuSuppression/);
  assert.match(source, /window\.addEventListener\('contextmenu', handleContextMenu, true\)/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /const isSelectionDrag = width > 5 \|\| height > 5;/);
  assert.match(source, /if \(event\.button === 2 && isSelectionDrag\) \{\s*suppressNextContextMenu\(\);/);
  assert.match(menuBoundsSource, /activeCanvas\.workflow\?\.nodes/);
  assert.match(menuBoundsSource, /if \(!isWorkflowUtilityNodeKind\(node\.kind\)\) return;/);
  assert.match(menuBoundsSource, /const width = node\.width \|\| 284;/);
  assert.match(source, /BACKGROUND_BLOCKING_SELECTOR = '[^']*\[data-workflow-node-id\][^']*'/);
  assert.match(utilityCardSource, /data-workflow-node-id=\{node\.id\}/);
  assert.match(utilityCardSource, /data-card-id=\{node\.id\}/);
});

test('notebook cards participate in selection bounds and selection-menu deletion', () => {
  const selectionSource = readSource('apps/web/src/app/useCanvasSelectionBox.ts');
  const menuSource = readSource('apps/web/src/app/useSelectionMenuOverlay.ts');
  const overlaySource = readSource('apps/web/src/app/AppCanvasOverlays.tsx');

  assert.match(selectionSource, /\[data-card-id\]/);
  assert.match(selectionSource, /\(activeCanvas\.noteNodes \|\| \[\]\)/);
  assert.match(menuSource, /deleteNoteNode: \(nodeId: string\) => void/);
  assert.match(menuSource, /const notes = \(activeCanvas\.noteNodes \|\| \[\]\)/);
  assert.match(menuSource, /notes\.forEach\(\(node\) => deleteNoteNode\(node\.id\)\)/);
  assert.match(overlaySource, /noteCount=\{selectionMenu\.noteCount\}/);
});
