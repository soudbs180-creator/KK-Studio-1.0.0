import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('startup screen and storage selection modal avoid bright blue accents in the Clay settings aesthetic', () => {
  const startupScreenSource = readSource('apps/web/src/components/common/AppStartupScreen.tsx');
  const storageModalSource = readSource('apps/web/src/components/modals/StorageSelectionModal.tsx');

  assert.doesNotMatch(startupScreenSource, /text-blue-400/);
  assert.match(startupScreenSource, /data-testid="app-startup-screen"/);
  assert.match(startupScreenSource, /--app-startup-panel-bg/);
  assert.match(startupScreenSource, /--app-startup-title/);
  assert.match(startupScreenSource, /--app-startup-muted/);
  assert.doesNotMatch(startupScreenSource, /settings-reference-card/);
  assert.doesNotMatch(startupScreenSource, /var\(--settings-section-bg/);

  assert.doesNotMatch(storageModalSource, /bg-indigo-600|shadow-indigo|text-indigo-300|border-indigo-500|bg-indigo-500/);
  assert.match(
    storageModalSource,
    /var\(--storage-selection-primary-bg\)|var\(--storage-selection-option-bg\)|var\(--storage-selection-card-bg\)/,
  );
});

test('storage selection modal owns its light and dark theme surface contract', () => {
  const storageModalSource = readSource('apps/web/src/components/modals/StorageSelectionModal.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(storageModalSource, /storage-selection-modal/);
  assert.match(storageModalSource, /--storage-selection-card-bg/);
  assert.match(storageModalSource, /--storage-selection-text-primary/);
  assert.match(storageModalSource, /--storage-selection-text-secondary/);
  assert.match(storageModalSource, /--storage-selection-text-muted/);
  assert.match(storageModalSource, /--storage-selection-border/);
  assert.match(storageModalSource, /--storage-selection-option-bg/);
  assert.match(storageModalSource, /--storage-selection-overlay-bg/);

  assert.match(cssSource, /body:not\(\.dark-mode\) \.storage-selection-modal\s*\{/);
  assert.match(cssSource, /body\.dark-mode \.storage-selection-modal\s*\{/);
  assert.match(cssSource, /--storage-selection-card-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /--storage-selection-text-primary:\s*var\(--clay-ink\);/);
  assert.match(cssSource, /--storage-selection-primary-bg:\s*var\(--clay-ink\);/);
  assert.match(cssSource, /body\.dark-mode \.storage-selection-modal\s*\{[\s\S]*--storage-selection-card-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /--storage-selection-text-primary:\s*#fffaf0;/);
  assert.match(cssSource, /--storage-selection-primary-bg:\s*#fffaf0;/);
  assert.doesNotMatch(cssSource, /--storage-selection-primary-bg:\s*#4f90f0;/);
  assert.doesNotMatch(cssSource, /--storage-selection-shadow:\s*0 16px 36px/);

  const modalBody = storageModalSource.slice(storageModalSource.indexOf('return ('));
  assert.doesNotMatch(modalBody, /var\(--settings-section-bg/);
  assert.doesNotMatch(modalBody, /var\(--text-primary/);
});

test('startup screen owns readable light and dark theme tokens outside settings scope', () => {
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(cssSource, /\.app-startup-screen\s*\{/);
  assert.match(cssSource, /--app-startup-panel-bg:\s*var\(--frost-card-framework-bg\);/);
  assert.match(cssSource, /--app-startup-title:\s*var\(--text-primary\);/);
  assert.match(cssSource, /--app-startup-muted:\s*var\(--text-secondary\);/);
  assert.match(cssSource, /--app-startup-warning-text:\s*var\(--state-warning-text\);/);
  assert.match(cssSource, /body\.dark-mode \.app-startup-screen\s*\{/);
  assert.match(cssSource, /--app-startup-warning-text:\s*var\(--clay-brand-peach\);/);
});

test('startup screen renders a full-screen branded launch hall instead of a tiny prompt card', () => {
  const startupScreenSource = readSource('apps/web/src/components/common/AppStartupScreen.tsx');
  const cssSource = readSource('apps/web/src/index.css');

  assert.match(startupScreenSource, /data-testid="app-startup-shell"/);
  assert.match(startupScreenSource, /data-testid="app-startup-brand-mark"/);
  assert.match(startupScreenSource, /data-testid="app-startup-progress-track"/);
  assert.match(startupScreenSource, /data-testid="app-startup-status-list"/);
  assert.match(startupScreenSource, /APP_STARTUP_STATUS_ITEMS\.map/);
  assert.match(startupScreenSource, /KK Studio is restoring your workspace/);
  assert.match(startupScreenSource, /<strong>\{progress\}%<\/strong>/);
  assert.match(startupScreenSource, /width:\s*`\$\{progress\}%`/);
  assert.doesNotMatch(startupScreenSource, /<Loader2 className="animate-spin" size=\{20\} \/>/);

  assert.match(cssSource, /\.app-startup-shell\s*\{/);
  assert.match(cssSource, /\.app-startup-card\s*\{/);
  assert.match(cssSource, /\.app-startup-card__header\s*\{/);
  assert.match(cssSource, /\.app-startup-brand-mark\s*\{/);
  assert.match(cssSource, /\.app-startup-subtitle\s*\{/);
  assert.match(cssSource, /\.app-startup-stage-line\s*\{/);
  assert.match(cssSource, /\.app-startup-progress-track\s*\{/);
  assert.match(cssSource, /\.app-startup-status-list\s*\{/);
  assert.match(cssSource, /\.app-startup-orbit\s*\{/);
  assert.match(cssSource, /\.app-startup-screen\s*\{[\s\S]*min-height:\s*100dvh/);
  assert.match(cssSource, /\.app-startup-screen\s*\{[\s\S]*place-items:\s*center/);
  assert.match(cssSource, /\.app-startup-shell\s*\{[\s\S]*width:\s*min\(640px, calc\(100vw - 32px\)\)/);
  assert.match(cssSource, /\.app-startup-card\s*\{[\s\S]*border-radius:\s*24px;[\s\S]*padding:\s*34px;/);
  assert.doesNotMatch(cssSource, /\.app-startup-shell\s*\{[\s\S]*width:\s*min\(420px/);
  assert.doesNotMatch(cssSource, /\.app-startup-message/);
  assert.doesNotMatch(cssSource, /@keyframes app-startup-progress-shine/);
});
