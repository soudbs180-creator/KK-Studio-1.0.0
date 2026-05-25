import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import {
  getKnownModelDisplayName,
  isRawModelDisplayName,
  resolveModelDisplayName,
} from '../../apps/web/src/utils/modelDisplayName.ts';
import { normalizeModelId } from '../../apps/web/src/utils/modelIdNormalization.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

describe('model display name normalization', () => {
  test('maps raw route-qualified Nano Banana 2 ids back to the picker label', () => {
    assert.equal(
      resolveModelDisplayName(
        'gemini-3.1-flash-image-preview@provider_pailitu',
        'gemini-3.1-flash-image-preview',
      ),
      'Nano Banana 2',
    );
  });

  test('preserves explicit aliases instead of overwriting them with canned names', () => {
    assert.equal(
      resolveModelDisplayName(
        'gemini-3.1-flash-image-preview@provider_pailitu',
        '拍立图专线 Nano Banana 2',
      ),
      '拍立图专线 Nano Banana 2',
    );
  });

  test('corrects stale Nano Banana family labels when they point at the wrong model', () => {
    assert.equal(
      resolveModelDisplayName(
        'gemini-3.1-flash-image-preview@provider_pailitu',
        'Nano Banana',
      ),
      'Nano Banana 2',
    );
  });

  test('treats bare model ids as raw display names', () => {
    assert.equal(isRawModelDisplayName('gemini-2.5-flash-image@slot_1', 'gemini-2.5-flash-image'), true);
    assert.equal(getKnownModelDisplayName('gemini-2.5-flash-image@slot_1'), 'Nano Banana');
  });

  test('canonicalizes provider variant ids back to the base image model', () => {
    assert.equal(normalizeModelId('gemini-3.1-flash-image-preview-4k'), 'gemini-3.1-flash-image-preview');
    assert.equal(normalizeModelId('gemini-3.1-flash-image-preview-512px'), 'gemini-3.1-flash-image-preview');
    assert.equal(normalizeModelId('gemini-2.5-flash-image-preview'), 'gemini-2.5-flash-image');
  });

  test('getModelDisplayName keeps provider argument compatibility without reading it', () => {
    const capabilitiesSource = readSource('src/services/model/modelCapabilities.ts');
    const testConfigSource = readSource('tsconfig.tests.json');

    assert.match(testConfigSource, /tests\/unit\/model-display-name-regression\.test\.ts/);
    assert.match(
      capabilitiesSource,
      /export function getModelDisplayName\(modelId: string, customLabel\?: string, _provider\?: string\): string/,
    );
    assert.doesNotMatch(
      capabilitiesSource,
      /export function getModelDisplayName\(modelId: string, customLabel\?: string, provider\?: string\): string/,
    );
    assert.match(capabilitiesSource, /if \(customLabel\) return customLabel;/);
  });
});
