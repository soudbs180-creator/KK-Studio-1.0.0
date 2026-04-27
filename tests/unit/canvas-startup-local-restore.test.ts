import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("canvas startup restore runs after the initial state initializer", () => {
  const source = readSource("src/context/CanvasContext.tsx");
  const helperSource = readSource("src/context/canvasPersistence.ts");

  assert.match(
    helperSource,
    /export const restoreCanvasStateFromLocalStorage = \(\s*storageKey: string\s*\): CanvasStorageStateLike \| null =>/
  );
  assert.match(source, /const \[state, setState\] = useState<CanvasState>\(DEFAULT_STATE\);/);
  assert.doesNotMatch(source, /const \[state, setState\] = useState<CanvasState>\(\(\) => \{/);
  assert.match(source, /if \(!isShellReady\) return;/);
  assert.match(source, /const restoredState = traceLocalPerformance\('canvas-startup\.restore-local-state', \(\) => restoreCanvasStateFromLocalStorage\(STORAGE_KEY\)\);/);
});
