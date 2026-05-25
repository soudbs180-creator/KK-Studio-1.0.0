import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('image services do not retain compiler-proven unused priority and LOD locals', () => {
  const priorityLoaderSource = readSource('src/services/image/imagePriorityLoader.ts');
  const lodServiceSource = readSource('src/services/image/lodService.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/image-service-unused-cleanup-contract\.test\.ts/);

  assert.match(priorityLoaderSource, /import \{ distanceFromViewportCenter \} from '\.\.\/\.\.\/hooks\/useLazyImage';/);
  assert.doesNotMatch(priorityLoaderSource, /isElementInViewport/);
  assert.doesNotMatch(priorityLoaderSource, /intervalId/);

  assert.doesNotMatch(lodServiceSource, /QUALITY_CONFIGS/);
  assert.doesNotMatch(lodServiceSource, /function lodToQuality/);
  assert.doesNotMatch(lodServiceSource, /const quality = lodToQuality\(targetLevel\);/);
});
