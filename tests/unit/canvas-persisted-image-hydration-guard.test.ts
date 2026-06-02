import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";



test("canvas persisted-image hydration skips task-store reads when nothing needs recovery", () => {
  const source = readSource("apps/web/src/context/CanvasContext.tsx");
  const helperSource = readSource("apps/web/src/context/canvasPersistedImageRecovery.ts");

  assert.match(source, /from '\.\/canvasPersistedImageRecovery';/);
  assert.match(helperSource, /export const buildPersistedImageRecoverySignature = \(canvases: Canvas\[\] = \[\]\): string =>/);
  assert.match(source, /const persistedImageRecoverySignature = useMemo\(\s*\(\) => buildPersistedImageRecoverySignature\(state\.canvases\),\s*\[state\.canvases\]\s*\)/);
  assert.match(source, /const canHydratePersistedTaskResults = Boolean\(user && session && isStageReady\('background_ready'\)\);/);
  assert.match(source, /if \(isLoading \|\| !canHydratePersistedTaskResults \|\| !persistedImageRecoverySignature\) return;/);
  assert.match(source, /const persistedTasks = await getAllTasks\(\);/);
  assert.match(source, /\}, \[addImageNodes, canHydratePersistedTaskResults, isLoading, persistedImageRecoverySignature, updateNodes\]\);/);
});
