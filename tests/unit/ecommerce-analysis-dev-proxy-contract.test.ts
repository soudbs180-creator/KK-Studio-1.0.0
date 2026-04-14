import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('local dev server wires the ecommerce analysis upload endpoint', () => {
  const clientSource = readSource('src/services/ecommerce/ecommerceAnalysisClient.ts');
  const viteConfigSource = readSource('vite.config.ts');

  assert.match(clientSource, /fetch\('\/api\/ecommerce-analysis'/);
  assert.match(viteConfigSource, /function ecommerceAnalysisProxyPlugin\(\): Plugin/);
  assert.match(viteConfigSource, /requestPath !== '\/api\/ecommerce-analysis'/);
  assert.match(viteConfigSource, /import\('\.\/api\/ecommerce-analysis\.ts'\)/);
  assert.match(viteConfigSource, /plugins:\s*\[[\s\S]*ecommerceAnalysisProxyPlugin\(\)/);
});
