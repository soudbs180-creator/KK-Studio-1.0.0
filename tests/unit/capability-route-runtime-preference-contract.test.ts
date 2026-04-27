import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  isCapabilityRouteAssignmentModelDisabled,
  isCapabilityRouteAssignmentRouteDisabled,
  resolveCapabilityRouteAssignment,
  resolveEnabledCapabilityRouteAssignment,
} from '../../src/services/api/capabilityRouteAssignments.ts';

const ROOT_DIR = process.cwd();
const CAPABILITY_STORAGE_KEY = 'kk_capability_route_assignments_v1';

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function withLocalStorageValue(value: string, run: () => void): void {
  const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
  const store = new Map<string, string>([[CAPABILITY_STORAGE_KEY, value]]);
  (globalThis as typeof globalThis & { window?: unknown }).window = {
    localStorage: {
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, nextValue: string) {
        store.set(key, nextValue);
      },
      removeItem(key: string) {
        store.delete(key);
      },
    },
  };

  try {
    run();
  } finally {
    if (typeof originalWindow === 'undefined') {
      delete (globalThis as typeof globalThis & { window?: unknown }).window;
    } else {
      (globalThis as typeof globalThis & { window?: unknown }).window = originalWindow;
    }
  }
}

test('generation mode key preference reads capability route assignments before falling back to per-mode local memory', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /m === GenerationMode\.PPT[\s\S]*'ppt_generation'/);
  assert.match(appSource, /m === GenerationMode\.ECOMMERCE[\s\S]*'ecommerce_generation'/);
  assert.match(appSource, /m === GenerationMode\.IMAGE[\s\S]*'image_generation'/);
  assert.match(appSource, /resolveEnabledCapabilityRouteAssignment\(capabilityRole\)\?\.primaryRouteId/);
  assert.match(appSource, /isCapabilityRouteAssignmentRouteDisabled\(capabilityRole, rememberedKeyId\)/);
  assert.match(appSource, /return capabilityKeyId \|\| rememberedKeyId;/);
});

test('enabled-only capability resolver preserves raw assignments while blocking disabled runtime routes', () => {
  withLocalStorageValue(JSON.stringify([
    {
      role: 'image_generation',
      enabled: false,
      primaryRouteId: 'disabled-image-route',
      updatedAt: 1,
    },
    {
      role: 'ppt_generation',
      enabled: true,
      primaryRouteId: 'enabled-ppt-route',
      updatedAt: 1,
    },
  ]), () => {
    assert.equal(
      resolveCapabilityRouteAssignment('image_generation')?.primaryRouteId,
      'disabled-image-route',
    );
    assert.equal(resolveEnabledCapabilityRouteAssignment('image_generation'), undefined);
    assert.equal(
      resolveEnabledCapabilityRouteAssignment('ppt_generation')?.primaryRouteId,
      'enabled-ppt-route',
    );
    assert.equal(isCapabilityRouteAssignmentRouteDisabled('image_generation', 'disabled-image-route'), true);
    assert.equal(isCapabilityRouteAssignmentRouteDisabled('ppt_generation', 'enabled-ppt-route'), false);
    assert.equal(isCapabilityRouteAssignmentModelDisabled('image_generation', 'imagen-test@slot_disabled-image-route'), true);
    assert.equal(isCapabilityRouteAssignmentModelDisabled('ppt_generation', 'gemini-test@slot_enabled-ppt-route'), false);
  });
});

test('chat sidebar prefers the assistant capability route as its default model and preferred key source without removing manual model choice', () => {
  const chatSidebarSource = readSource('src/components/layout/ChatSidebar.tsx');

  assert.match(chatSidebarSource, /resolveEnabledCapabilityRouteAssignment\('assistant'\)/);
  assert.match(chatSidebarSource, /subscribeCapabilityRouteAssignments\(updateModels\)/);
  assert.match(chatSidebarSource, /const selectableModels = models\.filter\(\(model\) => !isCapabilityRouteAssignmentModelDisabled\('assistant', model\.id\)\)/);
  assert.match(chatSidebarSource, /isCapabilityRouteAssignmentModelDisabled\('assistant', selectedModel\.id\)/);
  assert.match(chatSidebarSource, /if \(!exists \|\| staleDisabledCapabilityModel\)/);
  assert.match(chatSidebarSource, /const resolveAssistantPreferredModel = useCallback/);
  assert.match(chatSidebarSource, /const resolveAssistantPreferredKeyId = useCallback/);
  assert.match(chatSidebarSource, /preferredKeyId: resolveAssistantPreferredKeyId\(\)/);
  assert.match(chatSidebarSource, /const assistantPreferredModel = resolveAssistantPreferredModel\(models\);/);
  assert.match(chatSidebarSource, /setSelectedModel\(assistantPreferredModel\);/);
  assert.match(chatSidebarSource, /onClick=\{\(\) => onSelect\(model\)\}/);
});
