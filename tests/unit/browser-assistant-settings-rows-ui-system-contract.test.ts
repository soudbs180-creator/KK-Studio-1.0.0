import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

const viewSource = () => readSource('apps/web/src/components/settings/views/BrowserAssistantView.tsx');
const settingsCss = () => readSource('apps/web/src/styles/settings.css');

const legacyRowClassPattern =
  /border-white\/5|border-white\/10|bg-white\/5|bg-white\/10|bg-black\/|text-slate-|text-emerald-|text-blue-|text-red-|text-indigo-|text-amber-|bg-indigo-|bg-amber-|bg-blue-|border-indigo-|border-amber-|border-blue-|bg-emerald-|border-emerald-/;

const extractAfter = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
};

const extractAround = (source: string, marker: string, leadingChars: number, end: string) => {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing marker: ${marker}`);

  const endIndex = source.indexOf(end, markerIndex + marker.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(Math.max(0, markerIndex - leadingChars), endIndex);
};

test('browser assistant session rows use settings-browser row primitives', () => {
  const source = viewSource();
  const css = settingsCss();
  const sessionBlock = extractAround(source, 'sessions.map((sess)', 900, 'socialChannels.map((channel)');

  assert.match(sessionBlock, /settings-browser-row-list/);
  assert.match(sessionBlock, /settings-browser-row"/);
  assert.match(sessionBlock, /settings-browser-chip/);
  assert.match(sessionBlock, /settings-browser-row__title/);
  assert.match(sessionBlock, /settings-browser-row__meta/);
  assert.match(sessionBlock, /settings-browser-inline-status/);
  assert.match(sessionBlock, /data-status=\{sess\.status\}/);
  assert.match(sessionBlock, /settings-browser-subtle-action/);
  assert.match(sessionBlock, /settings-browser-toggle/);
  assert.match(sessionBlock, /settings-browser-action-row/);
  assert.doesNotMatch(sessionBlock, legacyRowClassPattern);

  assert.match(css, /\.settings-panel \.settings-browser-row-list\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-row\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-chip\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-inline-status\[data-status="logged_in"\]\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-subtle-action\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-toggle\[data-state="enabled"\]\s*\{/);
});

test('browser assistant social channel rows share the same row system', () => {
  const source = viewSource();
  const css = settingsCss();
  const socialBlock = extractAround(source, 'socialChannels.map((channel)', 900, '浏览器 Bridge 插件安装指南');

  assert.match(socialBlock, /settings-browser-section-card/);
  assert.match(socialBlock, /settings-browser-row-list/);
  assert.match(socialBlock, /settings-browser-row"/);
  assert.match(socialBlock, /settings-browser-row__title/);
  assert.match(socialBlock, /settings-browser-row__meta/);
  assert.match(socialBlock, /settings-browser-inline-status/);
  assert.match(socialBlock, /data-status=\{channel\.status\}/);
  assert.match(socialBlock, /settings-browser-subtle-action/);
  assert.match(socialBlock, /settings-browser-toggle/);
  assert.doesNotMatch(socialBlock, legacyRowClassPattern);

  assert.match(css, /\.settings-panel \.settings-browser-section-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-section-card__header\s*\{[\s\S]*flex-wrap:\s*wrap;/);
  assert.match(css, /\.settings-panel \.settings-browser-section-card__header > :first-child\s*\{[\s\S]*min-width:\s*0;/);
  assert.match(css, /\.settings-panel \.settings-browser-assistant-view \.settings-card-grid-container\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(css, /\.settings-panel \.settings-browser-assistant-view \.dashboard-grid-card\s*\{[\s\S]*min-width:\s*0 !important;[\s\S]*width:\s*auto !important;[\s\S]*max-width:\s*100% !important;/);
});

test('browser assistant install daemon and desktop adapter cards use shared guide primitives', () => {
  const source = viewSource();
  const css = settingsCss();
  const installBlock = extractAfter(source, '浏览器 Bridge 插件安装指南', '守护程序安装指南');
  const daemonBlock = extractAfter(source, '守护程序安装指南', '桌面端 IDE 开发适配器');
  const desktopBlock = extractAfter(source, '桌面端 IDE 开发适配器', '高级功能融合配置中心');

  assert.match(installBlock, /settings-browser-section-card/);
  assert.match(installBlock, /settings-browser-tile-grid/);
  assert.match(installBlock, /settings-browser-tile/);
  assert.match(installBlock, /settings-browser-chip/);
  assert.match(installBlock, /data-tone="info"/);
  assert.match(installBlock, /data-tone="warning"/);
  assert.match(installBlock, /settings-browser-tile__title/);
  assert.match(installBlock, /settings-browser-tile__description/);
  assert.match(installBlock, /settings-browser-action--primary/);
  assert.match(installBlock, /settings-browser-action--neutral/);
  assert.doesNotMatch(installBlock, legacyRowClassPattern);

  assert.match(daemonBlock, /settings-browser-section-card/);
  assert.match(daemonBlock, /settings-browser-step-list/);
  assert.match(daemonBlock, /settings-browser-step/);
  assert.match(daemonBlock, /settings-browser-step__badge/);
  assert.match(daemonBlock, /settings-browser-code/);
  assert.doesNotMatch(daemonBlock, legacyRowClassPattern);

  assert.match(desktopBlock, /settings-browser-section-card/);
  assert.match(desktopBlock, /settings-browser-form-row/);
  assert.match(desktopBlock, /settings-browser-field/);
  assert.match(desktopBlock, /settings-browser-label/);
  assert.match(desktopBlock, /settings-browser-select/);
  assert.match(desktopBlock, /settings-browser-meta-row/);
  assert.match(desktopBlock, /settings-browser-inline-status/);
  assert.match(desktopBlock, /data-status=\{desktopStatus\}/);
  assert.match(desktopBlock, /settings-browser-row__mono/);
  assert.doesNotMatch(desktopBlock, legacyRowClassPattern);

  assert.match(css, /\.settings-panel \.settings-browser-tile-grid\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-tile\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-step-list\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-code\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-form-row\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-select\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-meta-row\s*\{/);
});

test('browser assistant advanced fusion center uses feature card primitives', () => {
  const source = viewSource();
  const css = settingsCss();
  const fusionBlock = extractAfter(source, '高级功能融合配置中心', '阶段五优化');

  assert.match(fusionBlock, /settings-browser-section-card/);
  assert.match(fusionBlock, /settings-browser-feature-grid/);
  assert.match(fusionBlock, /settings-browser-feature-card/);
  assert.match(fusionBlock, /settings-browser-feature-card__header/);
  assert.match(fusionBlock, /settings-browser-feature-card__title/);
  assert.match(fusionBlock, /settings-browser-feature-card__description/);
  assert.match(fusionBlock, /settings-browser-toggle/);
  assert.match(fusionBlock, /settings-browser-status-dot/);
  assert.match(fusionBlock, /settings-browser-input/);
  assert.match(fusionBlock, /settings-browser-select/);
  assert.match(fusionBlock, /settings-browser-check-row/);
  assert.match(fusionBlock, /settings-browser-meta-row/);
  assert.match(fusionBlock, /settings-browser-insight-card/);
  assert.match(fusionBlock, /settings-browser-swatch/);
  assert.match(fusionBlock, /settings-browser-action--primary/);
  assert.doesNotMatch(fusionBlock, legacyRowClassPattern);

  assert.match(css, /\.settings-panel \.settings-browser-feature-grid\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-feature-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-status-dot\[data-status="connected"\]\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-input\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-check-row\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-insight-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-swatch\s*\{/);
});

test('browser assistant AI takeover command card uses shared command and report primitives', () => {
  const source = viewSource();
  const css = settingsCss();
  const takeoverBlock = extractAround(source, 'AI Takeover 智能调度解析门控', 420, '演示沙盒区');

  assert.match(takeoverBlock, /settings-browser-section-card/);
  assert.match(takeoverBlock, /settings-browser-section-card--wide/);
  assert.match(takeoverBlock, /settings-browser-form-row/);
  assert.match(takeoverBlock, /settings-browser-field/);
  assert.match(takeoverBlock, /settings-browser-label/);
  assert.match(takeoverBlock, /settings-browser-input/);
  assert.match(takeoverBlock, /settings-browser-sample-row/);
  assert.match(takeoverBlock, /settings-browser-subtle-action/);
  assert.match(takeoverBlock, /settings-browser-report-card/);
  assert.match(takeoverBlock, /settings-browser-report-card__grid/);
  assert.match(takeoverBlock, /settings-browser-report-card__label/);
  assert.match(takeoverBlock, /settings-browser-report-card__value/);
  assert.doesNotMatch(takeoverBlock, legacyRowClassPattern);

  assert.match(css, /\.settings-panel \.settings-browser-sample-row\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-report-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-report-card__grid\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-report-card__value\[data-tone="success"\]\s*\{/);
});

test('browser assistant playground uses tab progress result pipeline and notice primitives', () => {
  const source = viewSource();
  const css = settingsCss();
  const playgroundBlock = extractAfter(source, '演示沙盒区', '</SettingsCardGridContainer>');

  assert.match(playgroundBlock, /settings-browser-playground/);
  assert.match(playgroundBlock, /settings-browser-tabbar/);
  assert.match(playgroundBlock, /settings-browser-tab/);
  assert.match(playgroundBlock, /aria-selected=\{playgroundTab === 'extract'\}/);
  assert.match(playgroundBlock, /settings-browser-command-row/);
  assert.match(playgroundBlock, /settings-browser-progress-card/);
  assert.match(playgroundBlock, /settings-browser-progress-track/);
  assert.match(playgroundBlock, /settings-browser-result-card/);
  assert.match(playgroundBlock, /settings-browser-result-card__media/);
  assert.match(playgroundBlock, /settings-browser-segment-group/);
  assert.match(playgroundBlock, /settings-browser-segment/);
  assert.match(playgroundBlock, /settings-browser-session-picker/);
  assert.match(playgroundBlock, /settings-browser-pipeline-list/);
  assert.match(playgroundBlock, /settings-browser-pipeline-step/);
  assert.match(playgroundBlock, /settings-browser-terminal/);
  assert.match(playgroundBlock, /settings-browser-notice/);
  assert.doesNotMatch(playgroundBlock, legacyRowClassPattern);

  assert.match(css, /\.settings-panel \.settings-browser-playground\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-tabbar\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-progress-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-result-card\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-segment\[aria-pressed="true"\]\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-pipeline-step\[data-state="active"\]\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-terminal\s*\{/);
  assert.match(css, /\.settings-panel \.settings-browser-notice\[data-tone="warning"\]\s*\{/);
});
