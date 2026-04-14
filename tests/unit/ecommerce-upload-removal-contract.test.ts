import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce upload removal flows from App state down to the import panel actions', () => {
  const appSource = readSource('src/App.tsx');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const importPanelSource = readSource('src/components/ecommerce/EcommerceImportPanel.tsx');

  assert.match(appSource, /const handleClearEcommerceRequirementFile = useCallback\(\(\) => \{/);
  assert.match(appSource, /const handleRemoveEcommerceProductFile = useCallback\(\(index: number\) => \{/);
  assert.match(appSource, /const handleRemoveEcommerceExtraReferenceFile = useCallback\(\(index: number\) => \{/);
  assert.match(appSource, /onClearEcommerceRequirementFile=\{handleClearEcommerceRequirementFile\}/);
  assert.match(appSource, /onRemoveEcommerceProductFile=\{handleRemoveEcommerceProductFile\}/);
  assert.match(appSource, /onRemoveEcommerceExtraReferenceFile=\{handleRemoveEcommerceExtraReferenceFile\}/);

  assert.match(promptBarSource, /onClearEcommerceRequirementFile\?: \(\) => void;/);
  assert.match(promptBarSource, /onRemoveEcommerceProductFile\?: \(index: number\) => void;/);
  assert.match(promptBarSource, /onRemoveEcommerceExtraReferenceFile\?: \(index: number\) => void;/);
  assert.match(promptBarSource, /onClearRequirementFile=\{onClearEcommerceRequirementFile\}/);
  assert.match(promptBarSource, /onRemoveProductFile=\{onRemoveEcommerceProductFile\}/);
  assert.match(promptBarSource, /onRemoveExtraReferenceFile=\{onRemoveEcommerceExtraReferenceFile\}/);

  assert.match(desktopPanelSource, /onClearRequirementFile\?: \(\) => void;/);
  assert.match(desktopPanelSource, /onRemoveProductFile\?: \(index: number\) => void;/);
  assert.match(desktopPanelSource, /onRemoveExtraReferenceFile\?: \(index: number\) => void;/);
  assert.match(desktopPanelSource, /onClearRequirementFile=\{\(\) => onClearRequirementFile\?\.\(\)\}/);
  assert.match(desktopPanelSource, /onRemoveProductFile=\{\(index\) => onRemoveProductFile\?\.\(index\)\}/);
  assert.match(desktopPanelSource, /onRemoveExtraReferenceFile=\{\(index\) => onRemoveExtraReferenceFile\?\.\(index\)\}/);

  assert.match(importPanelSource, /onClearRequirementFile: \(\) => void;/);
  assert.match(importPanelSource, /onRemoveProductFile: \(index: number\) => void;/);
  assert.match(importPanelSource, /onRemoveExtraReferenceFile: \(index: number\) => void;/);
  assert.match(importPanelSource, /onClearRequirementFile\(\)/);
  assert.match(importPanelSource, /renderPreviewStrip\(uploadPreviewModel\.productItems, productPreviewUrls, onRemoveProductFile\)/);
  assert.match(importPanelSource, /renderPreviewStrip\(uploadPreviewModel\.extraReferenceItems, extraReferencePreviewUrls, onRemoveExtraReferenceFile\)/);
  assert.match(importPanelSource, /onRemove\(index\)/);
});
