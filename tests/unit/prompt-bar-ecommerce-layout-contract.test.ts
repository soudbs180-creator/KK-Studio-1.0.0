import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const promptBarSource = fs.readFileSync('apps/web/src/components/layout/PromptBar.tsx', 'utf8');
const floatingToolsSource = fs.readFileSync(
  'apps/web/src/components/layout/prompt-bar/PromptBarTopRowDesktop.tsx',
  'utf8',
);
const modeSwitcherSource = fs.readFileSync(
  'apps/web/src/components/layout/prompt-bar/DesktopComposerModeSwitcher.tsx',
  'utf8',
);
const ecommercePanelSource = fs.readFileSync(
  'apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx',
  'utf8',
);
const morphicUiSource = fs.readFileSync('apps/web/src/styles/morphic-ui.css', 'utf8');
const workspaceUiV3Source = fs.readFileSync('apps/web/src/styles/workspace-ui-v3.css', 'utf8');
const workspaceUiV4Source = fs.readFileSync('apps/web/src/styles/workspace-ui-v4.css', 'utf8');

test('ecommerce composer keeps mode tools outside the compact one-page surface', () => {
  assert.match(promptBarSource, /<PromptBarTopRow/);
  assert.match(floatingToolsSource, /createPortal\(floatingTools, document\.body\)/);
  assert.match(floatingToolsSource, /kk-composer-floating-tools-anchor/);
  assert.match(floatingToolsSource, /data-composer-layout="desktop"/);
  assert.match(floatingToolsSource, /zIndex: KK_LAYER\.dropdown/);
  assert.match(floatingToolsSource, /new MutationObserver\(updatePosition\)/);
  assert.match(floatingToolsSource, /attributeFilter: \['data-composer-mode'\]/);
  assert.match(modeSwitcherSource, /import \{ KK_LAYER \} from '@kk\/ui';/);
  assert.match(modeSwitcherSource, /style=\{\{ zIndex: KK_LAYER\.dropdown \}\}/);
  assert.match(modeSwitcherSource, /style=\{isMobile \? undefined : \{ width: 84, minWidth: 84, paddingInline: 8 \}\}/);
  assert.match(ecommercePanelSource, /kk-ecommerce-composer-panel/);
  assert.match(ecommercePanelSource, /kk-ecommerce-composer-panel[^\n]*overflow-visible/);
  assert.match(morphicUiSource, /\.kk-ecommerce-composer-panel[\s\S]*overflow:\s*visible/);
});

test('ecommerce composer only scrolls prompt text, not its controls', () => {
  assert.match(morphicUiSource, /data-composer-mode='ecommerce'[\s\S]*\.input-bar-textarea[\s\S]*overflow-y:\s*auto/);
  assert.match(morphicUiSource, /data-composer-mode='ecommerce'[\s\S]*\.kk-ecommerce-composer-panel[\s\S]*overflow:\s*visible/);
});

test('ecommerce composer stays compact and keeps fixed-size desktop controls', () => {
  assert.match(workspaceUiV3Source, /max-height:\s*min\(calc\(100dvh - 86px\), 430px\)/);
  assert.match(workspaceUiV3Source, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(workspaceUiV3Source, /\.kk-composer-floating-tools-host\[data-composer-layout='desktop'\][\s\S]*pointer-events:\s*none/);
  assert.match(morphicUiSource, /\.kk-composer-floating-tools-host \.kk-composer-type-picker__trigger[\s\S]*width:\s*84px !important/);
  assert.match(morphicUiSource, /\.kk-composer-floating-tools-host \.kk-composer-type-picker__trigger[\s\S]*padding-inline:\s*8px !important/);
  assert.match(workspaceUiV4Source, /\.kk-composer-floating-tools-host \.kk-composer-type-picker__trigger[\s\S]*width:\s*84px !important/);
  assert.match(workspaceUiV4Source, /data-composer-mode='ecommerce'[\s\S]*max-height:\s*none !important/);
  assert.match(workspaceUiV4Source, /data-composer-mode='ecommerce'[\s\S]*overflow:\s*visible !important/);
  assert.match(workspaceUiV4Source, /\.kk-ecommerce-import-card[\s\S]*min-height:\s*76px !important/);
  assert.match(workspaceUiV4Source, /\[data-testid='ecommerce-workflow-header'\][\s\S]*background:\s*transparent !important/);
  assert.match(workspaceUiV4Source, /\.kk-ecommerce-import-panel[\s\S]*border-color:\s*transparent !important/);
  assert.match(workspaceUiV4Source, /\.prompt-bar-liquid-send[\s\S]*width:\s*64px !important/);
  assert.match(workspaceUiV4Source, /\.canvas-nav-panel svg[\s\S]*width:\s*13px !important/);
});

test('canvas surfaces leave the single dot grid to the canvas-grid layer', () => {
  assert.match(morphicUiSource, /\.canvas-workspace,[\s\S]*background-image:\s*none !important/);
});
