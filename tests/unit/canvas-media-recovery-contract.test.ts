import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { LocalMediaCacheEntry } from '../../apps/web/src/context/canvasMediaRecovery.ts';

const ROOT_DIR = process.cwd();



test('canvas media recovery boundary lives outside CanvasContext', () => {
  const contextSource = readSource('apps/web/src/context/CanvasContext.tsx');
  const helperSource = readSource('apps/web/src/context/canvasMediaRecovery.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/canvas-media-recovery-contract\.test\.ts/);
  assert.match(contextSource, /from '\.\/canvasMediaRecovery';/);
  assert.match(helperSource, /export const hydrateRecoveredMediaCacheEntry/);
  assert.match(helperSource, /export const resolveOriginalPersistSourceForDisk/);
  assert.doesNotMatch(contextSource, /const hydrateRecoveredMediaCacheEntry =/);
  assert.doesNotMatch(contextSource, /const resolveOriginalPersistSourceForDisk =/);
});

test('media recovery exports typed cache entries and prefers stable explicit originals', () => {
  const cacheEntry: LocalMediaCacheEntry = {
    url: 'data:image/png;base64,preview',
    originalUrl: 'https://cdn.example.com/original.png',
    filename: 'image.png',
  };
  const helperSource = readSource('apps/web/src/context/canvasMediaRecovery.ts');

  assert.equal(cacheEntry.originalUrl, 'https://cdn.example.com/original.png');
  assert.match(helperSource, /const explicitOriginal = normalizeMediaCacheSource\(image\.originalUrl\)\s*\|\|\s*normalizeMediaCacheSource\(image\.apiResultUrl\);/);
  assert.match(helperSource, /if \(explicitOriginal && !explicitOriginal\.startsWith\('blob:'\)\) \{/);
});

test('media recovery preserves original slots and rejects blob-only media', () => {
  const helperSource = readSource('apps/web/src/context/canvasMediaRecovery.ts');

  assert.match(helperSource, /Never promote a thumbnail\/display asset into the protected original slot/);
  assert.match(helperSource, /if \(isGeneratedMediaVideoLike\(image\)\) \{/);
  assert.match(helperSource, /return stableVideoSource && !stableVideoSource\.startsWith\('blob:'\)/);
});
