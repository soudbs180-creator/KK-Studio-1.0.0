import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce build keeps one framework workbench visible while child task cards stay hidden', () => {
  const buildRuntimeSource = readSource('apps/web/src/app/useEcommerceBuildRuntime.ts');
  const appSource = readSource('apps/web/src/App.tsx');
  const promptGroupLayoutSource = readSource('apps/web/src/app/usePromptGroupLayout.ts');

  assert.match(
    buildRuntimeSource,
    /hiddenInCanvas:\s*Boolean\(params\.frameworkId\)/,
    'main-image and A+ module cards are hidden once they belong to the visible framework workbench',
  );
  assert.match(
    buildRuntimeSource,
    /hiddenInCanvas:\s*Boolean\(frameworkId\)/,
    'framework-owned group helper cards can remain hidden',
  );
  assert.doesNotMatch(
    appSource,
    /n\.mode === GenerationMode\.ECOMMERCE[\s\S]{0,120}n\.ecommerce\?\.frameworkId[\s\S]{0,120}n\.ecommerce\.kind !== 'framework'/,
    'canvas viewport filtering must not use the old child-card visibility rule',
  );
  assert.match(appSource, /ecommerceFrameworkTaskNodesById/);
  assert.match(appSource, /ecommerceFrameworkTaskNodes=\{ecommerceFrameworkTaskNodesById\.get\(renderedPromptNode\.id\) \|\| \[\]\}/);
  assert.doesNotMatch(
    promptGroupLayoutSource,
    /promptNode\.mode === GenerationMode\.ECOMMERCE[\s\S]{0,120}promptNode\.ecommerce\?\.frameworkId[\s\S]{0,120}promptNode\.ecommerce\.kind !== 'framework'/,
    'prompt group layout must not reintroduce the old child-card visibility rule',
  );
});

test('ecommerce post-build controls are localized instead of hard-coded English', () => {
  const cardActionsSource = readSource('apps/web/src/components/ecommerce/EcommerceCardActions.tsx');
  const desktopPanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const buildRuntimeSource = readSource('apps/web/src/app/useEcommerceBuildRuntime.ts');

  assert.match(cardActionsSource, /import \{ useLocale \} from '..\/..\/context\/LocaleContext';/);
  assert.match(cardActionsSource, /const \{ pick \} = useLocale\(\);/);
  assert.doesNotMatch(cardActionsSource, />Start queue</);
  assert.doesNotMatch(cardActionsSource, />Generate desktop</);
  assert.doesNotMatch(cardActionsSource, />Confirm desktop</);

  assert.match(desktopPanelSource, /import \{ useLocale \} from '..\/..\/..\/context\/LocaleContext';/);
  assert.match(desktopPanelSource, /const \{ pick \} = useLocale\(\);/);
  assert.doesNotMatch(desktopPanelSource, />Canvas framework</);
  assert.doesNotMatch(desktopPanelSource, />PromptBar companion</);
  assert.doesNotMatch(desktopPanelSource, /activeFrameworkId \? 'Framework linked'/);

  assert.doesNotMatch(buildRuntimeSource, /notify\.success\('Build complete', `Created \$\{count\} ecommerce cards\.`/);
  assert.doesNotMatch(buildRuntimeSource, /notify\.error\('Build failed', error instanceof Error \? error\.message : 'Please try again later\.'\)/);
});
