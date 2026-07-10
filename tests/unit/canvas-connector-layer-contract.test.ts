import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('workspace connector layer uses a small overflow-visible svg instead of a huge offset layout box', () => {
  const source = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');
  const connectorLayerStart = source.indexOf('shapeRendering="geometricPrecision"');
  const connectorLayerEnd = source.indexOf('{renderedVisibleGroups}', connectorLayerStart);
  assert.ok(connectorLayerStart >= 0 && connectorLayerEnd > connectorLayerStart, 'connector layer should be discoverable');

  const connectorLayer = source.slice(connectorLayerStart, connectorLayerEnd);

  assert.match(connectorLayer, /width:\s*'1px'/);
  assert.match(connectorLayer, /height:\s*'1px'/);
  assert.match(connectorLayer, /overflow:\s*'visible'/);
  assert.doesNotMatch(connectorLayer, /width:\s*'10000px'/);
  assert.doesNotMatch(connectorLayer, /height:\s*'10000px'/);
  assert.doesNotMatch(connectorLayer, /left:\s*'-5000px'/);
  assert.doesNotMatch(connectorLayer, /top:\s*'-5000px'/);
  assert.doesNotMatch(connectorLayer, /\+\s*5000/);
});

test('prompt groups route connectors from the selected horizontal or vertical card edges', () => {
  const geometry = readSource('apps/web/src/canvas/connectorGeometry.ts');
  const layout = readSource('apps/web/src/app/promptGroupRenderLayout.ts');
  const workspace = readSource('apps/web/src/pages/Workspace/WorkspacePage.tsx');

  assert.match(geometry, /export function buildDockedHorizontalConnectorPath/);
  assert.match(layout, /layoutMode: 'grid' \| 'row' \| 'column'/);
  assert.match(layout, /layoutMode === 'row'/);
  assert.match(layout, /buildDockedHorizontalConnectorPath/);
  assert.match(layout, /getPromptNodeBoundsWidth\(node, false\)/);
  assert.match(workspace, /subCardLayoutMode: state\.subCardLayoutMode/);
});
