import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('workflow browser uses the Morphic full-height search, tabs, categories, and card grid', () => {
  const projectManagerSource = readSource(
    'apps/web/src/components/settings/ProjectManager.tsx',
  );
  const cssSource = readSource('apps/web/src/styles/morphic-ui.css');

  assert.match(projectManagerSource, /role="dialog"/);
  assert.match(projectManagerSource, /aria-modal="true"/);
  assert.match(projectManagerSource, /role="tablist"[\s\S]*工作流[\s\S]*工具/);
  assert.match(projectManagerSource, /placeholder="搜索工作流\.\.\."/);
  assert.match(projectManagerSource, /data-workflow-category=\{category\.id\}/);
  assert.match(projectManagerSource, /\{\s*id:\s*'all',\s*label:\s*'所有'\s*\}/);
  assert.match(projectManagerSource, /\{\s*id:\s*'image',\s*label:\s*'图像创作'\s*\}/);
  assert.match(projectManagerSource, /\{\s*id:\s*'presentation',\s*label:\s*'演示文稿'\s*\}/);
  assert.match(projectManagerSource, /kk-morphic-workflow-panel__grid/);
  assert.match(projectManagerSource, /kk-morphic-workflow-panel__tools/);
  assert.match(
    cssSource,
    /\.kk-morphic-workflow-panel\s*\{[\s\S]*height:\s*calc\(100dvh - 24px\)[\s\S]*max-width:\s*820px/,
  );
  assert.match(
    cssSource,
    /\.kk-morphic-workflow-panel__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*1023px\)[\s\S]*\.kk-morphic-workflow-panel\s*\{[\s\S]*bottom:\s*0\s*!important/,
  );
});
