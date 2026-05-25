import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("keyManager keeps a first-class Flow2API preset and runtime provider mapping", () => {
  const keyManagerSource = readSource("src/services/auth/keyManager.ts");
  const providerPresetsSource = readSource("src/services/auth/keyManagerProviderPresets.ts");

  assert.match(providerPresetsSource, /'flow2api':\s*\{/);
  assert.match(providerPresetsSource, /name:\s*'Flow2API'/);
  assert.match(providerPresetsSource, /baseUrl:\s*'http:\/\/127\.0\.0\.1:8000'/);
  assert.match(keyManagerSource, /'Flow2API'\]\.includes\(p\.name\)/);
});
