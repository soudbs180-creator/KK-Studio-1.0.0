import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('ecommerce review and workbench panels expand without UI scroll regions', () => {
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const desktopWorkbenchSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(reviewPanelSource, /const reviewViewportStyle: React\.CSSProperties = \{\s*maxHeight: 'none',\s*\};/);
  assert.match(reviewPanelSource, /className="kk-ecommerce-review-panel mb-2 flex min-w-0 flex-col overflow-visible rounded-xl border p-2\.5"/);
  assert.match(reviewPanelSource, /className="grid min-w-0 gap-3 md:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]"/);
  assert.match(reviewPanelSource, /className="min-w-0 pr-1"/);
  assert.match(reviewPanelSource, /className="space-y-3"/);
  assert.doesNotMatch(reviewPanelSource, /overflow-y-auto/);

  assert.match(desktopWorkbenchSource, /const workbenchViewportStyle: React\.CSSProperties = \{\s*maxHeight: 'none',\s*\};/);
  assert.match(desktopWorkbenchSource, /className="kk-ecommerce-composer-panel flex min-h-0 flex-col gap-1\.5 overflow-visible"/);
  assert.match(desktopWorkbenchSource, /const ecommercePanelViewportStyle: React\.CSSProperties = \{\s*maxHeight: 'none',\s*overflow: 'visible',\s*\};/);
  assert.doesNotMatch(desktopWorkbenchSource, /overflow-y-auto/);
});

test('ecommerce review warnings render from deduped warning collections', () => {
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(reviewPanelSource, /const dedupedAnalysisWarnings = React\.useMemo\(\(\) => Array\.from\(new Set\(analysis\.reviewWarnings\)\), \[analysis\.reviewWarnings\]\);/);
  assert.match(reviewPanelSource, /const dedupedItemWarnings = Array\.from\(new Set\(reviewItem\.warnings\)\);/);
  assert.match(reviewPanelSource, /dedupedAnalysisWarnings\.slice\(0, 4\)\.map\(\(warning\) => \(/);
  assert.match(reviewPanelSource, /dedupedItemWarnings\.map\(\(warning\) => \(/);
});

test('ecommerce task editor exposes a denser compact layout for constrained composer panels', () => {
  const taskEditorSource = readSource('apps/web/src/components/ecommerce/EcommerceTaskEditorPanel.tsx');

  assert.match(taskEditorSource, /const rootPaddingClassName = compact \? 'p-2\.5' : 'p-3';/);
  assert.match(taskEditorSource, /const textareaMinHeightClassName = compact \? 'min-h-\[56px\]' : 'min-h-\[72px\]';/);
  assert.match(taskEditorSource, /const chipLimit = compact \? 2 : 4;/);
});

test('ecommerce review galleries remain fully visible without a scroll container', () => {
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(reviewPanelSource, /const \[expandedGalleryKeys, setExpandedGalleryKeys\] = React\.useState<Record<string, boolean>>\(\{\}\);/);
  assert.match(reviewPanelSource, /const galleryStateKey = `\$\{itemKey\}:\$\{label\}`;/);
  assert.match(reviewPanelSource, /const referenceGalleryHeightClassName = isGalleryExpanded \? 'max-h-none' : 'max-h-28';/);
  assert.doesNotMatch(reviewPanelSource, /overflow-y-auto/);
  assert.match(reviewPanelSource, /data-testid="ecommerce-review-reference-toggle"/);
});

test('ecommerce task editor supports summary-first collapsed editing and the desktop workbench opts in', () => {
  const taskEditorSource = readSource('apps/web/src/components/ecommerce/EcommerceTaskEditorPanel.tsx');
  const reviewPanelSource = readSource('apps/web/src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const desktopWorkbenchSource = readSource('apps/web/src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(taskEditorSource, /collapsible\?: boolean;/);
  assert.match(taskEditorSource, /defaultExpanded\?: boolean;/);
  assert.match(taskEditorSource, /const \[isExpanded, setIsExpanded\] = React\.useState\(\(\) => !collapsible \|\| defaultExpanded\);/);
  assert.match(taskEditorSource, /data-testid="ecommerce-task-editor-toggle"/);
  assert.match(reviewPanelSource, /collapsible/);
  assert.match(desktopWorkbenchSource, /collapsible/);
});
