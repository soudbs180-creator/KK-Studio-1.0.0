import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";



test("canvas cloud sync is driven by a memoized sync signature instead of raw canvases", () => {
  const source = readSource("apps/web/src/context/CanvasContext.tsx");
  const helperSource = readSource("apps/web/src/context/canvasPersistence.ts");
  const hookSource = readSource("apps/web/src/context/useCanvasCloudSync.ts");

  assert.match(helperSource, /export const buildCanvasCloudSyncSignature = \(canvases: Canvas\[\] = \[\]\): string =>/);
  assert.match(hookSource, /const hasCloudSyncLocalOnlyMedia = useMemo\(\s*\(\) => hasLocalOnlyCanvasMedia\(canvases\),/);
  assert.match(hookSource, /const canvasCloudSyncSignature = useMemo\(\s*\(\) => hasCloudSyncLocalOnlyMedia \? '' : buildCanvasCloudSyncSignature\(canvases\),/);
  assert.match(hookSource, /const cloudSyncLayoutPayload = useMemo\(\s*\(\) => canvasCloudSyncSignature \? getCachedStrippedCanvases\(canvases\) : \[\],/);
  assert.doesNotMatch(hookSource, /import \{ syncService \} from '..\/services\/system\/syncService';/);
  assert.match(hookSource, /import\('..\/services\/system\/syncService'\)\s*\.then\(\(\{ syncService \}\) => syncService\.saveLayout\(cloudSyncLayoutPayload\)\)\s*\.catch/);
  assert.match(hookSource, /\}, \[canvasCloudSyncSignature, cloudSyncLayoutPayload, enabled, hasCloudSyncLocalOnlyMedia, isLoading, canvases\.length\]\);/);
  assert.match(source, /useCanvasCloudSync\(state\.canvases, isLoading, canSaveCloudLayout\);/);
});
