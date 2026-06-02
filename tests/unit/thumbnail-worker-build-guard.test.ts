import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { test } from "node:test";

test("thumbnail worker bootstrap uses Vite's ?worker import instead of import.meta.url worker URLs", () => {
  const source = readSource("apps/web/src/workers/thumbnailService.ts");

  assert.match(source, /import ThumbnailWorker from '\.\/thumbnailWorker\.ts\?worker';/);
  assert.match(source, /worker = new ThumbnailWorker\(\);/);
  assert.doesNotMatch(source, /new Worker\(\s*new URL\('\.\/thumbnailWorker\.ts', import\.meta\.url\)/);
});
