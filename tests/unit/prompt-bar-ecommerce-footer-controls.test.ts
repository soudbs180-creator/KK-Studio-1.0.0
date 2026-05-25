import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



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
  assert.match(imageOptionsPanelSource, /const resolvedEcommerceSheet: EcommerceGroupSheet = activeEcommerceSheet \?\? /);
  assert.match(typesSource, /export type EcommerceAPlusControlMode = 'auto' \| '1464x600' \| '970x600' \| '600x450';/);
  assert.match(imageOptionsPanelSource, /const isAPlusControlSheet = isEcommercePanel && resolvedEcommerceSheet === 'A\+';/);
  assert.match(imageOptionsPanelSource, /const aPlusControlModeLabels: Record<EcommerceAPlusControlMode, string> = \{/);
  assert.match(imageOptionsPanelSource, /auto:/);
  assert.match(imageOptionsPanelSource, /1464x600/);
  assert.match(imageOptionsPanelSource, /970x600/);
  assert.match(imageOptionsPanelSource, /600x450/);
  assert.match(imageOptionsPanelSource, /onUpdateEcommerceSheetSetting\('A\+', \{ aPlusControlMode: mode \}\)/);
  assert.match(imageOptionsPanelSource, /const ecommerceDisplaySizes = useMemo/);
  assert.match(imageOptionsPanelSource, /ImageSize\.SIZE_4K/);
  assert.match(imageOptionsPanelSource, /const shouldUseSingleEqualRow = totalRatioCount <= 3;/);
  assert.match(imageOptionsPanelSource, /const autoInGrid = hasAuto && \(shouldUseSingleEqualRow \|\| isOddCount\);/);
  assert.doesNotMatch(imageOptionsPanelSource, /A\+ 生成比例/);
  assert.doesNotMatch(imageOptionsPanelSource, /fallback to 970x600/i);
  assert.match(promptBarSource, /return ecommerceAspectContext\.allowedAspectRatios;/);
  assert.match(promptBarSource, /config\.mode === GenerationMode\.ECOMMERCE && !baseSizes\.includes\(ImageSize\.SIZE_4K\)/);
  assert.match(promptBarSource, /availableRatios\.includes\(prev\.aspectRatio\)/);
  assert.match(promptBarSource, /availableSizes\.includes\(prev\.imageSize\)/);
  assert.match(imageOptionsPanelSource, /resolvedEcommerceSheet === sheet \? ACTIVE_BUTTON_STYLE : INACTIVE_BUTTON_STYLE/);
});

test('app forwards ecommerce sheet settings and the ecommerce confirm label into prompt bar surfaces', () => {
  const appSource = readSource('src/App.tsx');
  const appPromptComposerSource = readSource('src/app/AppPromptComposer.tsx');
  const promptBarHookSource = readSource('src/app/useAppPromptBarProps.ts');
  const sheetSettingsRuntimeSource = readSource('src/app/useEcommerceSheetSettingsRuntime.ts');

  assert.match(
    appPromptComposerSource,
    /export type AppPromptBarProps = React\.ComponentProps<typeof PromptBar> & \{\s*ecommerceSheetSettings\?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;\s*onUpdateEcommerceSheetSetting\?: \(sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch\) => void;\s*sendLabel\?: string;\s*\};/s,
  );
  assert.match(appPromptComposerSource, /const PromptBarCompat = PromptBar as React\.ComponentType<AppPromptBarProps>;/);
  assert.match(appSource, /const \{\s*mobilePromptBarProps,\s*desktopPromptBarProps,\s*\} = useAppPromptBarProps\(\{/s);
  assert.match(appSource, /useEcommerceSheetSettingsRuntime\(\{/);
  assert.match(sheetSettingsRuntimeSource, /aspectRatio: AspectRatio\.AUTO,\s*imageSize: preferredImageSize,/s);
  assert.match(sheetSettingsRuntimeSource, /'A\+': \{\s*aspectRatio: AspectRatio\.LANDSCAPE_16_9,\s*imageSize: ImageSize\.SIZE_4K,/s);
  assert.match(sheetSettingsRuntimeSource, /sheet === 'A\+'\s*\?\s*\{ \.\.\.mergedSetting, imageSize: ImageSize\.SIZE_4K \}/);
  assert.match(promptBarHookSource, /ecommerceSheetSettings: ecommerceState\.sheetSettings,/);
  assert.match(promptBarHookSource, /onUpdateEcommerceSheetSetting,/);
  assert.match(promptBarHookSource, /sendLabel: config\.mode === GenerationMode\.ECOMMERCE \?/);
});
