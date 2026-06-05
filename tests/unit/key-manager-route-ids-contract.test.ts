import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type RouteIdModule = {
  buildProviderRouteId: (baseModelId: string, providerId: string) => string;
  buildStableSystemRouteId: (baseModelId: string, providerId?: string, fallbackIndex?: number) => string;
  buildUserSlotRouteId: (baseModelId: string, slotId: string) => string;
  decodeRouteSuffix: (suffix: string | null | undefined) => string;
  extractSlotRouteTarget: (suffix: string | null | undefined) => string | null;
  matchesProviderRouteSuffix: (
    provider: { id: string; name: string; legacyIds?: string[] },
    suffix: string | null | undefined,
  ) => boolean;
  matchesSlotRouteSuffix: (
    slot: { id: string; name: string; provider: string; legacyIds?: string[]; proxyConfig?: { serverName?: string } },
    suffix: string | null | undefined,
  ) => boolean;
};



async function loadRouteIdHelpers(): Promise<RouteIdModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerRouteIds.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerRouteIds.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerRouteIds.ts') as RouteIdModule;
}

test('key manager route id helpers live outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerRouteIds.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-route-ids-contract\.test\.ts/);
  assert.match(helperSource, /export function decodeRouteSuffix/);
  assert.match(helperSource, /export function matchesSlotRouteSuffix/);
  assert.match(helperSource, /export function buildProviderRouteId/);
  assert.match(keyManagerSource, /from '\.\/keyManagerRouteIds';/);
  assert.doesNotMatch(keyManagerSource, /function extractSlotRouteTarget/);
  assert.doesNotMatch(keyManagerSource, /function buildStableSystemRouteId/);
});

test('route suffix helpers preserve slot and provider matching behavior', async () => {
  const {
    decodeRouteSuffix,
    extractSlotRouteTarget,
    matchesProviderRouteSuffix,
    matchesSlotRouteSuffix,
  } = await loadRouteIdHelpers();

  assert.equal(decodeRouteSuffix(' SLOT_%41BC '), 'slot_Abc');
  assert.equal(decodeRouteSuffix('%E0%A4%A'), '%e0%a4%a');
  assert.equal(extractSlotRouteTarget('slot_key_ABC'), 'key_abc');
  assert.equal(extractSlotRouteTarget('slot_ABC'), 'abc');
  assert.equal(extractSlotRouteTarget('provider_ABC'), 'provider_abc');
  assert.equal(extractSlotRouteTarget('plain'), null);

  const slot = {
    id: 'google-1017-1',
    legacyIds: ['key_abc'],
    name: 'Main Route',
    provider: 'Proxy',
    proxyConfig: { serverName: 'server-x' },
  };

  assert.equal(matchesSlotRouteSuffix(slot, 'slot_key_ABC'), true);
  assert.equal(matchesSlotRouteSuffix(slot, 'main route'), true);
  assert.equal(matchesSlotRouteSuffix(slot, 'server-x'), true);
  assert.equal(matchesSlotRouteSuffix(slot, 'proxy'), true);
  assert.equal(matchesSlotRouteSuffix(slot, 'slot_main route'), false);

  const provider = { id: 'custom-2000-1', legacyIds: ['provider_contract'], name: 'Contract Provider' };
  assert.equal(matchesProviderRouteSuffix(provider, 'provider_contract'), true);
  assert.equal(matchesProviderRouteSuffix(provider, 'custom-2000-1'), true);
  assert.equal(matchesProviderRouteSuffix(provider, 'contract provider'), true);
  assert.equal(matchesProviderRouteSuffix(provider, 'provider_contract provider'), false);
});

test('route id builders preserve stable encoded route ids', async () => {
  const {
    buildProviderRouteId,
    buildStableSystemRouteId,
    buildUserSlotRouteId,
  } = await loadRouteIdHelpers();

  assert.equal(buildStableSystemRouteId(' gpt-4o '), 'gpt-4o@system');
  assert.equal(buildStableSystemRouteId('gpt-4o', undefined, 1), 'gpt-4o@system');
  assert.equal(buildStableSystemRouteId('gpt-4o', undefined, 2), 'gpt-4o@system_2');
  assert.equal(buildStableSystemRouteId('gpt-4o', 'provider A/B'), 'gpt-4o@system_provider%20A%2FB');
  assert.equal(buildUserSlotRouteId(' gemini-2.5 ', ' slot A/B '), 'gemini-2.5@slot_slot%20A%2FB');
  assert.equal(buildProviderRouteId('gpt-4o', 'contract'), 'gpt-4o@provider_contract');
  assert.equal(buildProviderRouteId('gpt-4o', 'provider_contract'), 'gpt-4o@provider_contract');
});
