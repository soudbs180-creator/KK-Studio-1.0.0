import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('Morphic button content uses symmetric insets and centered action labels', () => {
  const bootstrapSource = readSource('apps/web/src/bootstrap.tsx');
  const mainSource = readSource('apps/web/src/main.tsx');
  const workflowCardSource = readSource('apps/web/src/workflow/nodes/WorkflowUtilityCard.tsx');
  const geometrySource = readSource('apps/web/src/styles/morphic-button-geometry.css');

  assert.match(bootstrapSource, /import '\.\/styles\/morphic-button-geometry\.css';/);
  assert.match(mainSource, /import '\.\/styles\/morphic-button-geometry\.css';/);
  assert.match(
    geometrySource,
    /\.kk-workspace-icon-control\s*\{[\s\S]*width:\s*30px\s*!important[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center/,
  );
  assert.match(
    geometrySource,
    /\.kk-canvas-view-tools button\s*\{[\s\S]*width:\s*26px\s*!important[\s\S]*height:\s*26px\s*!important[\s\S]*padding:\s*0/,
  );
  assert.match(
    geometrySource,
    /\.prompt-bar-liquid-send\s*\{[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center[\s\S]*gap:\s*4px/,
  );
  assert.match(
    geometrySource,
    /\.kk-prompt-send-button-content\s*\{[\s\S]*min-height:\s*22px[\s\S]*justify-content:\s*center[\s\S]*padding-inline:\s*8px/,
  );
  assert.match(
    geometrySource,
    /\.kk-prompt-send-button-icon\s*\{[\s\S]*width:\s*22px\s*!important[\s\S]*height:\s*22px\s*!important/,
  );
  assert.match(
    geometrySource,
    /--kk-morphic-button-action-padding-x:\s*12px[\s\S]*\.kk-morphic-function-button\s*\{[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center[\s\S]*padding-inline:\s*var\(--kk-morphic-button-action-padding-x\)/,
  );
  assert.match(workflowCardSource, /className="kk-morphic-function-button"/);
  assert.match(
    geometrySource,
    /@media\s*\(max-width:\s*1023px\)\s*\{[\s\S]*\.kk-workspace-icon-control\s*\{[\s\S]*width:\s*44px\s*!important/,
  );
  assert.match(
    geometrySource,
    /@media\s*\(max-width:\s*1023px\)\s*\{[\s\S]*\.kk-mobile-header-control\s*\{[\s\S]*padding-block:\s*0\s*!important[\s\S]*align-items:\s*center/,
  );
});
