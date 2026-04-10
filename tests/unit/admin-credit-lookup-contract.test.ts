import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('billing dto exports the admin credit-account lookup response', () => {
  const source = readFileSync('packages/contracts/src/dto/billing.ts', 'utf8');

  assert.match(source, /export interface AdminCreditAccountLookupDto/);
  assert.match(source, /transactions: CreditTransactionDto\[]/);
});

test('billing route source registers the admin credit-account lookup handler', () => {
  const routes = readFileSync('apps/api/src/modules/billing/presentation/http-billing-routes.ts', 'utf8');
  const server = readFileSync('apps/api/src/server.ts', 'utf8');

  assert.match(routes, /handleGetAdminCreditAccount/);
  assert.match(server, /\/api\/v1\/admin\/billing\/accounts\//);
});
