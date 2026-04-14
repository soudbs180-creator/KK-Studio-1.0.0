import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('prompt bar ecommerce footer keeps only model, ecommerce parameters, network toggles, and send while the parameters panel keeps 主图/A+ settings inside the shared panel', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const modePanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const imageOptionsPanelSource = readSource('src/components/image/ImageOptionsPanel.tsx');

  assert.match(modePanelSource, /const renderAspectRatioSummaryIcon = \(ratio: AspectRatio\)/);
  assert.match(modePanelSource, /renderAspectRatioSummaryIcon\(config\.aspectRatio\)/);
  assert.match(modePanelSource, /summaryContent\?: React\.ReactNode;/);
  assert.match(modePanelSource, /const summary = summaryContent \?\? \(\(\) => \{/);

  assert.match(promptBarSource, /const ecommerceOptionsSummary = config\.mode === GenerationMode\.ECOMMERCE \? \(/);
  assert.match(
    promptBarSource,
    /\{\(\['主图', 'A\+'\] as EcommerceGroupSheet\[\]\)\.map\(\(sheet\) => \(/,
  );
  assert.match(promptBarSource, /activeEcommerceFooterSheet === sheet/);
  assert.match(
    promptBarSource,
    /<DesktopComposerModePanel[\s\S]*networkControls=\{!isMobile && \(groundingSupported \|\| imageSearchSupported\) \? \(/,
  );
  assert.match(promptBarSource, /summaryContent=\{ecommerceOptionsSummary\}/);
  assert.match(
    promptBarSource,
    /showThinkingMode=\{config\.mode === GenerationMode\.ECOMMERCE \? false : thinkingSupported\}/,
  );
  assert.match(
    promptBarSource,
    /ecommerceSheetSettings=\{config\.mode === GenerationMode\.ECOMMERCE \? ecommerceSheetSettings : undefined\}/,
  );
  assert.match(
    promptBarSource,
    /onUpdateEcommerceSheetSetting=\{config\.mode === GenerationMode\.ECOMMERCE \? onUpdateEcommerceSheetSetting : undefined\}/,
  );
  assert.match(
    promptBarSource,
    /activeEcommerceSheet=\{config\.mode === GenerationMode\.ECOMMERCE \? activeEcommerceFooterSheet : undefined\}/,
  );
  assert.match(
    promptBarSource,
    /onActiveEcommerceSheetChange=\{config\.mode === GenerationMode\.ECOMMERCE \? onActivateEcommerceGroupSheet : undefined\}/,
  );
  assert.match(
    promptBarSource,
    /!isMobile && config\.mode !== GenerationMode\.ECOMMERCE && \(/,
  );
  assert.doesNotMatch(
    promptBarSource,
    /config\.mode === GenerationMode\.ECOMMERCE \? activeEcommerceFooterSheet : `\$\{config\.parallelCount\}/,
  );

  assert.match(
    imageOptionsPanelSource,
    /ecommerceSheetSettings\?: Record<EcommerceGroupSheet, \{ aspectRatio: AspectRatio; imageSize: ImageSize \}>;/,
  );
  assert.match(
    imageOptionsPanelSource,
    /onUpdateEcommerceSheetSetting\?: \(sheet: EcommerceGroupSheet, patch: \{ aspectRatio\?: AspectRatio; imageSize\?: ImageSize \}\) => void;/,
  );
  assert.match(imageOptionsPanelSource, /activeEcommerceSheet\?: EcommerceGroupSheet;/);
  assert.match(imageOptionsPanelSource, /onActiveEcommerceSheetChange\?: \(sheet: EcommerceGroupSheet\) => void;/);
  assert.match(
    imageOptionsPanelSource,
    /const isEcommercePanel = !!ecommerceSheetSettings && !!onUpdateEcommerceSheetSetting;/,
  );
  assert.match(
    imageOptionsPanelSource,
    /const resolvedEcommerceSheet: EcommerceGroupSheet = activeEcommerceSheet \?\? '主图';/,
  );
  assert.match(
    imageOptionsPanelSource,
    /const activeEcommerceSheetSettings = isEcommercePanel[\s\S]*ecommerceSheetSettings\[resolvedEcommerceSheet\]/,
  );
  assert.match(
    imageOptionsPanelSource,
    /\{\(\['主图', 'A\+'\] as EcommerceGroupSheet\[\]\)\.map\(\(sheet\) => \(/,
  );
  assert.match(imageOptionsPanelSource, /resolvedEcommerceSheet === sheet/);
  assert.match(imageOptionsPanelSource, /onActiveEcommerceSheetChange\?\.\(sheet\)/);
  assert.match(imageOptionsPanelSource, /activeEcommerceSheetSettings\.aspectRatio/);
  assert.match(imageOptionsPanelSource, /activeEcommerceSheetSettings\.imageSize/);
  assert.match(imageOptionsPanelSource, /const shouldShowThinkingMode = !isEcommercePanel && showThinkingMode;/);
  assert.match(imageOptionsPanelSource, /shouldShowThinkingMode \? \(/);
});

test('app forwards ecommerce sheet settings and updater into both prompt bar surfaces', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(
    appSource,
    /const PromptBarCompat = PromptBar as React\.ComponentType<React\.ComponentProps<typeof PromptBar> & \{\s*ecommerceSheetSettings\?: Record<EcommerceGroupSheet, EcommerceSheetSetting>;\s*onUpdateEcommerceSheetSetting\?: \(sheet: EcommerceGroupSheet, patch: EcommerceSheetSettingPatch\) => void;\s*\}>;/s,
  );

  const mobilePromptBarMatch = appSource.match(/const mobileComposerNode = isMobile[\s\S]*?<PromptBarCompat([\s\S]*?)\/>/);
  assert.ok(mobilePromptBarMatch, 'expected to find the embedded mobile PromptBar instance');
  assert.match(mobilePromptBarMatch[1], /ecommerceSheetSettings=\{ecommerceState\.sheetSettings\}/);
  assert.match(mobilePromptBarMatch[1], /onUpdateEcommerceSheetSetting=\{handleUpdateEcommerceSheetSetting\}/);

  const desktopPromptBarMatch = appSource.match(/!isMobile && \([\s\S]*?<PromptBarCompat([\s\S]*?)\/>/);
  assert.ok(desktopPromptBarMatch, 'expected to find the desktop PromptBar instance');
  assert.match(desktopPromptBarMatch[1], /ecommerceSheetSettings=\{ecommerceState\.sheetSettings\}/);
  assert.match(desktopPromptBarMatch[1], /onUpdateEcommerceSheetSetting=\{handleUpdateEcommerceSheetSetting\}/);
});
