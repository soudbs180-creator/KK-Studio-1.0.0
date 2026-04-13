import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ApiSettingsView source does not retain mojibake literals or duplicated provider metric blocks', () => {
  const source = readSource('src/components/settings/ApiSettingsView.tsx');
  const metricsBlockMatches = source.split('const prioritizedMetrics: ConsoleEndpointCardMetric[] = [').length - 1;

  assert.match(source, /const UI_BUDGET_OPTIONS = \['不限额', '金额预算', UI_TOKEN_LIMIT_LABEL\] as const;/);
  assert.match(source, /const BUDGET_OPTIONS = \['不限额', '金额预算', TOKEN_LIMIT_LABEL\] as const;/);
  assert.ok(source.includes("if (!value.trim()) return '尚未填写';"));
  assert.ok(source.includes("if (value.length <= 10) return '已填写';"));
  assert.ok(source.includes("return `${value.slice(0, 6)}••••${value.slice(-4)}`;"));
  assert.ok(source.includes("if (!summary?.lastLatencyMs) return '暂无最近调用数据';"));
  assert.ok(source.includes("pick('当前操作暂时无法完成。', 'The current action could not be completed right now.')"));
  assert.ok(source.includes("pick('操作失败', 'Action failed')"));
  assert.ok(!source.includes("const UI_BUDGET_OPTIONS = ['Unlimited', 'Budget', UI_TOKEN_LIMIT_LABEL] as const;"));
  assert.ok(!source.includes("pick('褰撳墠鎿嶄綔鏆傛椂鏃犳硶瀹屾垚銆?'"));
  assert.ok(!source.includes("pick('鎿嶄綔澶辫触'"));
  assert.equal(metricsBlockMatches, 2);
});
