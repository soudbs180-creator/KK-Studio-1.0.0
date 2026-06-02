import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('SystemLogsView variants do not retain source-proven unused locals', () => {
  const desktopSource = readSource('apps/web/src/components/settings/views/SystemLogsView.tsx');
  const localizedSource = readSource('apps/web/src/components/settings/views/SystemLogsView.localized.tsx');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/system-logs-unused-cleanup-contract\.test\.ts/);
  assert.match(desktopSource, /export const SystemLogsView: React\.FC/);
  assert.match(localizedSource, /export const SystemLogsView: React\.FC/);

  assert.doesNotMatch(desktopSource, /import \{[^\n]*\bActivity\b/);
  assert.doesNotMatch(desktopSource, /\bconst importantLogs\b/);
  assert.doesNotMatch(localizedSource, /\bconst importantLogs\b/);
});
