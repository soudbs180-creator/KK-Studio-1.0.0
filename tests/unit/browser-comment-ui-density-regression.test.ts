import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('settings model center favors provider cards and never clips route content', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*72fr\) minmax\(220px,\s*28fr\)\s*!important/);
  assert.match(styles, /\.settings-model-center-route\s*\{[\s\S]*max-height:\s*none\s*!important;[\s\S]*overflow:\s*visible\s*!important/);
  assert.match(styles, /\.settings-model-center-route__actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*30px\)\s*!important;[\s\S]*grid-row:\s*1/);
  assert.match(styles, /grid-auto-rows:\s*max-content\s*!important/);
  assert.match(styles, /settings-model-center-route__id-wrapper button[\s\S]*?min-height:\s*18px/);
  assert.match(styles, /\.settings-model-center-directory__header\s*\{[\s\S]*background:\s*transparent\s*!important/);
  assert.match(styles, /\.settings-model-center-directory__tab--active\s*\{[\s\S]*border-color:\s*rgb\(var\(--settings-accent-rgb\)/);
  assert.match(styles, /\.settings-model-center-toolbar__button\s*\{[\s\S]*height:\s*30px/);
  assert.match(styles, /\.settings-capability-source-card:last-child\s*\{[\s\S]*grid-column:\s*auto/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*\.settings-model-center-route[\s\S]*overflow:\s*visible\s*!important/);
});

test('settings dashboard keeps narrow desktop information dense without scaling icons', () => {
  const styles = readSource('apps/web/src/styles/settings-ui-v4.css');

  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.dashboard-console-header[\s\S]*padding-block:\s*8px/);
  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.dashboard-console-metrics[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.dashboard-console-metrics[\s\S]*grid-auto-rows:\s*minmax\(72px,\s*auto\)\s*!important/);
  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.settings-console-content[\s\S]*padding:\s*20px\s+24px\s+28px\s*!important/);
  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.dashboard-metric-tile[\s\S]*min-height:\s*72px\s*!important/);
  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.dashboard-command-center\s*>\s*\.dashboard-panel[\s\S]*padding:\s*12px\s*!important/);
  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.dashboard-panel__icon[\s\S]*width:\s*30px[\s\S]*height:\s*30px/);
  assert.match(styles, /@media \(min-width:\s*760px\) and \(max-width:\s*1100px\)[\s\S]*\.dashboard-panel__icon\s+svg[\s\S]*width:\s*15px[\s\S]*height:\s*15px/);
});

test('workspace fixed controls and floating panels stay compact at desktop breakpoints', () => {
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');
  const modePanel = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerModePanel.tsx');

  assert.match(styles, /\.kk-project-rail button\s*\{[\s\S]*width:\s*30px\s*!important;[\s\S]*height:\s*30px\s*!important/);
  assert.match(styles, /\.kk-workspace-chrome-v3 \.kk-workspace-avatar-button\s*\{[\s\S]*min-height:\s*30px\s*!important/);
  assert.match(styles, /\.kk-version-help\s*\{[\s\S]*min-height:\s*28px\s*!important/);
  assert.match(styles, /\.kk-morphic-workflow-panel\s*\{[\s\S]*max-width:\s*680px\s*!important;[\s\S]*height:\s*min\(520px,\s*calc\(100dvh - 40px\)\)\s*!important/);
  assert.match(styles, /#prompt-bar-container:has\(\.kk-composer-options-stack\)[\s\S]*z-index:\s*var\(--kk-z-modal,\s*1200\)\s*!important/);
  assert.match(styles, /\.kk-composer-options-stack\s*\{[\s\S]*width:\s*360px;[\s\S]*gap:\s*0\s*!important/);
  assert.match(modePanel, /zIndex:\s*KK_LAYER\.dropdown/);
});

test('mobile prompt stays generic and chrome uses a centered max-width rail', () => {
  const promptBar = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const styles = readSource('apps/web/src/styles/workspace-ui-v4.css');
  const ecommercePanelUsages = promptBar.match(/<DesktopComposerEcommercePanel\b/g) ?? [];

  assert.equal(ecommercePanelUsages.length, 1);
  assert.match(promptBar, /isMobile && config\.mode === GenerationMode\.ECOMMERCE/);
  assert.match(promptBar, /getPromptBarModePatch\(previousConfig, GenerationMode\.IMAGE\)/);
  assert.match(styles, /--kk-mobile-surface-width:\s*min\(580px,\s*calc\(100vw - 24px\)\)/);
  assert.match(styles, /\.mobile-header[\s\S]*max-width:\s*var\(--kk-mobile-surface-width\)/);
  assert.match(styles, /#mobile-tab-bar[\s\S]*max-width:\s*var\(--kk-mobile-surface-width\)/);
  assert.match(styles, /\.kk-result-command-row[\s\S]*max-width:\s*var\(--kk-mobile-surface-width\)/);
  assert.match(styles, /\.kk-prompt-bar-mobile-collapse-handle--embedded[\s\S]*height:\s*24px\s*!important/);
});
