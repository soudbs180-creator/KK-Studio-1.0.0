import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('PromptNodeComponent does not retain source-proven unused locals', () => {
  const source = readSource('apps/web/src/components/canvas/PromptNodeComponent.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/prompt-node-unused-cleanup-contract\.test\.ts/);
  assert.match(source, /const PromptNodeComponent: React\.FC<PromptNodeProps>/);

  assert.doesNotMatch(source, /import \{[^\n]*\bPin\b/);
  assert.doesNotMatch(source, /import \{[^\n]*\bChevronRight\b/);
  assert.doesNotMatch(source, /\n\s+onPositionChange,/);
  assert.doesNotMatch(source, /\n\s+sourcePosition,/);
  assert.match(source, /showError && onRetry/);
  assert.match(source, /aria-label="Retry failed card"/);
  assert.doesNotMatch(source, /\n\s+ioTrace,/);
  assert.doesNotMatch(source, /\n\s+onOpenStorageSettings,/);
  assert.doesNotMatch(source, /\n\s+onDisconnect,/);
  assert.doesNotMatch(source, /\n\s+onPin,/);
  assert.doesNotMatch(source, /\bshowErrorDetails\b/);
  assert.doesNotMatch(source, /\bshowTraceDetails\b/);
});
