import assert from 'node:assert/strict';
import test from 'node:test';

import { GenerationMode, type ReferenceImage } from '../../apps/web/src/types.ts';
import {
  applyComposerReferenceRoles,
  reorderComposerReferenceImages,
  sortContextReferences,
} from '../../apps/web/src/components/layout/prompt-bar/composerReferenceState.ts';

const references: ReferenceImage[] = [
  { id: 'a', storageId: 'asset-a', data: 'a', mimeType: 'image/png' },
  { id: 'b', storageId: 'asset-b', data: 'b', mimeType: 'image/png' },
];

test('video frame roles follow the visible order', () => {
  const assigned = applyComposerReferenceRoles(references, GenerationMode.VIDEO, 'first-last-frame');
  assert.deepEqual(assigned.map((reference) => reference.role), ['first-frame', 'last-frame']);

  const reordered = reorderComposerReferenceImages(
    assigned,
    'b',
    0,
    GenerationMode.VIDEO,
    'first-last-frame',
  );
  assert.deepEqual(reordered.map((reference) => [reference.id, reference.role]), [
    ['b', 'first-frame'],
    ['a', 'last-frame'],
  ]);
});

test('non-video references stay generic and context manifests use explicit order', () => {
  assert.deepEqual(
    applyComposerReferenceRoles(references, GenerationMode.IMAGE, 'first-last-frame')
      .map((reference) => reference.role),
    ['reference', 'reference'],
  );
  assert.deepEqual(sortContextReferences([
    { id: 'mcp', kind: 'mcp', manifestId: 'mcp-1', label: 'MCP', order: 2, permissionScopes: [] },
    { id: 'skill', kind: 'skill', manifestId: 'skill-1', label: 'Skill', order: 1, permissionScopes: [] },
  ]).map((reference) => reference.id), ['skill', 'mcp']);
});
