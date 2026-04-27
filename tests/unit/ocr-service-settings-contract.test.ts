import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('OCR settings stay isolated from generic LLM routes while preserving Nutrient compatibility and BYOK fallback', () => {
  const settingsSource = readSource('src/services/document/ocrServiceSettings.ts');
  const clientSource = readSource('src/services/document/nutrientDocumentService.ts');
  const routeSource = readSource('api/nutrient-document.ts');

  assert.match(settingsSource, /defaultLanguage: 'chi_sim'/);
  assert.match(settingsSource, /provider: 'nutrient'/);
  assert.match(settingsSource, /healthState:/);
  assert.match(clientSource, /formData\.append\('apiKey'/);
  assert.match(routeSource, /process\.env\.NUTRIENT_API_KEY[\s\S]*process\.env\.NUTRIENT_DWS_API_KEY/);
  assert.match(routeSource, /formData\.get\('apiKey'\)/);
  assert.match(routeSource, /const DEFAULT_OCR_LANGUAGE = 'chi_sim';/);
});
