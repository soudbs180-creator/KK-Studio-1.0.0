import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("workspace layout contract exposes explicit canvas fields instead of a generic record bag", () => {
  const dtoSource = readSource(path.join("packages", "shared", "src", "contracts", "dto", "workspace-canvas.ts"));

  assert.match(dtoSource, /export interface CanvasLayoutRecordDto \{/);
  assert.match(dtoSource, /id: EntityId;/);
  assert.match(dtoSource, /name: string;/);
  assert.match(dtoSource, /lastModified: number;/);
  assert.doesNotMatch(dtoSource, /\[key: string\]: unknown/);
});

test("sync service handles incremental operations and offline sync instead of double-casting records", () => {
  const syncServiceSource = readSource("apps/web/src/services/system/syncService.ts");

  assert.match(syncServiceSource, /queueOperation\(/);
  assert.match(syncServiceSource, /triggerSync\(\)/);
  assert.match(syncServiceSource, /saveLayout\(/);
  assert.doesNotMatch(syncServiceSource, /as unknown as Record<string, unknown>\[\]/);
});
