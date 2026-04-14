import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();
const MOBILE_APP_SHELL_PATH = 'src/components/mobile/MobileAppShell.tsx';

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('mobile component index exports MobileAppShell', () => {
  const indexSource = readSource('src/components/mobile/index.ts');

  assert.match(indexSource, /export \{ default as MobileAppShell \} from '\.\/MobileAppShell';/);
});

test('MobileAppShell keeps the mobile three-layer slot contract and stays tab-bar agnostic', () => {
  const shellExists = existsSync(path.join(ROOT_DIR, MOBILE_APP_SHELL_PATH));

  assert.equal(shellExists, true, 'expected MobileAppShell.tsx to exist');

  if (!shellExists) {
    return;
  }

  const shellSource = readSource(MOBILE_APP_SHELL_PATH);

  assert.match(shellSource, /interface MobileAppShellProps\s*\{/);
  assert.match(shellSource, /header:\s*ReactNode;/);
  assert.match(shellSource, /feed:\s*ReactNode;/);
  assert.match(shellSource, /composer:\s*ReactNode;/);
  assert.match(shellSource, /overlays\?:\s*ReactNode;/);
  assert.match(shellSource, /data-testid="mobile-app-shell"/);
  assert.match(shellSource, /data-slot="header"/);
  assert.match(shellSource, /data-slot="feed"/);
  assert.match(shellSource, /data-slot="composer"/);
  assert.match(shellSource, /data-slot="overlays"/);
  assert.match(shellSource, /min-h-dvh/);
  assert.match(shellSource, /env\(safe-area-inset-top\)/);
  assert.match(shellSource, /env\(safe-area-inset-bottom\)/);
  assert.match(
    shellSource,
    /gridTemplateRows:\s*'minmax\(0, var\(--mobile-home-header-share, 10fr\)\) minmax\(0, var\(--mobile-home-feed-share, 60fr\)\) minmax\(0, var\(--mobile-home-composer-share, 30fr\)\)'/,
  );
  assert.doesNotMatch(shellSource, /sticky top-0/);
  assert.doesNotMatch(shellSource, /sticky bottom-0/);
  assert.doesNotMatch(shellSource, /MobileTabBar/);
});
