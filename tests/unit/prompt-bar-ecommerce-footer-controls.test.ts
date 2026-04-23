import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt bar ecommerce footer keeps ecommerce state inside the shared mode panel', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const modePanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const imageOptionsPanelSource = readSource('src/components/image/ImageOptionsPanel.tsx');
  const typesSource = readSource('src/types.ts');

  assert.match(modePanelSource, /summaryContent\?: React\.ReactNode;/);
  assert.match(promptBarSource, /const ecommerceOptionsSummary = config\.mode === GenerationMode\.ECOMMERCE \? \(/);
  assert.match(promptBarSource, /summaryContent=\{ecommerceOptionsSummary\}/);
  assert.match(promptBarSource, /ecommerceSheetSettings=\{config\.mode === GenerationMode\.ECOMMERCE \? ecommerceSheetSettings : undefined\}/);
  assert.match(promptBarSource, /onUpdateEcommerceSheetSetting=\{config\.mode === GenerationMode\.ECOMMERCE \? onUpdateEcommerceSheetSetting : undefined\}/);
  assert.match(promptBarSource, /activeEcommerceSheet=\{config\.mode === GenerationMode\.ECOMMERCE \? activeEcommerceFooterSheet : undefined\}/);
  assert.match(promptBarSource, /onActiveEcommerceSheetChange=\{config\.mode === GenerationMode\.ECOMMERCE \? onActivateEcommerceGroupSheet : undefined\}/);

  assert.match(imageOptionsPanelSource, /const isEcommercePanel = !!ecommerceSheetSettings && !!onUpdateEcommerceSheetSetting;/);
  assert.match(imageOptionsPanelSource, /const resolvedEcommerceSheet: EcommerceGroupSheet = activeEcommerceSheet \?\? '主图';/);
  assert.match(typesSource, /export type EcommerceAPlusControlMode = 'auto' \| '1464x600' \| '970x600' \| '600x450';/);
  assert.match(imageOptionsPanelSource, /const isAPlusControlSheet = isEcommercePanel && resolvedEcommerceSheet === 'A\+';/);
  assert.match(imageOptionsPanelSource, /A\+ 尺寸档位/);
  assert.match(imageOptionsPanelSource, /自动/);
  assert.match(imageOptionsPanelSource, /1464x600/);
  assert.match(imageOptionsPanelSource, /970x600/);
  assert.match(imageOptionsPanelSource, /600x450/);
  assert.match(imageOptionsPanelSource, /主图比例/);
  assert.match(imageOptionsPanelSource, /A\+ 不再手动选择比例|A\+ 生成比例由尺寸档位和提示词控制/);
});

test('app forwards ecommerce sheet settings and the ecommerce confirm label into prompt bar surfaces', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(
    appSource,
    /const PromptBarCompat = PromptBar as React\.ComponentType<React\.ComponentProps<typeof PromptBar> & \{\s*ecommerceSheetSettings\?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;\s*onUpdateEcommerceSheetSetting\?: \(sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch\) => void;\s*sendLabel\?: string;\s*\}>;/s,
  );
  assert.match(appSource, /ecommerceSheetSettings=\{ecommerceState\.sheetSettings\}/);
  assert.match(appSource, /onUpdateEcommerceSheetSetting=\{handleUpdateEcommerceSheetSetting\}/);
  assert.match(appSource, /sendLabel=\{config\.mode === GenerationMode\.ECOMMERCE \? '确认' : '发送'\}/);
});
