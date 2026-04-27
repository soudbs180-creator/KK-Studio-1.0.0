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

test('admin app exposes manual recharge submission processing route', () => {
  const routerSource = readFileSync('apps/admin/src/routes/AdminRouter.tsx', 'utf8');
  const shellSource = readFileSync('apps/admin/src/components/layout/AdminShell.tsx', 'utf8');
  const pageSource = readFileSync('apps/admin/src/pages/RechargeSubmissionsPage.tsx', 'utf8');
  const client = createKkApiClient({ baseUrl: 'https://admin.example.com' });

  assert.equal(typeof client.listAdminRechargeSubmissions, 'function');
  assert.equal(typeof client.reviewRechargeSubmission, 'function');
  assert.match(routerSource, /RechargeSubmissionsPage/);
  assert.match(routerSource, /\/recharge-submissions/);
  assert.match(shellSource, /Recharge Submissions/);
  assert.match(pageSource, /paymentMarkedAt/);
  assert.match(pageSource, /支付中/);
  assert.match(pageSource, /已入账/);
  assert.match(pageSource, /已过期/);
  assert.match(pageSource, /已拒绝/);
});
