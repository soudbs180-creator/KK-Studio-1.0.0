import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readServerSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, 'server', relativePath), 'utf8');
}

test('platform image route rejects local user API requests before credit pricing or deduction', () => {
  const source = readServerSource('routes/generate-image.js');
  const guardIndex = source.indexOf("executionLane === 'local-user-api'");
  const costIndex = source.indexOf('credits.getOperationCost');
  const balanceIndex = source.indexOf('credits.getUserCredits(userId)');
  const deductIndex = source.indexOf('credits.deductCredits');

  assert.ok(guardIndex > -1, 'client settlement guard should exist');
  assert.ok(costIndex > -1, 'server pricing lookup should still exist');
  assert.ok(balanceIndex > -1, 'server balance preflight should exist');
  assert.ok(deductIndex > -1, 'server credit deduction should still exist');
  assert.ok(guardIndex < costIndex, 'client settlement must be rejected before pricing lookup');
  assert.ok(costIndex < balanceIndex, 'pricing lookup must happen before balance preflight');
  assert.ok(balanceIndex < deductIndex, 'insufficient credits must be rejected before credit deduction');
  assert.ok(guardIndex < deductIndex, 'client settlement must be rejected before credit deduction');
  assert.match(source, /sendInsufficientCredits\(res, availableCredits, requiredCredits\)/);
  assert.match(source, /No credits were charged/);
});

test('platform chat route rejects local user API requests before credit pricing or deduction', () => {
  const source = readServerSource('routes/chat.js');
  const guardIndex = source.indexOf("parsed.data.executionLane === 'local-user-api'");
  const costIndex = source.indexOf('credits.getOperationCost');
  const balanceIndex = source.indexOf('credits.getUserCredits(userId)');
  const deductIndex = source.indexOf('credits.deductCredits');

  assert.ok(guardIndex > -1, 'client settlement guard should exist');
  assert.ok(costIndex > -1, 'server pricing lookup should still exist');
  assert.ok(balanceIndex > -1, 'server balance preflight should exist');
  assert.ok(deductIndex > -1, 'server credit deduction should still exist');
  assert.ok(guardIndex < costIndex, 'client settlement must be rejected before pricing lookup');
  assert.ok(costIndex < balanceIndex, 'pricing lookup must happen before balance preflight');
  assert.ok(balanceIndex < deductIndex, 'insufficient credits must be rejected before credit deduction');
  assert.ok(guardIndex < deductIndex, 'client settlement must be rejected before credit deduction');
  assert.match(source, /sendInsufficientCredits\(res, availableCredits, requiredCredits\)/);
  assert.match(source, /No credits were charged/);
});
