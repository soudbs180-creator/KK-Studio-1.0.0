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
  assert.match(hookSource, /if \(!enabled\) \{\s*return 0;\s*\}/);
  assert.match(hookSource, /if \(!enabled \|\| isLargeProject\) \{\s*return false;\s*\}/);
  assert.match(hookSource, /return hasLocalOnlyCanvasMedia\(canvases\);/);
  assert.match(hookSource, /if \(!enabled \|\| hasCloudSyncLocalOnlyMedia\) \{\s*return '';\s*\}/);
  assert.match(hookSource, /if \(isLargeProject\) \{\s*return `large:\$\{totalCardsCount\}`;\s*\}/);
  assert.match(hookSource, /const cloudSyncLayoutPayload = useMemo\(\s*\(\) => \(canvasCloudSyncSignature && !isLargeProject \? getCachedStrippedCanvases\(canvases\) : \[\]\),/);
  assert.match(hookSource, /const buildCanvasCloudSyncNodeSnapshot = \(canvases: Canvas\[\]\): Map<string, CanvasCloudSyncNodeSnapshot> =>/);
  assert.match(hookSource, /previousCloudSyncSignatureRef\.current = buildCanvasCloudSyncSignature\(canvases\);/);
  assert.match(hookSource, /previousLargeProjectSnapshotRef\.current = buildCanvasCloudSyncNodeSnapshot\(canvases\);/);
  assert.doesNotMatch(hookSource, /JSON\.parse\(JSON\.stringify\(canvases\)\)/);
  assert.doesNotMatch(hookSource, /previousCanvasesRef/);
  assert.doesNotMatch(hookSource, /import \{ syncService \} from '..\/services\/system\/syncService';/);
  assert.match(hookSource, /import\('..\/services\/system\/syncService'\)\s*\.then\(\(\{ syncService \}\) => syncService\.saveLayout\(cloudSyncLayoutPayload\)\)\s*\.catch/);
  assert.match(hookSource, /\}, \[canvasCloudSyncSignature, cloudSyncLayoutPayload, enabled, hasCloudSyncLocalOnlyMedia, isLoading, canvases\.length, isLargeProject, canvases\]\);/);
  assert.match(source, /useCanvasCloudSync\(state\.canvases, isLoading, canUseCloudLayout\);/);
});
