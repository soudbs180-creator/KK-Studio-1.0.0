import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import { nutrientDocumentService } from '../../src/services/document/nutrientDocumentService.ts';

const ROOT_DIR = process.cwd();
const originalFetch = globalThis.fetch;
const globalLike = globalThis as typeof globalThis & {
  window?: {
    localStorage?: Storage;
  };
  localStorage?: Storage;
};

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const originalWindow = globalLike.window;
const originalLocalStorage = globalLike.localStorage;

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalLike.window = originalWindow;
  globalLike.localStorage = originalLocalStorage;
});

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

test('runOcrOnPdf applies the saved OCR default language when no explicit language is provided', async () => {
  const localStorage = new MemoryStorage();
  localStorage.setItem('kk_ocr_service_settings_v1', JSON.stringify({
    provider: 'nutrient',
    enabled: true,
    defaultLanguage: 'eng',
    keySource: 'missing',
    healthState: 'unknown',
    updatedAt: 1,
  }));
  globalLike.window = { localStorage };
  globalLike.localStorage = localStorage;

  let ocrLanguage: FormDataEntryValue | null = null;
  globalThis.fetch = async (_input, init) => {
    const body = init?.body;
    assert.ok(body instanceof FormData);
    ocrLanguage = body.get('ocrLanguage');
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="ocr.pdf"',
      },
    });
  };

  await nutrientDocumentService.runOcrOnPdf(
    new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'input.pdf', {
      type: 'application/pdf',
    }),
  );

  assert.equal(ocrLanguage, 'eng');
});
