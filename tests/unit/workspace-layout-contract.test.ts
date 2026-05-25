import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  const actualPath = relativePath.replace(/packages[/\\]contracts[/\\]/, "packages/shared/src/contracts/").replace(/^src[/\\]/, "apps/web/src/"); return readFileSync(path.join(ROOT_DIR, actualPath), "utf8");
}

test("workspace layout contract exposes explicit canvas fields instead of a generic record bag", () => {
  const dtoSource = readSource(path.join("packages", "contracts", "src", "dto", "workspace-canvas.ts"));

  assert.match(dtoSource, /export interface CanvasLayoutRecordDto \{/);
  assert.match(dtoSource, /id: EntityId;/);
  assert.match(dtoSource, /name: string;/);
  assert.match(dtoSource, /lastModified: number;/);
  assert.doesNotMatch(dtoSource, /\[key: string\]: unknown/);
});

test("sync service maps canvases through explicit workspace layout helpers instead of double-casting records", () => {
  const syncServiceSource = readSource("src/services/system/syncService.ts");

  assert.match(syncServiceSource, /function toCanvasLayoutRecord\(canvas: Canvas\): CanvasLayoutRecordDto \{/);
  assert.match(syncServiceSource, /function normalizeCanvasRecord\(raw: unknown\): Canvas \| null \{/);
  assert.match(syncServiceSource, /canvases: canvases\.map\(toCanvasLayoutRecord\)/);
  assert.doesNotMatch(syncServiceSource, /as unknown as Record<string, unknown>\[\]/);
});
