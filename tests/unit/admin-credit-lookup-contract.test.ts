import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createKkApiClient } from '../../packages/contracts/src/index.ts';

test('billing dto exports the admin credit-account lookup response', () => {
  const publicIndexSource = readFileSync('packages/contracts/src/index.ts', 'utf8');
  const client = createKkApiClient({ baseUrl: 'https://admin.example.com' });

  assert.match(publicIndexSource, /export \* from "\.\/dto\/billing\.ts";/);
  assert.equal(typeof client.getAdminCreditAccount, 'function');
});

test('billing route source registers the admin credit-account lookup handler', () => {
  const routes = readFileSync('apps/api/src/modules/billing/presentation/http-billing-routes.ts', 'utf8');
  const server = readFileSync('apps/api/src/server.ts', 'utf8');

  assert.match(routes, /handleGetAdminCreditAccount/);
  assert.match(server, /\/api\/v1\/admin\/billing\/accounts\//);
});
