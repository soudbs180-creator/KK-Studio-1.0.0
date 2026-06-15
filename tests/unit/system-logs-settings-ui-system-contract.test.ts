import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

const viewSource = () => readSource('apps/web/src/components/settings/views/SystemLogsView.localized.tsx');
const settingsCss = () => readSource('apps/web/src/styles/settings.css');

const legacyVisualClassPattern =
  /border-white\/|border-black\/|bg-white\/|bg-black\/|text-slate-|text-zinc-|text-white|text-red-|text-emerald-|bg-blue-|bg-rose-|rounded-\[|shadow-\[/;

const extractAfter = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
};

test('system logs view uses real settings scaffold and removes legacy test-only scaffold marker', () => {
  const source = viewSource();

  assert.match(source, /<SettingsViewShell className="settings-system-logs-view">/);
  assert.match(source, /<SettingsHero/);
  assert.match(source, /<SettingsMetricCard/);
  assert.match(source, /<SettingsSection/);
  assert.doesNotMatch(source, /__legacy_testing_support_mark/);
});

test('system logs metrics filters switches alert and stream use settings-log primitives', () => {
  const source = viewSource();
  const css = settingsCss();

  const metricBlock = extractAfter(source, '<div className="settings-log-metrics-grid">', '<SettingsSection');
  const filterBlock = extractAfter(source, "title={pick('过滤与流控制'", "title={pick('控制台配置'");
  const switchBlock = extractAfter(source, "title={pick('控制台配置'", "title={pick('最新告警与操作'");
  const alertBlock = extractAfter(source, "title={pick('最新告警与操作'", "title={pick('日志流列表'");
  const streamBlock = extractAfter(source, "title={pick('日志流列表'", '</SettingsCardGridContainer>');

  assert.match(metricBlock, /settings-log-metrics-grid/);
  assert.match(metricBlock, /SettingsMetricCard/);
  assert.match(metricBlock, /data-tone=\{errorLogs\.length > 0 \? 'danger' : 'success'\}/);
  assert.doesNotMatch(metricBlock, legacyVisualClassPattern);

  assert.match(filterBlock, /settings-log-toolbar/);
  assert.match(filterBlock, /settings-log-toolbar__controls/);
  assert.match(filterBlock, /settings-log-toolbar__actions/);
  assert.match(filterBlock, /settings-log-action/);
  assert.match(filterBlock, /data-variant=\{isStreamPaused \? 'primary' : 'neutral'\}/);
  assert.doesNotMatch(filterBlock, legacyVisualClassPattern);

  assert.match(switchBlock, /settings-log-switch-grid/);
  assert.match(switchBlock, /settings-log-switch-option/);
  assert.match(switchBlock, /data-state=\{option\.enabled \? 'on' : 'off'\}/);
  assert.match(switchBlock, /settings-log-switch-option__label/);
  assert.doesNotMatch(switchBlock, legacyVisualClassPattern);

  assert.match(alertBlock, /settings-log-alert-card/);
  assert.match(alertBlock, /settings-log-alert-card__message/);
  assert.match(alertBlock, /settings-log-alert-card__maintenance/);
  assert.match(alertBlock, /settings-log-action/);
  assert.match(alertBlock, /data-variant="danger"/);
  assert.doesNotMatch(alertBlock, legacyVisualClassPattern);

  assert.match(streamBlock, /settings-log-stream-card/);
  assert.match(streamBlock, /settings-log-stream/);
  assert.match(streamBlock, /settings-log-stream-entry/);
  assert.match(streamBlock, /settings-log-stream-entry__header/);
  assert.match(streamBlock, /settings-log-stream-entry__message/);
  assert.match(streamBlock, /settings-log-stream-entry__details/);
  assert.doesNotMatch(streamBlock, legacyVisualClassPattern);

  assert.match(css, /\.settings-panel \.settings-system-logs-view\s*\{/);
  assert.match(css, /\.settings-panel \.settings-system-logs-view \.settings-card-grid-container\s*\{[\s\S]*display:\s*grid !important;[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(css, /\.settings-panel \.settings-system-logs-view \.settings-card-grid-container > \.settings-log-metrics-grid\s*\{[\s\S]*grid-column:\s*1 \/ -1;/);
  assert.match(css, /\.settings-panel \.settings-system-logs-view \.settings-card-grid-container > section:nth-of-type\(1\),[\s\S]*\.settings-panel \.settings-system-logs-view \.settings-card-grid-container > section:nth-of-type\(2\)\s*\{[\s\S]*grid-column:\s*span 2;/);
  assert.match(css, /\.settings-panel \.settings-system-logs-view \.settings-card-grid-container > section:nth-of-type\(3\),[\s\S]*\.settings-panel \.settings-system-logs-view \.settings-card-grid-container > section:nth-of-type\(4\)\s*\{[\s\S]*grid-column:\s*1 \/ -1;/);
  assert.match(css, /\.settings-panel \.settings-log-metrics-grid\s*\{/);
  assert.match(css, /\.settings-panel \.settings-log-toolbar\s*\{/);
  assert.match(css, /\.settings-panel \.settings-log-toolbar__actions\s*\{[\s\S]*width:\s*100%;/);
  assert.match(css, /@media \(min-width: 768px\)\s*\{[\s\S]*\.settings-panel \.settings-log-toolbar\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
  assert.match(css, /\.settings-panel \.settings-log-action\[data-variant="primary"\]\s*\{/);
  assert.match(css, /\.settings-panel \.settings-log-switch-grid\s*\{/);
  assert.match(css, /\.settings-panel \.settings-log-switch-option\[data-state="on"\]\s*\{/);
  assert.match(css, /\.settings-panel \.settings-log-alert-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-log-stream-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-log-stream-entry\[data-level="error"\]\s*\{/);
});
