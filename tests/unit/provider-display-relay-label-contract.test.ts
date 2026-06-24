import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf8');
}

test('provider display resolves known relay labels from centralized baseUrl aliases before stale provider labels', () => {
  const displaySource = readSource('apps/web/src/utils/providerDisplay.ts');
  const registrySource = readSource('apps/web/src/services/api/providerRegistry.ts');

  assert.match(registrySource, /PROVIDER_HOST_ALIAS_RULES/);
  assert.match(registrySource, /openrouter\\\.ai/);
  assert.match(registrySource, /apimart\\\.ai/);
  assert.match(registrySource, /gpt-best\\\.com/);
  assert.match(registrySource, /wuyinkeji\\\.com/);
  assert.match(registrySource, /12ai\\\.org/);
  assert.match(registrySource, /resolveProviderAliasFromBaseUrl/);

  assert.match(displaySource, /resolveProviderAliasFromBaseUrl\(target\.baseUrl\)/);
  assert.match(displaySource, /if \(relayProviderFromBaseUrl\) \{/);
  assert.match(displaySource, /getProviderMetadata\(relayProviderFromBaseUrl\)/);
  assert.doesNotMatch(displaySource, /RELAY_HOST_PROVIDER_ALIASES/);
});

test('provider display uses relay-aware provider metadata instead of treating all OpenAI-compatible routes as OpenAI', () => {
  const source = readSource('apps/web/src/utils/providerDisplay.ts');

  assert.match(source, /import \{ getProviderMetadata, resolveProviderAliasFromBaseUrl \} from '..\/services\/api\/providerRegistry'/);
  assert.match(source, /metadata\.kind === 'relay'/);
  assert.doesNotMatch(source, /openrouter[\s\S]{0,80}OpenAI Official/i);
});
