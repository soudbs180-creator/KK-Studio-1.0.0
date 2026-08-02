import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('ecommerce composer exposes explicit asset, review, and section tabs', () => {
  const desktopPanelSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(desktopPanelSource, /data-ecommerce-workflow-step="inputs"/);
  assert.match(desktopPanelSource, /data-ecommerce-workflow-step="review"/);
  assert.match(desktopPanelSource, /data-ecommerce-group-sheet=\{sheet\}/);
  assert.match(desktopPanelSource, /data-ecommerce-composer-panel="true"/);
  assert.match(desktopPanelSource, /activeSection=\{resolvedGroupSheet\}/);
  assert.match(reviewPanelSource, /activeSection\?: '主图' \| 'A\+'/);
  assert.match(reviewPanelSource, /visibleReviewItems/);
});

test('desktop ecommerce composer keeps workflow controls on one page', () => {
  const workspaceStyleSource = readSource('apps/web/src/styles/workspace-ui-v3.css');

  assert.match(
    workspaceStyleSource,
    /data-composer-mode='ecommerce'[\s\S]*> \.input-bar-inner[\s\S]*max-height:\s*none !important[\s\S]*overflow:\s*visible !important/,
  );
  assert.match(
    workspaceStyleSource,
    /data-composer-mode='ecommerce'[\s\S]*\.input-bar-textarea[\s\S]*max-height:\s*90px !important[\s\S]*overflow-y:\s*auto !important/,
  );
});
