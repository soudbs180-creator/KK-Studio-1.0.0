import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('local api management exposes one provider add entry instead of direct presets', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');

  assert.match(source, /const beginCreateOfficial = \(provider: OfficialProvider = 'Google'\) =>/);
  assert.doesNotMatch(source, /const existingOfficialByProvider = useMemo\(/);
  assert.doesNotMatch(source, /data-testid="api-official-provider-preset-google"/);
  assert.doesNotMatch(source, /data-testid="api-official-provider-preset-openai"/);
  assert.doesNotMatch(source, /data-testid="api-official-empty-create"/);
  assert.match(source, /data-testid="api-simple-provider-add"/);
  assert.match(source, /data-testid="api-official-provider-add"/);
  assert.match(source, /data-testid="api-proxy-provider-add"/);
  assert.match(source, /onClick=\{handleCreateOfficialAction\}/);
  assert.match(source, /Add API/);
  assert.match(source, /Official routes use built-in URLs\. Proxy providers need a name, request URL, and API key\./);
});
