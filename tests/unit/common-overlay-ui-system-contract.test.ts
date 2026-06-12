import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('common overlay primitives expose tokenized lazy, tutorial, and startup surfaces', () => {
  const cssSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  for (const token of [
    '--kk-lazy-boundary-overlay-bg',
    '--kk-lazy-boundary-panel-bg',
    '--kk-workspace-startup-bg',
    '--kk-workspace-startup-block-bg',
    '--kk-workspace-startup-panel-bg',
    '--kk-workspace-startup-warning-bg',
  ]) {
    assert.match(cssSource, new RegExp(`${token}:`), `missing ${token}`);
  }

  for (const selector of [
    '.kk-lazy-boundary-overlay',
    '.kk-lazy-boundary-panel',
    '.kk-tutorial-overlay-root',
    '.kk-workspace-startup-skeleton',
    '.kk-workspace-startup-block',
    '.kk-workspace-startup-panel',
    '.kk-workspace-startup-warning',
  ]) {
    assert.match(cssSource, new RegExp(selector.replace('.', '\\.')), `missing ${selector}`);
  }
});

test('common overlay components use KK_LAYER and avoid raw overlay colors', () => {
  const lazySource = readSource('apps/web/src/components/common/LazyModuleBoundary.tsx');
  const tutorialSource = readSource('apps/web/src/components/common/TutorialOverlay.tsx');
  const startupSource = readSource('apps/web/src/components/common/WorkspaceStartupSkeleton.tsx');

  for (const source of [lazySource, tutorialSource, startupSource]) {
    assert.match(source, /import\s+\{\s*KK_LAYER\s*\}\s+from\s+'@kk\/ui'/);
    assert.doesNotMatch(source, /z-\[99999\]|z-\[130\]|z-\[110\]/);
    assert.doesNotMatch(source, /rgba\(|#[0-9a-fA-F]{3,8}|bg-black\//);
  }

  assert.match(lazySource, /className=\{wrapperClassName\}/);
  assert.match(lazySource, /kk-lazy-boundary-overlay/);
  assert.match(lazySource, /zIndex:\s*KK_LAYER\.toolbar/);

  assert.match(tutorialSource, /className="kk-tutorial-overlay-root/);
  assert.match(tutorialSource, /zIndex:\s*KK_LAYER\.fullscreen/);

  assert.match(startupSource, /className="kk-workspace-startup-skeleton/);
  assert.match(startupSource, /zIndex:\s*KK_LAYER\.toolbar/);
  assert.match(startupSource, /kk-workspace-startup-block/);
});
