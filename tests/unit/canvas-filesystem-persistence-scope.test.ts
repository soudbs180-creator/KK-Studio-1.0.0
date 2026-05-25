import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";



test("canvas periodic persistence effect only handles file-system saves", () => {
  const source = readSource("src/context/CanvasContext.tsx");
  const helperSource = readSource("src/context/canvasPersistence.ts");
  const hookSource = readSource("src/context/useCanvasFileSystemPersistence.ts");

  assert.match(helperSource, /export const buildCanvasFileSystemPersistenceSignature = \(\s*canvases: Canvas\[\] = \[\],\s*activeCanvasId\?: string/);
  assert.match(hookSource, /const fileSystemPersistenceSignature = useMemo\(/);
  assert.match(hookSource, /if \(isLoading \|\| !fileSystemHandle \|\| !fileSystemPersistenceSignature\) return;/);
  assert.match(hookSource, /const currentState = stateRef\.current;/);
  assert.doesNotMatch(source, /persistCanvasStateToLocalStorage\(state, 'periodic-save'\)/);
  assert.match(hookSource, /await fileSystemService\.saveProject\(fileSystemHandle, fsState as any, imagesToSave\);/);
  assert.match(hookSource, /\}, \[fileSystemPersistenceSignature, fileSystemHandle, isLoading, isSavingRef, resolveOriginalPersistSourceForDisk, stateRef\]\);/);
  assert.match(source, /useCanvasFileSystemPersistence\(\{/);
});
