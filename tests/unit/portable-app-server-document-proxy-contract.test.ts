import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('portable app server preserves the nutrient document route instead of treating it as an unsupported generic api', () => {
  const source = readSource('scripts/release/portable-app-server.cjs');

  assert.match(source, /pathname === '\/api\/nutrient-document'/);
  assert.match(source, /handleNutrientDocumentProxy/);
  assert.match(source, /normalizeMultipartProxyBody/);
  assert.match(
    source,
    /if \(pathname === '\/api\/nutrient-document'\) \{\s*await handleNutrientDocumentProxy\(req, res\);\s*return;\s*\}/,
  );
});

test('portable app server fails startup before serving a broken local core API', () => {
  const source = readSource('scripts/release/portable-app-server.cjs');

  assert.match(source, /function assertPortableRemoteKkApiBaseUrl/);
  assert.match(source, /VITE_KK_API_BASE_URL/);
  assert.match(source, /\(\[`"'\]\)\(\.\*\?\)\\1/);
  assert.match(source, /match && match\[2\]/);
  assert.match(source, /const portableKkApiBaseUrl = assertPortableRemoteKkApiBaseUrl\(distDir\)/);
  assert.match(source, /does not include the core KK API/);
  assert.match(source, /pathname\.startsWith\('\/api\/'\)/);
});
