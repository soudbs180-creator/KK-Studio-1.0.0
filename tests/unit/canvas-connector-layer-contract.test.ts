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
