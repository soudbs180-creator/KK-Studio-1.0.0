import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSource } from '../support/workspacePaths.js';

test('desktop settings console keeps a real inner scroll container and viewport-safe sizing', () => {
  const shellSource = readSource('apps/web/src/components/settings/SettingsWorkbenchShell.tsx');
  const cssSource = readSource('apps/web/src/styles/settings-console.css');

  assert.match(shellSource, /const scrollRef = useRef<HTMLElement \| null>\(null\);/);
  assert.match(shellSource, /scrollRef\.current\?\.scrollTo\(\{ top: 0 \}\);/);
  assert.match(shellSource, /className="settings-console-content"/);
  assert.match(cssSource, /--console-sidebar-width: 232px;/);
  assert.match(cssSource, /--console-topbar-height: 64px;/);
  assert.match(cssSource, /width: min\(1360px, calc\(100vw - var\(--chat-sidebar-width, 0px\) - 32px\)\);/);
  assert.match(cssSource, /height: calc\(100dvh - 32px\);/);
  assert.match(cssSource, /\.settings-console-content \{[\s\S]*overflow-y: auto;[\s\S]*overflow-x: hidden;/);
});

test('settings console uses neutral light and dark surfaces', () => {
  const cssSource = readSource('apps/web/src/styles/settings-console.css');

  assert.match(cssSource, /--console-page: rgb\(244 245 246\);/);
  assert.match(cssSource, /--console-surface: rgb\(255 255 255\);/);
  assert.match(cssSource, /body\.dark-mode \.settings-panel,[\s\S]*--console-page: rgb\(10 11 13\);/);
  assert.match(cssSource, /--console-surface: rgb\(20 21 24\);/);
});

test('settings console removes glass and heavy card shadows', () => {
  const cssSource = readSource('apps/web/src/styles/settings-console.css');

  assert.match(cssSource, /\.console-card,[\s\S]*box-shadow: none !important;[\s\S]*backdrop-filter: none !important;/);
  assert.doesNotMatch(cssSource, /backdrop-filter: blur\(/);
  assert.doesNotMatch(cssSource, /linear-gradient\(/);
});
