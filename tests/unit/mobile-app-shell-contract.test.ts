import { readSource, workspacePath } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

const MOBILE_APP_SHELL_PATH = 'apps/web/src/components/mobile/MobileAppShell.tsx';



test('mobile component index exports MobileAppShell', () => {
  const indexSource = readSource('apps/web/src/components/mobile/index.ts');

  assert.match(indexSource, /export \{ default as MobileAppShell \} from '\.\/MobileAppShell';/);
});

test('MobileAppShell keeps the adaptive three-layer slots and releases the removed tab-bar area', () => {
  const shellExists = existsSync(workspacePath(MOBILE_APP_SHELL_PATH));

  assert.equal(shellExists, true, 'expected MobileAppShell.tsx to exist');

  if (!shellExists) {
    return;
  }

  const shellSource = readSource(MOBILE_APP_SHELL_PATH);
  const tokenSource = readSource('apps/web/src/styles/kk-ui-tokens.css');

  assert.match(shellSource, /interface MobileAppShellProps\s*\{/);
  assert.match(shellSource, /header:\s*ReactNode;/);
  assert.match(shellSource, /feed:\s*ReactNode;/);
  assert.doesNotMatch(shellSource, /taskCenter/);
  assert.match(shellSource, /composer:\s*ReactNode;/);
  assert.match(shellSource, /overlays\?:\s*ReactNode;/);
  assert.match(shellSource, /data-testid="mobile-app-shell"/);
  assert.match(shellSource, /data-slot="header"/);
  assert.match(shellSource, /data-testid="mobile-header-scrim"/);
  assert.match(shellSource, /kk-mobile-header-scrim/);
  assert.match(tokenSource, /\.kk-mobile-header-scrim\s*\{[\s\S]*height:\s*calc\(100% \+ 32px\)/);
  assert.match(shellSource, /data-slot="feed"/);
  assert.match(shellSource, /data-slot="composer"/);
  assert.match(shellSource, /data-slot="overlays"/);
  assert.match(shellSource, /className="[^"]* h-dvh max-h-dvh [^"]*"/);
  assert.doesNotMatch(shellSource, /min-h-dvh/);
  assert.match(shellSource, /env\(safe-area-inset-top\)/);
  assert.match(shellSource, /env\(safe-area-inset-bottom,\s*0px\)/);
  assert.doesNotMatch(shellSource, /--mobile-tabbar-height|--mobile-tabbar-total-height/);
  assert.match(shellSource, /--mobile-content-bottom-inset': 'calc\(env\(safe-area-inset-bottom,\s*0px\) \+ 8px\)'/);
  assert.match(
    shellSource,
    /gridTemplateRows:\s*'minmax\(0, 1fr\) auto'/,
  );
  assert.doesNotMatch(shellSource, /sticky top-0/);
  assert.doesNotMatch(shellSource, /sticky bottom-0/);
  assert.doesNotMatch(shellSource, /MobileTabBar/);
});
