import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas connection ports stay outside cards and keep a forgiving hit area', () => {
  const source = readSource('apps/web/src/components/canvas/CanvasConnectionLayer.tsx');

  assert.match(source, /const PORT_OFFSET = 10/);
  assert.match(source, /bounds\.top - PORT_OFFSET/);
  assert.match(source, /bounds\.bottom \+ PORT_OFFSET/);
  assert.match(source, /bounds\.left - PORT_OFFSET/);
  assert.match(source, /bounds\.right \+ PORT_OFFSET/);
  assert.match(source, /r=\{10\}[\s\S]*data-connection-target="true"/);
  assert.match(source, /r=\{isTarget \? 4 : 3\}/);
  assert.match(source, /opacity: isTarget \? 0\.9 : 0\.28/);
});
