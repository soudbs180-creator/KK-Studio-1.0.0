import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

const extractExport = (source: string, name: string) => {
  const start = source.indexOf(`export const ${name}`);
  assert.notEqual(start, -1, `${name} export should exist`);

  const next = source.indexOf('\n// ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
};

test('shared settings controls use CSS primitives instead of local paint logic', () => {
  const uiSource = readSource('apps/web/src/components/settings/ui/index.tsx');
  const cssSource = readSource('apps/web/src/styles/settings.css');

  const iconButtonBlock = extractExport(uiSource, 'IconButton');
  const progressBlock = extractExport(uiSource, 'ProgressBar');
  const statusBadgeBlock = extractExport(uiSource, 'StatusBadge');

  assert.match(iconButtonBlock, /settings-icon-button/);
  assert.match(iconButtonBlock, /data-variant=\{variant\}/);
  assert.doesNotMatch(iconButtonBlock, /variantStyles|backgroundColor|borderColor|color:\s*'|style=\{\{/);

  assert.match(progressBlock, /settings-progress/);
  assert.match(progressBlock, /settings-progress__track/);
  assert.match(progressBlock, /settings-progress__bar/);
  assert.match(progressBlock, /data-tone=\{tone\}/);
  assert.doesNotMatch(progressBlock, /rgb\(|#[0-9a-fA-F]{3,8}|toneColors|boxShadow/);

  assert.match(statusBadgeBlock, /settings-status-badge/);
  assert.match(statusBadgeBlock, /data-status=\{status\}/);
  assert.match(statusBadgeBlock, /settings-status-badge__dot/);
  assert.doesNotMatch(statusBadgeBlock, /#[0-9a-fA-F]{3,8}|`\$\{config\.color\}|backgroundColor|borderColor|color:\s*config/);

  assert.match(cssSource, /\.settings-panel \.settings-icon-button\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-icon-button\[data-variant="active"\]\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-progress__bar\[data-tone="emerald"\]\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-status-badge\[data-status="warning"\]\s*\{/);
});

test('browser assistant settings view exposes system classes for first-screen cards', () => {
  const source = readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
  const cssSource = readSource('apps/web/src/styles/settings.css');

  assert.match(source, /settings-browser-assistant-view/);
  assert.match(source, /settings-browser-status-card/);
  assert.match(source, /settings-browser-status-card__dot/);
  assert.match(source, /data-status=\{daemonStatus\}/);
  assert.match(source, /data-status=\{extensionStatus\}/);

  assert.match(cssSource, /\.settings-panel \.settings-browser-assistant-view\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-browser-status-card\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-browser-status-card__dot\[data-status="connected"\]\s*\{/);
  assert.match(cssSource, /\.settings-panel \.settings-browser-action\s*\{/);
});
