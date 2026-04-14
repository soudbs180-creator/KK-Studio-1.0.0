import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('startup screen and storage selection modal avoid bright blue accents in the shared gray settings aesthetic', () => {
  const startupScreenSource = readSource('src/components/common/AppStartupScreen.tsx');
  const storageModalSource = readSource('src/components/modals/StorageSelectionModal.tsx');

  assert.doesNotMatch(startupScreenSource, /text-blue-400/);
  assert.match(startupScreenSource, /var\(--text-primary\)|var\(--text-secondary\)|var\(--settings-button-secondary-text\)/);

  assert.doesNotMatch(storageModalSource, /bg-indigo-600|shadow-indigo|text-indigo-300|border-indigo-500|bg-indigo-500/);
  assert.match(
    storageModalSource,
    /var\(--settings-button-primary-bg(?:,\s*var\(--bg-elevated\))?\)|var\(--settings-button-secondary-bg(?:,\s*var\(--bg-elevated\))?\)|var\(--settings-surface-overlay(?:,\s*var\(--bg-elevated\))?\)/,
  );
});
