import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

async function loadProfileRouteResolver() {
  const imported = await import('../../services/api/routes/user/shared/profileRouteResolver.js');
  return imported.default || imported;
}

test('profile route resolution prefers the owner-scoped Provider Connection', async () => {
  const { resolveProfileUserRoute } = await loadProfileRouteResolver();
  const calls: string[] = [];
  const profileState = { slots: [{ id: 'legacy-route' }] };
  const route = await resolveProfileUserRoute('owner-1', profileState, 'route-1', {
    async resolveProviderConnectionLegacyRoute(ownerId: string, routeId: string) {
      calls.push(`new:${ownerId}:${routeId}`);
      return { id: 'connection-route', apiKey: 'new-secret' };
    },
    resolveRouteFromProfileState() {
      calls.push('legacy');
      return { id: 'legacy-route', apiKey: 'legacy-secret' };
    },
  });

  assert.equal(route.id, 'connection-route');
  assert.deepEqual(calls, ['new:owner-1:route-1']);
});

test('profile route resolution preserves the already-loaded legacy fallback', async () => {
  const { resolveProfileUserRoute } = await loadProfileRouteResolver();
  const profileState = { slots: [{ id: 'legacy-route' }] };
  let receivedProfileState: unknown;
  const route = await resolveProfileUserRoute('owner-1', profileState, 'route-1', {
    async resolveProviderConnectionLegacyRoute() {
      return null;
    },
    resolveRouteFromProfileState(candidate: unknown) {
      receivedProfileState = candidate;
      return { id: 'legacy-route', apiKey: 'legacy-secret' };
    },
  });

  assert.equal(route.id, 'legacy-route');
  assert.equal(receivedProfileState, profileState);
});

test('profile route resolution does not bypass a selected Connection failure', async () => {
  const { resolveProfileUserRoute } = await loadProfileRouteResolver();
  let legacyCalls = 0;

  await assert.rejects(resolveProfileUserRoute('owner-1', {}, 'route-1', {
    async resolveProviderConnectionLegacyRoute() {
      const error = new Error('selected Connection is unavailable');
      Reflect.set(error, 'code', 'CONNECTION_SECRET_UNAVAILABLE');
      throw error;
    },
    resolveRouteFromProfileState() {
      legacyCalls += 1;
      return { id: 'legacy-route' };
    },
  }), (error: unknown) => error instanceof Error
    && Reflect.get(error, 'code') === 'CONNECTION_SECRET_UNAVAILABLE');

  assert.equal(legacyCalls, 0);
});

test('every profile-owned Provider execution lookup uses the owner-aware resolver', () => {
  const source = fs.readFileSync('services/api/routes/user/profile.js', 'utf8');
  const ownerAwareCalls = source.match(/resolveProfileUserRoute\(req\.profileUserId, profileState,/g) || [];

  assert.match(source, /require\('\.\/shared\/profileRouteResolver'\)/);
  assert.equal(ownerAwareCalls.length, 10);
  assert.doesNotMatch(source, /resolveLocalUserRoute\(/);
});
