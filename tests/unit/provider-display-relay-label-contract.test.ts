import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('provider display resolves known relay labels from baseUrl before stale provider labels', () => {
  const source = readSource('apps/web/src/utils/providerDisplay.ts');

  assert.match(source, /RELAY_HOST_PROVIDER_ALIASES/);
  assert.match(source, /openrouter\\\.ai/);
  assert.match(source, /apimart\\\.ai/);
  assert.match(source, /gpt-best\\\.com/);
  assert.match(source, /wuyinkeji\\\.com/);
  assert.match(source, /12ai\\\.org/);

  assert.match(source, /resolveRelayProviderFromBaseUrl\(target\.baseUrl\)/);
  assert.match(source, /if \(relayProviderFromBaseUrl\) \{/);
  assert.match(source, /getProviderMetadata\(relayProviderFromBaseUrl\)/);
});

test('provider display uses relay-aware provider metadata instead of treating all OpenAI-compatible routes as OpenAI', () => {
  const source = readSource('apps/web/src/utils/providerDisplay.ts');

  assert.match(source, /import \{ getProviderMetadata \} from '..\/services\/api\/providerRegistry'/);
  assert.match(source, /metadata\.kind === 'relay'/);
  assert.doesNotMatch(source, /openrouter[\s\S]{0,80}OpenAI Official/i);
});
