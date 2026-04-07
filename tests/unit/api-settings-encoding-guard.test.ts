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
  const prioritizedMetricMatches = source.match(/const prioritizedMetrics: ConsoleEndpointCardMetric\[\] = \[/g) || [];

  assert.match(source, /const BUDGET_OPTIONS = \['[^']+', '[^']+', TOKEN_LIMIT_LABEL\] as const;/);
  assert.ok(source.includes("if (!value.trim()) return '尚未填写';"));
  assert.ok(source.includes("if (value.length <= 10) return '已填写';"));
  assert.ok(source.includes("return `${value.slice(0, 6)}••••${value.slice(-4)}`;"));
  assert.ok(source.includes("if (!summary?.lastLatencyMs) return '暂无最近调用数据';"));
  assert.equal(prioritizedMetricMatches.length, 2);
});
