import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PromptBar keeps adaptive composer registry wiring aligned with dedicated prompt-bar modules', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const modeSwitcherSource = readSource('src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx');
  const modePanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');
  const promptToolsSource = readSource('src/components/layout/prompt-bar/DesktopComposerPromptTools.tsx');

  assert.match(promptBarSource, /PROMPT_BAR_MODE_REGISTRY/);
  assert.match(promptBarSource, /getPromptBarModeOption/);
  assert.match(promptBarSource, /getPromptBarModePatch/);
  assert.match(promptBarSource, /from '\.\/prompt-bar\/composerModeRegistry';/);
  assert.match(promptBarSource, /import DesktopComposerModeSwitcher from '\.\/prompt-bar\/DesktopComposerModeSwitcher';/);
  assert.match(promptBarSource, /import DesktopComposerModePanel from '\.\/prompt-bar\/DesktopComposerModePanel';/);
  assert.match(promptBarSource, /import DesktopComposerPromptTools from '\.\/prompt-bar\/DesktopComposerPromptTools';/);
  assert.match(promptBarSource, /const modeOptions = PROMPT_BAR_MODE_REGISTRY;/);
  assert.match(promptBarSource, /const activeModeOption = getPromptBarModeOption\(activePromptBarMode\);/);
  assert.match(promptBarSource, /\.\.\.getPromptBarModePatch\(previousConfig, mode\),/);
  assert.doesNotMatch(promptBarSource, /const modeOptions = useMemo\(\(\) => \(\[/);

  assert.match(modeSwitcherSource, /modeOptions\.map\(\(item\) =>/);
  assert.match(modeSwitcherSource, /const isActive = activeMode === item\.mode;/);
  assert.match(modeSwitcherSource, /onSelectMode\(item\.mode\)/);

  assert.match(modePanelSource, /networkControls\?: React\.ReactNode;/);
  assert.match(modePanelSource, /optionsPanelContent: React\.ReactNode;/);
  assert.match(modePanelSource, /onToggleOptionsPanel: \(\) => void;/);

  assert.match(promptToolsSource, /showPptOutlinePanel: boolean;/);
  assert.match(promptToolsSource, /onTogglePptOutlinePanel: \(\) => void;/);
  assert.match(promptToolsSource, /onTogglePromptOptimization: \(\) => void;/);
  assert.match(promptToolsSource, /pptOutlinePanel\?: React\.ReactNode;/);
  assert.match(promptToolsSource, /config\.enablePromptOptimization/);
  assert.match(promptToolsSource, /GenerationMode\.PPT/);
});

test('prompt bar mode registry keeps desktop top-level modes aligned with current media and ecommerce workflows', () => {
  const registrySource = readSource('src/components/layout/prompt-bar/composerModeRegistry.ts');

  assert.match(registrySource, /GenerationMode\.IMAGE/);
  assert.match(registrySource, /GenerationMode\.VIDEO/);
  assert.match(registrySource, /GenerationMode\.ECOMMERCE/);
  assert.match(registrySource, /GenerationMode\.AUDIO/);
  assert.match(registrySource, /GenerationMode\.PPT/);
  assert.match(registrySource, /PackageOpen/);
});
