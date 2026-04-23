import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce workbench only shows current-version preview when a slot has a current image', () => {
  const workbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(workbenchSource, /currentTaskSlot\?\.currentImageId && onPreviewSlotHistory \? \(/);
});

test('ecommerce batch generation warns instead of silently no-oping when no eligible cards remain', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /if \(targetModules\.length === 0\) \{/);
  assert.match(appSource, /notify\.warning\('无可生成卡片',/);
});

test('ecommerce card selection button labels describe the next action instead of the current state', () => {
  const actionSource = readSource('src/components/ecommerce/EcommerceCardActions.tsx');

  assert.match(actionSource, /\{selected \? '取消确认' : '确认生成'\}/);
  assert.doesNotMatch(actionSource, /已勾选生成/);
  assert.doesNotMatch(actionSource, /跳过此卡/);
});
