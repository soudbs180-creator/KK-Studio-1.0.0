import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('startup screen and storage selection modal avoid bright blue accents in the Clay settings aesthetic', () => {
  const startupScreenSource = readSource('src/components/common/AppStartupScreen.tsx');
  const storageModalSource = readSource('src/components/modals/StorageSelectionModal.tsx');

  assert.doesNotMatch(startupScreenSource, /text-blue-400/);
  assert.match(startupScreenSource, /var\(--text-primary\)|var\(--text-secondary\)|var\(--settings-button-secondary-text\)/);

  assert.doesNotMatch(storageModalSource, /bg-indigo-600|shadow-indigo|text-indigo-300|border-indigo-500|bg-indigo-500/);
  assert.match(
    storageModalSource,
    /var\(--storage-selection-primary-bg\)|var\(--storage-selection-option-bg\)|var\(--storage-selection-card-bg\)/,
  );
});

test('storage selection modal owns its light and dark theme surface contract', () => {
  const storageModalSource = readSource('src/components/modals/StorageSelectionModal.tsx');
  const cssSource = readSource('src/index.css');

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
