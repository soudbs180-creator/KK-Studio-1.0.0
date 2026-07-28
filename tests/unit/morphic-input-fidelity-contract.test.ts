import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('canvas composer publishes a compact desktop contract without changing ecommerce or mobile layouts', () => {
  const promptBarSource = readSource('apps/web/src/components/layout/PromptBar.tsx');
  const topRowSource = readSource(
    'apps/web/src/components/layout/prompt-bar/PromptBarTopRowDesktop.tsx',
  );
  const modeSwitcherSource = readSource(
    'apps/web/src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx',
  );
  const promptToolsSource = readSource(
    'apps/web/src/components/layout/prompt-bar/DesktopComposerPromptTools.tsx',
  );
  const footerSource = readSource(
    'apps/web/src/components/layout/prompt-bar/PromptBarFooterDesktop.tsx',
  );
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(promptBarSource, /data-composer-mode=\{config\.mode\}/);
  assert.match(
    promptBarSource,
    /data-composer-layout=\{isMobile \? 'mobile' : 'desktop'\}/,
  );
  assert.match(promptBarSource, /className="kk-composer-reference-row/);
  assert.match(promptBarSource, /className="kk-composer-reference-button/);
  assert.match(promptBarSource, /className="kk-composer-reference-label">/);
  assert.match(topRowSource, /kk-composer-floating-tools/);
  assert.match(modeSwitcherSource, /kk-composer-mode-switcher__track/);
  assert.match(modeSwitcherSource, /kk-composer-mode-switcher__indicator/);
  assert.match(modeSwitcherSource, /kk-composer-mode-switcher__button/);
  assert.match(promptToolsSource, /kk-composer-prompt-tools__group/);
  assert.match(promptToolsSource, /kk-composer-prompt-tools__optimize/);
  assert.match(footerSource, /kk-composer-compact-footer/);

  assert.match(
    cssSource,
    /#prompt-bar-container\[data-composer-layout='desktop'\]:not\(\[data-composer-mode='ecommerce'\]\)\s*\{[\s\S]*min-height:\s*127px/,
  );
  assert.match(
    cssSource,
    /\.kk-composer-floating-tools\s*\{[\s\S]*position:\s*absolute[\s\S]*bottom:\s*calc\(100% \+ 8px\)/,
  );
  assert.match(
    cssSource,
    /\.kk-composer-mode-switcher__track,[\s\S]*\.kk-composer-prompt-tools__group\s*\{[\s\S]*height:\s*32px\s*!important[\s\S]*padding:\s*1px\s*!important/,
  );
  assert.match(
    cssSource,
    /\.kk-composer-mode-switcher__button,[\s\S]*\.kk-composer-prompt-tools__optimize\s*\{[\s\S]*height:\s*30px\s*!important[\s\S]*padding-top:\s*0\s*!important/,
  );
  assert.match(
    cssSource,
    /\.kk-composer-reference-row\s*\{[\s\S]*min-height:\s*30px/,
  );
  assert.match(
    cssSource,
    /#prompt-bar-container\[data-composer-layout='desktop'\]:not\(\[data-composer-mode='ecommerce'\]\)\s+\.input-bar-textarea\s*\{[\s\S]*min-height:\s*24px\s*!important[\s\S]*font-size:\s*14px\s*!important[\s\S]*line-height:\s*21px\s*!important/,
  );
  assert.match(
    cssSource,
    /\.kk-composer-compact-footer\s*\{[\s\S]*min-height:\s*32px\s*!important[\s\S]*flex-wrap:\s*nowrap\s*!important/,
  );
  assert.match(
    cssSource,
    /#prompt-bar-container\[data-composer-mode='ecommerce'\]\s+\.input-bar-inner\s*\{[\s\S]*overflow-y:\s*auto\s*!important/,
  );
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*button,[\s\S]*textarea[\s\S]*min-height:\s*44px\s*!important/,
  );
});

test('Copilot composer matches the reference compact shell and keeps attachment access visible', () => {
  const chatSource = readSource('apps/web/src/components/layout/ChatSidebar.tsx');
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(chatSource, /kk-chat-sidebar-composer/);
  assert.match(chatSource, /kk-chat-sidebar-composer-input/);
  assert.match(chatSource, /kk-chat-sidebar-attachment-host/);
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-chat-sidebar-composer\s*\{[\s\S]*min-height:\s*94px[\s\S]*padding:\s*5px\s*!important[\s\S]*border-radius:\s*20px\s*!important/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+textarea\.kk-chat-sidebar-composer-input\s*\{[\s\S]*min-height:\s*42px\s*!important[\s\S]*font-size:\s*14px\s*!important[\s\S]*line-height:\s*17\.5px\s*!important/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-chat-sidebar-composer-actions\s*\{[\s\S]*min-height:\s*30px/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-chat-sidebar-attachment-host\s*\{[\s\S]*position:\s*static\s*!important/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar[\s\S]*nth-child\(1\)\s*>\s*:nth-child\(2\)\s*\{[\s\S]*display:\s*none\s*!important/,
  );
  assert.match(
    cssSource,
    /body\[data-kk-workspace-mode='copilot'\]\s+\.kk-workspace-sidebar[\s\S]*nth-child\(2\)[\s\S]*\.group:first-child[\s\S]*background:\s*transparent\s*!important/,
  );
});

test('authentication inputs use the compact 38px reference geometry', () => {
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(
    cssSource,
    /\.auth-modal-content\s*\{[\s\S]*height:\s*min\(546px,\s*90vh\)\s*!important/,
  );
  assert.match(
    cssSource,
    /\.auth-modal-overlay\s*\{[\s\S]*width:\s*100vw[\s\S]*height:\s*100dvh/,
  );
  assert.match(
    cssSource,
    /\.auth-input-wrap\s*\{[\s\S]*height:\s*38px\s*!important[\s\S]*padding:\s*0 10px\s*!important/,
  );
  assert.match(
    cssSource,
    /\.auth-input-wrap input\s*\{[\s\S]*font-size:\s*16px\s*!important[\s\S]*line-height:\s*22px\s*!important/,
  );
  assert.match(cssSource, /\.auth-input-wrap > svg\s*\{[\s\S]*display:\s*none/);
  assert.match(
    cssSource,
    /\.auth-field-help:not\(\.auth-field-error\)\s*\{[\s\S]*display:\s*none/,
  );
  assert.match(
    cssSource,
    /body:has\(\.auth-modal-overlay\)\s*\{[\s\S]*overflow:\s*hidden/,
  );
});
