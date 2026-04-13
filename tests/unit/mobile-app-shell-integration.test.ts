import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('App integrates a dedicated mobile app shell instead of routing mobile through MobileTabBar navigation', () => {
  const appSource = readSource('src/App.tsx');

  assert.match(appSource, /MobileAppShell/);
  assert.match(appSource, /<MobileAppShell/);
  assert.doesNotMatch(appSource, /<MobileTabBar/);
});

test('mobile component barrel exports the dedicated app shell entry', () => {
  const mobileIndexSource = readSource('src/components/mobile/index.ts');

  assert.match(mobileIndexSource, /export \{ default as MobileAppShell \} from '\.\/MobileAppShell';/);
});
