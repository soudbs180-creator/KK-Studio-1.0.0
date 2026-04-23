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
  const apiHandlerSource = readSource('api/ecommerce-analysis.ts');

  assert.match(clientSource, /fetch\('\/api\/ecommerce-analysis'/);
  assert.doesNotMatch(clientSource, /import\('\.\/normalize\/ecommerceAnalysisNormalizer\.ts'\)/);
  assert.doesNotMatch(clientSource, /import\('\.\/xlsx\/openXmlWorkbookParser\.ts'\)/);
  assert.doesNotMatch(clientSource, /import\('\.\/text\/fallbackTextAnalysis\.ts'\)/);
  assert.doesNotMatch(clientSource, /import\('\.\.\/document\/nutrientDocumentService\.ts'\)/);
  assert.match(viteConfigSource, /function ecommerceAnalysisProxyPlugin\(\): Plugin/);
  assert.match(viteConfigSource, /requestPath !== '\/api\/ecommerce-analysis'/);
  assert.match(viteConfigSource, /import\('\.\/api\/ecommerce-analysis\.ts'\)/);
  assert.match(viteConfigSource, /plugins:\s*\[[\s\S]*ecommerceAnalysisProxyPlugin\(\)/);
  assert.match(apiHandlerSource, /from '\.\.\/src\/services\/ecommerce\/normalize\/ecommerceAnalysisNormalizer\.ts'/);
  assert.match(apiHandlerSource, /from '\.\.\/src\/services\/ecommerce\/text\/fallbackTextAnalysis\.ts'/);
  assert.match(apiHandlerSource, /from '\.\.\/src\/services\/ecommerce\/xlsx\/openXmlWorkbookParser\.ts'/);
});
