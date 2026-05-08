import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('ecommerce framework workbench lives on the canvas instead of PromptBar after card creation', () => {
  const hookSource = readSource('src/app/useAppPromptBarProps.ts');
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');
  const desktopPanelSource = readSource('src/components/layout/prompt-bar/DesktopComposerEcommercePanel.tsx');
  const canvasNodeSource = readSource('src/components/canvas/PromptNodeComponent.tsx');
  const canvasWorkbenchSource = readSource('src/components/ecommerce/EcommerceCanvasWorkbenchCard.tsx');

  assert.match(hookSource, /const ecommerceFrameworkSummary = React\.useMemo\(\(\) => \{/);
  assert.match(hookSource, /ecommerceFrameworkSummary,/);
  assert.match(promptBarSource, /ecommerceActiveFrameworkId\?: string \| null;/);
  assert.match(promptBarSource, /ecommerceFrameworkSummary\?: \{/);
  assert.match(promptBarSource, /frameworkSummary=\{ecommerceFrameworkSummary\}/);
  assert.match(promptBarSource, /activeFrameworkId=\{ecommerceActiveFrameworkId\}/);
  assert.match(desktopPanelSource, /type EcommerceFrameworkSummary = \{/);
  assert.match(desktopPanelSource, /frameworkSummary\?: EcommerceFrameworkSummary;/);
  assert.match(desktopPanelSource, /activeFrameworkId\?: string \| null;/);
  assert.doesNotMatch(desktopPanelSource, /data-testid="ecommerce-framework-companion-panel"/);
  assert.doesNotMatch(desktopPanelSource, /data-testid="ecommerce-group-overview-workbench"/);
  assert.match(canvasNodeSource, /import EcommerceCanvasWorkbenchCard from '..\/ecommerce\/EcommerceCanvasWorkbenchCard';/);
  assert.match(canvasNodeSource, /ecommerceFrameworkTaskNodes\?: PromptNode\[\];/);
  assert.match(canvasNodeSource, /getPromptNodeBaseCardWidth\(node\)/);
  assert.match(canvasNodeSource, /getPromptNodeCardWidth\(node, isMobile, viewportWidth\)/);
  assert.match(canvasNodeSource, /const ecommerceFrameworkCardClassName = isEcommerceFrameworkCard/);
  assert.match(canvasNodeSource, /px-4 pb-4 pt-3/);
  assert.match(canvasNodeSource, /data-testid="ecommerce-canvas-framework-workbench"/);
  assert.match(canvasWorkbenchSource, /data-testid="ecommerce-canvas-framework-workbench"/);
  assert.match(canvasWorkbenchSource, /const isWorkbenchInteractiveTarget =/);
  assert.match(canvasWorkbenchSource, /const frameworkInputSummary = node\.ecommerce\?\.frameworkMeta\?\.inputSummary \|\| \[\];/);
  assert.match(canvasWorkbenchSource, /data-testid="ecommerce-canvas-framework-input-summary"/);
  assert.match(canvasWorkbenchSource, /data-testid="ecommerce-canvas-framework-reference-summary"/);
  assert.match(canvasWorkbenchSource, /grid min-h-0 gap-4 lg:grid-cols-\[320px_minmax\(0,1fr\)\]/);
  assert.match(canvasWorkbenchSource, /onMouseDownCapture=\{handleWorkbenchPointerDownCapture\}/);
  assert.match(canvasWorkbenchSource, /onTouchStartCapture=\{handleWorkbenchPointerDownCapture\}/);
  assert.match(canvasWorkbenchSource, /onActivateTask\?\.\(selectedTaskNode\);/);
  assert.match(canvasWorkbenchSource, /data-testid="ecommerce-canvas-framework-task-list"/);
  assert.match(canvasWorkbenchSource, /EcommerceTaskEditorPanel/);
});
