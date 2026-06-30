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
  assert.match(helperSource, /export const buildCanvasLocalPersistenceSignature = \(/);
  assert.doesNotMatch(helperSource, /buildCanvasLocalPersistenceSignature[\s\S]*url/);
  assert.match(helperSource, /const snapshot = getCachedCanvasStorageSnapshot\(state, aggressive\);/);
  assert.match(helperSource, /if \(shouldSkipPersistedCanvasStorageWrite\(snapshot\.serialized\)\) \{/);
  assert.match(hookSource, /persistenceToken\?: unknown;/);
  assert.match(hookSource, /debouncedSaveDelayMs\?: number;/);
  assert.match(hookSource, /idleSaveTimeoutMs\?: number;/);
  assert.match(hookSource, /const localPersistenceToken = persistenceToken \?\? state;/);
  assert.match(hookSource, /const hasSkippedInitialDebouncedSaveRef = useRef\(false\);/);
  assert.match(hookSource, /if \(!hasSkippedInitialDebouncedSaveRef\.current\) \{[\s\S]*hasSkippedInitialDebouncedSaveRef\.current = true;[\s\S]*urgentSaveRef\.current = false;[\s\S]*return;/);
  assert.match(hookSource, /const saveDelayMs = isUrgentSave \? 0 : \(debouncedSaveDelayMs \?\? 600\);/);
  assert.match(hookSource, /const idleTimeoutMs = isUrgentSave \? 500 : \(idleSaveTimeoutMs \?\? 1500\);/);
  assert.match(hookSource, /requestIdleCallback\(saveState, \{ timeout: idleTimeoutMs \}\)/);
  assert.match(hookSource, /persistCanvasStateToLocalStorage\(stateRef\.current as any, storageKey, 'debounced-save'\);/);
  assert.match(hookSource, /\}, \[debouncedSaveDelayMs, idleSaveTimeoutMs, isLoading, localPersistenceToken, stateRef, storageKey, urgentSaveRef\]\);/);
  assert.match(source, /const localPersistenceToken = useMemo\(\s*\(\) => buildCanvasLocalPersistenceSignature\(/);
  assert.match(source, /const LARGE_CANVAS_LOCAL_PERSISTENCE_NODE_THRESHOLD = 1000;/);
  assert.match(source, /const LARGE_CANVAS_DEBOUNCED_SAVE_DELAY_MS = 30000;/);
  assert.match(source, /const LARGE_CANVAS_IDLE_SAVE_TIMEOUT_MS = 10000;/);
  assert.match(source, /const isLargeLocalPersistenceCanvas = useMemo\(/);
  assert.match(source, /debouncedSaveDelayMs: isLargeLocalPersistenceCanvas \? LARGE_CANVAS_DEBOUNCED_SAVE_DELAY_MS : undefined,/);
  assert.match(source, /idleSaveTimeoutMs: isLargeLocalPersistenceCanvas \? LARGE_CANVAS_IDLE_SAVE_TIMEOUT_MS : undefined,/);
  assert.match(source, /persistenceToken: localPersistenceToken,/);
  assert.doesNotMatch(source, /persistCanvasStateToLocalStorage\(stateToSave, 'urgent-node-save'\);/);
  assert.doesNotMatch(source, /persistCanvasStateToLocalStorage\(\{\s*\.\.\.prev,\s*canvases: updatedCanvases,\s*history: \{\}\s*\} as CanvasState, 'layout-save'\);/s);
  assert.match(source, /useCanvasLocalPersistence\(\{/);
});
