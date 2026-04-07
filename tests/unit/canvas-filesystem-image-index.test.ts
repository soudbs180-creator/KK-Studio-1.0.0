import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("canvas file-system persistence indexes image nodes before blob collection", () => {
  const source = readSource("src/context/useCanvasFileSystemPersistence.ts");

  assert.match(source, /const imageNodesByStorageId = new Map<string, GeneratedImage>\(\);/);
  assert.match(source, /if \(!imageNodesByStorageId\.has\(storageId\)\) \{/);
  assert.match(source, /for \(const \[id, imageNode\] of imageNodesByStorageId\.entries\(\)\) \{/);
  assert.doesNotMatch(source, /\.flatMap\(canvas => canvas\.imageNodes\)\s*\.find\(img => \(img\.storageId \|\| img\.id\) === id\)/);
});
