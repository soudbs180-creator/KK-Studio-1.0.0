import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('OCR settings stay isolated from generic LLM routes while keeping Nutrient keys server-side', () => {
  const settingsSource = readSource('src/services/document/ocrServiceSettings.ts');
  const clientSource = readSource('src/services/document/nutrientDocumentService.ts');
  const routeSource = readSource('api/nutrient-document.ts');

  assert.match(settingsSource, /defaultLanguage: 'chi_sim'/);
  assert.match(settingsSource, /provider: 'nutrient'/);
  assert.match(settingsSource, /healthState:/);
  assert.doesNotMatch(settingsSource, /apiKey/);
  assert.doesNotMatch(clientSource, /formData\.append\('apiKey'/);
  assert.match(routeSource, /process\.env\.NUTRIENT_API_KEY[\s\S]*process\.env\.NUTRIENT_DWS_API_KEY/);
  assert.doesNotMatch(routeSource, /formData\.get\('apiKey'\)/);
  assert.match(routeSource, /const DEFAULT_OCR_LANGUAGE = 'chi_sim';/);
});

test('hosted Nutrient route rejects browser supplied API keys when server env is missing', async () => {
  const originalNutrientApiKey = process.env.NUTRIENT_API_KEY;
  const originalNutrientDwsApiKey = process.env.NUTRIENT_DWS_API_KEY;
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;

  delete process.env.NUTRIENT_API_KEY;
  delete process.env.NUTRIENT_DWS_API_KEY;
  globalThis.fetch = async () => {
    upstreamCalled = true;
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  };

  try {
    const formData = new FormData();
    formData.append('operation', 'extract-text');
    formData.append('apiKey', 'browser-supplied-secret');
    formData.append(
      'file',
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'sample.pdf', {
        type: 'application/pdf',
      }),
    );

    const { default: handler } = await import('../../api/nutrient-document.ts');
    const response = await handler(new Request('http://localhost/api/nutrient-document', {
      method: 'POST',
      body: formData,
    }));
    const payload = await response.json() as { error?: string };

    assert.equal(response.status, 500);
    assert.equal(upstreamCalled, false);
    assert.match(payload.error || '', /Missing NUTRIENT_API_KEY or NUTRIENT_DWS_API_KEY/);
  } finally {
    if (originalNutrientApiKey === undefined) {
      delete process.env.NUTRIENT_API_KEY;
    } else {
      process.env.NUTRIENT_API_KEY = originalNutrientApiKey;
    }
    if (originalNutrientDwsApiKey === undefined) {
      delete process.env.NUTRIENT_DWS_API_KEY;
    } else {
      process.env.NUTRIENT_DWS_API_KEY = originalNutrientDwsApiKey;
    }
    globalThis.fetch = originalFetch;
  }
});
