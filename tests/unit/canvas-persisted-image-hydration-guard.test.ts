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
  assert.match(source, /const canHydratePersistedTaskResults =/);
  assert.match(source, /if \(isLoading \|\| !canHydratePersistedTaskResults \|\| !persistedImageRecoverySignature\) return;/);
  assert.match(source, /const persistedTasks = await getAllTasks\(\);/);
  assert.match(source, /PERSISTED_IMAGE_RECOVERY_LARGE_CANVAS_THRESHOLD/);
  assert.match(source, /PERSISTED_IMAGE_RECOVERY_LARGE_IMAGE_LIMIT/);
  assert.match(source, /const boundedRecoveryImageNodes = isLargePersistedRecoveryProject/);
  assert.match(source, /for \(const imageNode of boundedRecoveryImageNodes\)/);
  assert.match(source, /PERSISTED_IMAGE_RECOVERY_LARGE_PROMPT_LIMIT/);
  assert.match(source, /const existingChildren = strongOwnedImagesByParentPromptId\.get\(promptNode\.id\) \|\| \[\];/);
  assert.doesNotMatch(source, /\(canvas\.imageNodes \|\| \[\]\)\.filter\(\(imageNode\) => imageNode\.parentPromptId === promptNode\.id\)/);
  assert.match(source, /\}, \[[\s\S]*addImageNodes,[\s\S]*canHydratePersistedTaskResults,[\s\S]*isLoading,[\s\S]*persistedImageRecoverySignature,[\s\S]*shouldDeferPersistedRecoveryForLargeCanvas,[\s\S]*updateNodes,[\s\S]*\]\);/);
});
