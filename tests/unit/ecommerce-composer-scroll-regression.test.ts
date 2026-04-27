import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce review and workbench panels stay viewport-bound with inner scroll regions', () => {
  const reviewPanelSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const desktopWorkbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(reviewPanelSource, /const reviewViewportStyle: React\.CSSProperties = \{\s*maxHeight: 'min\(calc\(100vh - 220px\), 720px\)',\s*\};/);
  assert.match(reviewPanelSource, /className="mb-2 flex min-h-0 flex-col overflow-hidden rounded-xl border p-3"/);
  assert.match(reviewPanelSource, /className="grid min-h-0 min-w-0 flex-1 gap-3 md:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]"/);
  assert.match(reviewPanelSource, /className="flex min-h-0 min-w-0 flex-col overflow-hidden"/);
  assert.match(reviewPanelSource, /className="min-h-0 min-w-0 flex-1 overflow-y-auto custom-scrollbar pr-1"/);
  assert.match(reviewPanelSource, /className=\{compact \? 'space-y-3' : 'min-h-0 flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1'\}/);

  assert.match(desktopWorkbenchSource, /const workbenchViewportStyle: React\.CSSProperties = \{\s*maxHeight: 'min\(calc\(100vh - 220px\), 720px\)',\s*\};/);
  assert.match(desktopWorkbenchSource, /className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1"/);
  assert.match(desktopWorkbenchSource, /className="mb-2 flex min-h-0 flex-col overflow-hidden rounded-xl border p-3"/);
  assert.match(desktopWorkbenchSource, /style=\{\{ \.\.\.sectionCardStyle, \.\.\.workbenchViewportStyle \}\}/);
  assert.match(desktopWorkbenchSource, /className="mt-3 min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1"/);
  assert.match(desktopWorkbenchSource, /className="mb-3 max-h-48 space-y-2 overflow-y-auto custom-scrollbar pr-1"/);
});

test('ecommerce review warnings render from deduped warning collections', () => {
  const reviewPanelSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(reviewPanelSource, /const dedupedAnalysisWarnings = React\.useMemo\(\(\) => Array\.from\(new Set\(analysis\.reviewWarnings\)\), \[analysis\.reviewWarnings\]\);/);
  assert.match(reviewPanelSource, /const dedupedItemWarnings = Array\.from\(new Set\(reviewItem\.warnings\)\);/);
  assert.match(reviewPanelSource, /dedupedAnalysisWarnings\.slice\(0, 4\)\.map\(\(warning\) => \(/);
  assert.match(reviewPanelSource, /dedupedItemWarnings\.map\(\(warning\) => \(/);
});

test('ecommerce task editor exposes a denser compact layout for constrained composer panels', () => {
  const taskEditorSource = readSource('src/components/ecommerce/EcommerceTaskEditorPanel.tsx');

  assert.match(taskEditorSource, /const rootPaddingClassName = compact \? 'p-2\.5' : 'p-3';/);
  assert.match(taskEditorSource, /const textareaMinHeightClassName = compact \? 'min-h-\[56px\]' : 'min-h-\[72px\]';/);
  assert.match(taskEditorSource, /const chipLimit = compact \? 2 : 4;/);
});

test('ecommerce review galleries collapse by default and expose explicit expand toggles', () => {
  const reviewPanelSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');

  assert.match(reviewPanelSource, /const \[expandedGalleryKeys, setExpandedGalleryKeys\] = React\.useState<Record<string, boolean>>\(\{\}\);/);
  assert.match(reviewPanelSource, /const galleryStateKey = `\$\{itemKey\}:\$\{label\}`;/);
  assert.match(reviewPanelSource, /const referenceGalleryHeightClassName = isGalleryExpanded \? 'max-h-56' : 'max-h-28';/);
  assert.match(reviewPanelSource, /data-testid="ecommerce-review-reference-toggle"/);
});

test('ecommerce task editor supports summary-first collapsed editing and the desktop workbench opts in', () => {
  const taskEditorSource = readSource('src/components/ecommerce/EcommerceTaskEditorPanel.tsx');
  const reviewPanelSource = readSource('src/components/ecommerce/EcommerceAnalysisReviewPanel.tsx');
  const desktopWorkbenchSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');

  assert.match(taskEditorSource, /collapsible\?: boolean;/);
  assert.match(taskEditorSource, /defaultExpanded\?: boolean;/);
  assert.match(taskEditorSource, /const \[isExpanded, setIsExpanded\] = React\.useState\(\(\) => !collapsible \|\| defaultExpanded\);/);
  assert.match(taskEditorSource, /data-testid="ecommerce-task-editor-toggle"/);
  assert.match(reviewPanelSource, /collapsible/);
  assert.match(desktopWorkbenchSource, /collapsible/);
});
