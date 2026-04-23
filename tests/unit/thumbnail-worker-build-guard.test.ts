import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

test("thumbnail worker bootstrap uses Vite's ?worker import instead of import.meta.url worker URLs", () => {
  const source = readFileSync(path.join(ROOT_DIR, "src", "workers", "thumbnailService.ts"), "utf-8");

  assert.match(source, /import ThumbnailWorker from '\.\/thumbnailWorker\.ts\?worker';/);
  assert.match(source, /worker = new ThumbnailWorker\(\);/);
  assert.doesNotMatch(source, /new Worker\(\s*new URL\('\.\/thumbnailWorker\.ts', import\.meta\.url\)/);
});
