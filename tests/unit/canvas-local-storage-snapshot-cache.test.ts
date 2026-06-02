import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";



test("canvas local-storage persistence caches serialized snapshots for the same state object", () => {
  const source = readSource("apps/web/src/context/CanvasContext.tsx");
  const helperSource = readSource("apps/web/src/context/canvasPersistence.ts");
  const hookSource = readSource("apps/web/src/context/useCanvasLocalPersistence.ts");

  assert.match(helperSource, /const canvasStorageSnapshotCache = new WeakMap<object, CachedCanvasStorageSnapshot>\(\);/);
  assert.match(helperSource, /let lastPersistedCanvasStorageSnapshot: string \| null = null;/);
  assert.match(helperSource, /export const getCachedCanvasStorageSnapshot = <T extends CanvasStorageStateLike>\(/);
  assert.match(helperSource, /export const persistCanvasStateToLocalStorage = <T extends CanvasStorageStateLike>\(/);
  assert.match(helperSource, /const snapshot = getCachedCanvasStorageSnapshot\(state, aggressive\);/);
  assert.match(helperSource, /if \(shouldSkipPersistedCanvasStorageWrite\(snapshot\.serialized\)\) \{/);
  assert.match(hookSource, /persistCanvasStateToLocalStorage\(state as any, storageKey, 'debounced-save'\);/);
  assert.match(source, /useCanvasLocalPersistence\(\{/);
});
