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
  assert.match(hookSource, /persistenceToken\?: unknown;/);
  assert.match(hookSource, /const localPersistenceToken = persistenceToken \?\? state;/);
  assert.match(hookSource, /const hasSkippedInitialDebouncedSaveRef = useRef\(false\);/);
  assert.match(hookSource, /if \(!hasSkippedInitialDebouncedSaveRef\.current\) \{[\s\S]*hasSkippedInitialDebouncedSaveRef\.current = true;[\s\S]*urgentSaveRef\.current = false;[\s\S]*return;/);
  assert.match(hookSource, /requestIdleCallback\(saveState, \{ timeout: isUrgentSave \? 500 : 1500 \}\)/);
  assert.match(hookSource, /persistCanvasStateToLocalStorage\(stateRef\.current as any, storageKey, 'debounced-save'\);/);
  assert.match(hookSource, /\}, \[isLoading, localPersistenceToken, stateRef, storageKey, urgentSaveRef\]\);/);
  assert.match(source, /const localPersistenceToken = useMemo\(\(\) => \(\{/);
  assert.match(source, /persistenceToken: localPersistenceToken,/);
  assert.doesNotMatch(source, /persistCanvasStateToLocalStorage\(stateToSave, 'urgent-node-save'\);/);
  assert.doesNotMatch(source, /persistCanvasStateToLocalStorage\(\{\s*\.\.\.prev,\s*canvases: updatedCanvases,\s*history: \{\}\s*\} as CanvasState, 'layout-save'\);/s);
  assert.match(source, /useCanvasLocalPersistence\(\{/);
});
