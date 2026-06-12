import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readServerSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, 'server', relativePath), 'utf8');
}

test('platform image route rejects local user API requests before credit pricing or deduction', () => {
  const controllerSource = readServerSource('lib/generation/generationController.js');
  const sagaSource = readServerSource('lib/generation/generationBillingSaga.js');
  
  const guardIndex = controllerSource.indexOf("executionLane === 'local-user-api'");
  const executeIndex = controllerSource.indexOf('billingSaga.execute');
  const costIndex = sagaSource.indexOf('credits.getOperationCost');
  const balanceIndex = sagaSource.indexOf('credits.getUserCredits(userId)');
  const deductIndex = sagaSource.indexOf('credits.deductCredits');

  assert.ok(guardIndex > -1, 'client settlement guard should exist');
  assert.ok(executeIndex > -1, 'billing saga execution call should exist');
  assert.ok(guardIndex < executeIndex, 'client settlement must be rejected before calling billing saga');
  assert.ok(costIndex > -1, 'server pricing lookup should still exist');
  assert.ok(balanceIndex > -1, 'server balance preflight should exist');
  assert.ok(deductIndex > -1, 'server credit deduction should still exist');
  assert.ok(costIndex < balanceIndex, 'pricing lookup must happen before balance preflight');
  assert.ok(balanceIndex < deductIndex, 'insufficient credits must be rejected before credit deduction');
  assert.match(controllerSource, /No credits were charged/);
});

test('platform chat route rejects local user API requests before credit pricing or deduction', () => {
  const source = readServerSource('routes/chat.js');
  const dispatcherSource = readServerSource('lib/dispatcher/index.js');
  const guardIndex = source.indexOf("parsed.data.executionLane === 'local-user-api'");
  const dispatchIndex = source.indexOf('BackendDispatcher.dispatch');
  const costIndex = dispatcherSource.indexOf('credits.getOperationCost');
  const balanceIndex = dispatcherSource.indexOf('credits.getUserCredits(userId)');
  const deductIndex = dispatcherSource.indexOf('credits.deductCredits');

  assert.ok(guardIndex > -1, 'client settlement guard should exist');
  assert.ok(dispatchIndex > -1, 'cloud-credit chat should still delegate to the server dispatcher');
  assert.ok(costIndex > -1, 'dispatcher pricing lookup should still exist');
  assert.ok(balanceIndex > -1, 'dispatcher balance preflight should exist');
  assert.ok(deductIndex > -1, 'dispatcher credit deduction should still exist');
  assert.ok(guardIndex < dispatchIndex, 'client settlement must be rejected before dispatcher pricing');
  assert.ok(costIndex < balanceIndex, 'dispatcher pricing lookup must happen before balance preflight');
  assert.ok(balanceIndex < deductIndex, 'dispatcher insufficient credits must be rejected before credit deduction');
  assert.match(source, /sendInsufficientCredits\(res, err\.credits, err\.creditsCost(?:, \w+)?\)/);
  assert.match(source, /No credits were charged/);
});
