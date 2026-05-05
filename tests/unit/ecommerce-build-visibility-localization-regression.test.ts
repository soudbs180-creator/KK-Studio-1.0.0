import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce build keeps generated module cards visible on the canvas', () => {
  const buildRuntimeSource = readSource('src/app/useEcommerceBuildRuntime.ts');
  const appSource = readSource('src/App.tsx');
  const promptGroupLayoutSource = readSource('src/app/usePromptGroupLayout.ts');

  assert.doesNotMatch(
    buildRuntimeSource,
    /hiddenInCanvas:\s*Boolean\(params\.frameworkId\)/,
    'main-image and A+ module cards must not be hidden just because they belong to a framework',
  );
  assert.match(
    buildRuntimeSource,
    /hiddenInCanvas:\s*Boolean\(frameworkId\)/,
    'framework-owned group helper cards can remain hidden',
  );
  assert.doesNotMatch(
    appSource,
    /n\.mode === GenerationMode\.ECOMMERCE[\s\S]{0,120}n\.ecommerce\?\.frameworkId[\s\S]{0,120}n\.ecommerce\.kind !== 'framework'/,
    'canvas viewport filtering must not hide framework child task cards',
  );
  assert.doesNotMatch(
    promptGroupLayoutSource,
    /promptNode\.mode === GenerationMode\.ECOMMERCE[\s\S]{0,120}promptNode\.ecommerce\?\.frameworkId[\s\S]{0,120}promptNode\.ecommerce\.kind !== 'framework'/,
    'prompt group layout must keep framework child task cards eligible for rendering',
  );
});

test('ecommerce post-build controls are localized instead of hard-coded English', () => {
  const cardActionsSource = readSource('src/components/ecommerce/EcommerceCardActions.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const buildRuntimeSource = readSource('src/app/useEcommerceBuildRuntime.ts');

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
