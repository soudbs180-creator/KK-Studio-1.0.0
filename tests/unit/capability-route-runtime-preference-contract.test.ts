import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  isCapabilityRouteAssignmentModelDisabled,
  isCapabilityRouteAssignmentRouteDisabled,
  resolveCapabilityRouteAssignment,
  resolveEnabledCapabilityRouteAssignment,
} from '../../apps/web/src/services/api/capabilityRouteAssignments.ts';

const ROOT_DIR = process.cwd();
const CAPABILITY_STORAGE_KEY = 'kk_capability_route_assignments_v1';
const CUSTOM_ROUTING_STORAGE_KEY = 'kk_custom_routing_enabled_v1';



function withLocalStorageValue(value: string, run: () => void, customRoutingEnabled = true): void {
  const originalWindow = (globalThis as typeof globalThis & { window?: any }).window;
  const store = new Map<string, string>([
    [CAPABILITY_STORAGE_KEY, value],
    [CUSTOM_ROUTING_STORAGE_KEY, String(customRoutingEnabled)],
  ]);
  (globalThis as typeof globalThis & { window?: any }).window = {
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
    } as any,
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
  const appSource = readSource('apps/web/src/App.tsx');

  assert.match(appSource, /m === GenerationMode\.PPT[\s\S]*'ppt_generation'/);
  assert.match(appSource, /m === GenerationMode\.ECOMMERCE[\s\S]*'ecommerce_generation'/);
  assert.match(appSource, /m === GenerationMode\.IMAGE[\s\S]*'image_generation'/);
  assert.match(appSource, /resolveEnabledCapabilityRouteAssignment\(capabilityRole\)\?\.primaryRouteId/);
  assert.match(appSource, /isCapabilityRouteAssignmentRouteDisabled\(capabilityRole, rememberedKeyId\)/);
  assert.match(appSource, /return capabilityKeyId \|\| rememberedKeyId;/);
});

test('capability routing defaults to smart automatic mode until custom routing is enabled', () => {
  const source = readSource('apps/web/src/services/api/capabilityRouteAssignments.ts');
  const sectionSource = readSource('apps/web/src/components/settings/apiWorkbenchSections.tsx');

  assert.match(source, /const CUSTOM_ROUTING_KEY = 'kk_custom_routing_enabled_v1';/);
  assert.match(source, /export const isCustomRoutingEnabled = \(\): boolean => \{[\s\S]*return false;/);
  assert.match(source, /window\.localStorage\.getItem\(CUSTOM_ROUTING_KEY\) === 'true'/);
  assert.match(source, /return getSmartAutoAssignment\(role\);/);
  assert.match(source, /budgetScore = c\.budgetLimit;/);
  assert.match(source, /tokenScore = c\.tokenLimit \/ 10000/);
  assert.match(sectionSource, /开启后可以手动为每个能力模块指定供应商和模型/);
  assert.match(sectionSource, /关闭时默认启用智能调度，自动选择已配置的预算金额最高或 Tokens 上限最高的活跃通道/);
  assert.match(sectionSource, /disabled=\{!item\.enabled \|\| !customRoutingEnabled\}/);
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
  const chatSidebarSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const modelStateSource = readSource('apps/web/src/components/layout/chat-sidebar/model/useChatModelCatalog.ts');

  assert.match(modelStateSource, /resolveEnabledCapabilityRouteAssignment\('assistant'\)/);
  assert.match(modelStateSource, /subscribeCapabilityRouteAssignments\(updateModels\)/);
  assert.match(modelStateSource, /const selectableModels = models\.filter\(\(model\) => !isCapabilityRouteAssignmentModelDisabled\('assistant', model\.id\)\)/);
  assert.match(modelStateSource, /isCapabilityRouteAssignmentModelDisabled\('assistant', options\.selectedModel\.id\)/);
  assert.match(modelStateSource, /const nextModel = !currentModel \|\| disabled \? preferredModel : currentModel;/);
  assert.match(modelStateSource, /export function resolveAssistantPreferredModel/);
  assert.match(modelStateSource, /export function resolveAssistantPreferredKeyId/);
  assert.match(chatSidebarSource, /preferredKeyId: resolveAssistantPreferredKeyId\(\)/);
  assert.match(modelStateSource, /const preferredModel = resolveAssistantPreferredModel\(models\);/);
  assert.match(modelStateSource, /options\.setSelectedModel\(nextModel\);/);
  assert.match(chatSidebarSource, /onClick=\{\(\) => onSelect\(model\)\}/);
});
