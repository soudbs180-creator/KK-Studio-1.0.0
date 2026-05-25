import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce framework types and runtime helpers are wired as first-class surfaces', () => {
  const typesSource = readSource('src/types.ts');
  const appSource = readSource('src/App.tsx');
  const frameworkRuntimeSource = readSource('src/services/ecommerce/frameworkRuntime.ts');
  const mobileWorkspaceSource = readSource('src/app/AppMobileWorkspace.tsx');

  assert.match(typesSource, /framework/);
  assert.match(typesSource, /frameworkId\?: string/);
  assert.match(typesSource, /parentNodeId\?: string/);
  assert.match(typesSource, /frameworkMeta\?: \{/);
  assert.match(typesSource, /export type EcommerceFrameworkQueueStatus = 'queued' \| 'dispatching' \| 'running' \| 'completed' \| 'failed' \| 'paused';/);
  assert.match(typesSource, /export interface EcommerceFrameworkRuntimeState/);
  assert.match(typesSource, /frameworkStatus\?: \{/);

  assert.match(frameworkRuntimeSource, /migrateLegacyEcommerceFrameworkCanvas/);
  assert.match(frameworkRuntimeSource, /resolveEcommerceFrameworkDispatchPlan/);
  assert.match(frameworkRuntimeSource, /pauseEcommerceFrameworkRuntime/);
  assert.match(frameworkRuntimeSource, /cancelEcommerceFrameworkNodeQueue/);

  assert.match(appSource, /handleGenerateEcommerceFramework/);
  assert.match(appSource, /pumpEcommerceFrameworkQueue/);
  assert.doesNotMatch(appSource, /migrateLegacyEcommerceFrameworkCanvas/);
  assert.doesNotMatch(
    appSource,
    /await Promise\.allSettled\(targetModules\.map\(\(item\) => \(\s*phase === 'desktop' \? handleGenerateEcommerceNode\(item\) : handleRetryEcommerceModule\(item\)\s*\)\)\);/,
  );

  assert.match(mobileWorkspaceSource, /selectMobileFeedResults\(activeCanvas\?\.promptNodes \|\| \[\], activeCanvas\?\.imageNodes \|\| \[\], frameworkRuntime\)/);
});

test('ecommerce framework prompt width is shared with canvas layout bounds', () => {
  const promptNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');
  const promptNodeCardWidthSource = readSource('src/utils/promptNodeCardWidth.ts');
  const appSource = readSource('src/App.tsx');

  assert.match(promptNodeCardWidthSource, /export const ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH = 920;/);
  assert.match(promptNodeCardWidthSource, /export function getPromptNodeBoundsWidth/);
  assert.match(promptNodeSource, /getPromptNodeCardWidth\(node, isMobile/);
  assert.match(promptGroupLayoutSource, /getPromptNodeBoundsWidth\(promptNode, isMobile/);
  assert.match(appSource, /getPromptNodeBoundsWidth\(prompt, isMobile\)/);
  assert.doesNotMatch(promptGroupLayoutSource, /addRect\(livePromptPosition\.x, livePromptPosition\.y, 380,/);
  assert.doesNotMatch(appSource, /addRect\(prompt\.position\.x, prompt\.position\.y, 380,/);
});
