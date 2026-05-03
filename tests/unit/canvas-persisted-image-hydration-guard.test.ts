import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("canvas persisted-image hydration skips task-store reads when nothing needs recovery", () => {
  const source = readSource("src/context/CanvasContext.tsx");
  const helperSource = readSource("src/context/canvasPersistedImageRecovery.ts");

  assert.match(source, /from '\.\/canvasPersistedImageRecovery';/);
  assert.match(helperSource, /export const buildPersistedImageRecoverySignature = \(canvases: Canvas\[\] = \[\]\): string =>/);
  assert.match(source, /const persistedImageRecoverySignature = useMemo\(\s*\(\) => buildPersistedImageRecoverySignature\(state\.canvases\),\s*\[state\.canvases\]\s*\)/);
  assert.match(source, /const canHydratePersistedTaskResults = Boolean\(user && session && isStageReady\('background_ready'\)\);/);
  assert.match(source, /if \(isLoading \|\| !canHydratePersistedTaskResults \|\| !persistedImageRecoverySignature\) return;/);
  assert.match(source, /const persistedTasks = await getAllTasks\(\);/);
  assert.match(source, /\}, \[addImageNodes, canHydratePersistedTaskResults, isLoading, persistedImageRecoverySignature, updateNodes\]\);/);
});
