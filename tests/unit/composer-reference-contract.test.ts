import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  adaptLegacyReferenceImages,
  assignVideoReferenceRoles,
  reorderComposerReferences,
} from '../../packages/shared/src/index.ts';

test('legacy reference images become stable ordered media references', () => {
  const references = adaptLegacyReferenceImages([
    { id: 'image-b', storageId: 'asset-b', mimeType: 'image/png' },
    { id: 'image-a', storageId: 'asset-a', mimeType: 'image/jpeg' },
  ]);

  assert.deepEqual(references.map((reference) => [reference.id, reference.assetId, reference.order]), [
    ['image-b', 'asset-b', 0],
    ['image-a', 'asset-a', 1],
  ]);
});

test('video frame roles follow visual order after reordering', () => {
  const references = assignVideoReferenceRoles(
    reorderComposerReferences(
      adaptLegacyReferenceImages([
        { id: 'first', storageId: 'asset-first', mimeType: 'image/png' },
        { id: 'last', storageId: 'asset-last', mimeType: 'image/png' },
      ]),
      'last',
      0,
    ),
    'first-last-frame',
  );

  assert.deepEqual(references.map((reference) => [reference.id, reference.role]), [
    ['last', 'first-frame'],
    ['first', 'last-frame'],
  ]);
});
