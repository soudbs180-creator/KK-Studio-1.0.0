import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('PromptBar ecommerce panel is wired as a framework companion instead of the primary batch control plane', () => {
  const hookSource = readSource('src/app/useAppPromptBarProps.ts');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(hookSource, /const ecommerceFrameworkSummary = React\.useMemo\(\(\) => \{/);
  assert.match(hookSource, /ecommerceFrameworkSummary,/);
  assert.match(promptBarSource, /ecommerceActiveFrameworkId\?: string \| null;/);
  assert.match(promptBarSource, /ecommerceFrameworkSummary\?: \{/);
  assert.match(promptBarSource, /frameworkSummary=\{ecommerceFrameworkSummary\}/);
  assert.match(promptBarSource, /activeFrameworkId=\{ecommerceActiveFrameworkId\}/);
  assert.match(desktopPanelSource, /type EcommerceFrameworkSummary = \{/);
  assert.match(desktopPanelSource, /frameworkSummary\?: EcommerceFrameworkSummary;/);
  assert.match(desktopPanelSource, /activeFrameworkId\?: string \| null;/);
  assert.match(desktopPanelSource, /data-testid="ecommerce-framework-companion-panel"/);
  assert.match(desktopPanelSource, /data-testid="ecommerce-framework-summary-card"/);
  assert.match(desktopPanelSource, /Canvas framework/);
});
