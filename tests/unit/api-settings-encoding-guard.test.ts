import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ApiSettingsView source does not retain mojibake literals or duplicated provider metric blocks', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');
  const metricsBlockMatches = source.split('const prioritizedMetrics: ConsoleEndpointCardMetric[] = [').length - 1;

  assert.match(source, /const UI_BUDGET_OPTIONS = \['不限额', '金额预算', UI_TOKEN_LIMIT_LABEL\] as const;/);
  assert.doesNotMatch(source, /const BUDGET_OPTIONS = \['不限额', '金额预算', TOKEN_LIMIT_LABEL\] as const;/);
  assert.ok(source.includes("if (!value.trim()) return '尚未填写';"));
  assert.ok(source.includes("if (value.length <= 10) return '已填写';"));
  assert.ok(source.includes("return `${value.slice(0, 6)}••••${value.slice(-4)}`;"));
  assert.ok(source.includes("pick('当前操作暂时无法完成。', 'The current action could not be completed right now.')"));
  assert.ok(source.includes("pick('操作失败', 'Action failed')"));
  assert.ok(!source.includes("const UI_BUDGET_OPTIONS = ['Unlimited', 'Budget', UI_TOKEN_LIMIT_LABEL] as const;"));
  assert.ok(!source.includes("pick('\u8930\u64b3\u58a0\u93bf\u5d84\u7d94\u93c6\u509b\u6902\u93c3\u72b3\u7876\u7039\u5c7e\u579a\u9286?'"));
  assert.ok(!source.includes("pick('\u93bf\u5d84\u7d94\u6fb6\u8fab\u89e6'"));
  assert.equal(metricsBlockMatches, 0);
});
