import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";



test("canvas stripped payloads are cached per canvases array", () => {
  const source = readSource("apps/web/src/context/CanvasContext.tsx");
  const helperSource = readSource("apps/web/src/context/canvasPersistence.ts");
  const hookSource = readSource("apps/web/src/context/useCanvasCloudSync.ts");
  const fsHookSource = readSource("apps/web/src/context/useCanvasFileSystemPersistence.ts");

  assert.match(helperSource, /const strippedCanvasCache = new WeakMap<Canvas\[\], CachedStrippedCanvases>\(\);/);
  assert.match(helperSource, /export const getCachedStrippedCanvases = \(\s*canvases: Canvas\[\],\s*aggressive: boolean = false/);
  assert.match(helperSource, /canvases: getCachedStrippedCanvases\(state\.canvases, aggressive\),/);
  assert.match(hookSource, /\(\) => \(canvasCloudSyncSignature && !isLargeProject \? getCachedStrippedCanvases\(canvases\) : \[\]\),/);
  assert.match(fsHookSource, /const cleanCanvases = getCachedStrippedCanvases\(currentState\.canvases\);/);
  assert.match(source, /useCanvasFileSystemPersistence\(\{/);
});
