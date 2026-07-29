import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  createImageCardViewModel,
  createPromptCardViewModel,
  createWorkflowCardViewModel,
} from '../../apps/web/src/canvas/v3/adapters.ts';
import {
  getCanvasV3CardWidth,
  resolveCanvasV3DetailLevel,
} from '../../apps/web/src/canvas/v3/cardGeometry.ts';
import { UI_SYSTEM_TOKENS } from '@kk/ui/core';
import { KK_LAYOUT } from '@kk/ui/layout';

test('Canvas V3 maps prompt modes and runtime states without changing persisted nodes', () => {
  const promptNode = {
    id: 'prompt-1',
    prompt: 'Create a cinematic city at night',
    originalPrompt: '夜晚的电影感城市',
    position: { x: 120, y: 240 },
    aspectRatio: '16:9',
    imageSize: '1K',
    model: 'veo-3.1',
    mode: 'video',
    videoDuration: '8s',
    videoResolution: '1080p',
    isGenerating: true,
    parallelCount: 2,
    creditCost: 16,
    childImageIds: ['video-1'],
    timestamp: 1,
  } as const;

  const viewModel = createPromptCardViewModel(promptNode);

  assert.equal(viewModel.kind, 'video');
  assert.equal(viewModel.status, 'running');
  assert.equal(viewModel.width, 320);
  assert.equal(viewModel.headerHeight, 36);
  assert.equal(viewModel.footerHeight, 36);
  assert.equal(viewModel.position, promptNode.position);
  assert.equal(viewModel.metadata.length, 3);
  assert.deepEqual(viewModel.actions.slice(0, 2).map((action) => action.id), ['edit', 'run']);
  assert.equal(viewModel.ports.some((port) => port.direction === 'output'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(promptNode, 'viewModel'), false);
});

test('Canvas V3 maps every supported content family to a content-fit card', () => {
  const image = createImageCardViewModel({
    id: 'image-1',
    url: 'data:image/png;base64,AA==',
    prompt: 'Product hero',
    aspectRatio: '1:1',
    imageSize: '2K',
    timestamp: 1,
    model: 'nano-banana',
    canvasId: 'canvas-1',
    parentPromptId: 'prompt-1',
    position: { x: 400, y: 240 },
    creditCost: 10,
  });
  assert.equal(image.kind, 'image');
  assert.equal(image.status, 'succeeded');
  assert.equal(image.media?.type, 'image');
  assert.equal(image.actions.some((action) => action.id === 'download'), true);

  const workflowKinds = [
    ['agent', 'agent'],
    ['preview', 'preview'],
    ['save', 'save'],
    ['storyboard', 'storyboard'],
    ['workflow-panel', 'workflow'],
  ] as const;
  for (const [sourceKind, expectedKind] of workflowKinds) {
    const card = createWorkflowCardViewModel({
      id: `${sourceKind}-1`,
      kind: sourceKind,
      label: sourceKind,
      position: { x: 0, y: 0 },
      data: {},
    });
    assert.equal(card.kind, expectedKind);
    assert.equal(card.heightMode, 'content');
    assert.ok(card.actions.length > 0);
  }
});

test('Canvas V3 enforces three card widths and full to compact to thumbnail LOD', () => {
  assert.equal(getCanvasV3CardWidth('compact'), 280);
  assert.equal(getCanvasV3CardWidth('standard'), 320);
  assert.equal(getCanvasV3CardWidth('wide'), 420);
  assert.equal(resolveCanvasV3DetailLevel(1), 'full');
  assert.equal(resolveCanvasV3DetailLevel(0.45), 'compact');
  assert.equal(resolveCanvasV3DetailLevel(0.16), 'thumbnail-shell');
});

test('Canvas V3 geometry and edge states come from the shared UI contract', () => {
  assert.deepEqual(KK_LAYOUT.workspace.canvasCardWidths, {
    compact: 280,
    standard: 320,
    wide: 420,
  });
  assert.equal(KK_LAYOUT.workspace.canvasCardHeaderHeight, 36);
  assert.equal(KK_LAYOUT.workspace.canvasCardFooterHeight, 36);
  assert.equal(KK_LAYOUT.workspace.canvasCardRadius, 14);
  assert.equal(KK_LAYOUT.workspace.canvasPortVisibleSize, 6);
  assert.equal(KK_LAYOUT.workspace.canvasPortHitSize, 20);
  assert.equal(KK_LAYOUT.workspace.canvasPortMobileHitSize, 44);
  assert.deepEqual(UI_SYSTEM_TOKENS.canvas.edge, {
    idle: 'rgba(255, 255, 255, 0.18)',
    disabled: 'rgba(255, 255, 255, 0.08)',
    selected: 'oklch(0.5926 0.2236 258.42)',
  });

  const cardGeometrySource = fs.readFileSync('apps/web/src/canvas/v3/cardGeometry.ts', 'utf8');
  const edgeGeometrySource = fs.readFileSync('apps/web/src/canvas/v3/edgeGeometry.ts', 'utf8');
  assert.match(cardGeometrySource, /from '@kk\/ui\/layout'/);
  assert.match(edgeGeometrySource, /from '@kk\/ui\/core'/);
});

test('Canvas V3 production card surfaces contain no Frost, Clay, gradient, blur, or giant ecommerce width', () => {
  const sources = [
    fs.readFileSync('apps/web/src/canvas/v3/CanvasV3Card.tsx', 'utf8'),
    fs.readFileSync('apps/web/src/workflow/nodes/WorkflowUtilityCard.tsx', 'utf8'),
  ].join('\n');
  const cardCss = fs.readFileSync('apps/web/src/styles/canvas-v3.css', 'utf8');
  const promptWidth = fs.readFileSync('apps/web/src/utils/promptNodeCardWidth.ts', 'utf8');
  const imageMetrics = fs.readFileSync('apps/web/src/utils/styleUtils.ts', 'utf8');

  assert.doesNotMatch(sources, /frost|clay|backdrop-filter|linear-gradient|active:scale/i);
  assert.match(cardCss, /\.kk-canvas-v3-card/);
  assert.match(cardCss, /border-radius:\s*14px/);
  assert.doesNotMatch(cardCss, /backdrop-filter|linear-gradient|radial-gradient/i);
  assert.match(promptWidth, /ECOMMERCE_FRAMEWORK_PROMPT_CARD_WIDTH\s*=\s*420/);
  assert.doesNotMatch(promptWidth, /1128/);
  assert.match(imageMetrics, /FOOTER_HEIGHT\s*=\s*36/);
});

test('Prompt cards do not retain an unconditional spacer that inflates short content', () => {
  const promptCard = fs.readFileSync('apps/web/src/components/canvas/PromptNodeComponent.tsx', 'utf8');
  assert.doesNotMatch(promptCard, /className="h-3 mt-3"/);
});

test('Editable workflow cards use content-fit V3 geometry instead of legacy fixed panels', () => {
  const workflowPanel = fs.readFileSync('apps/web/src/components/canvas/WorkflowPanelCard.tsx', 'utf8');
  assert.match(workflowPanel, /kk-canvas-v3-workflow-editor/);
  assert.match(workflowPanel, /max-h-\[min\(50vh,352px\)\]/);
  assert.doesNotMatch(workflowPanel, /node\.height\s*\|\|\s*420|h-\[309px\]|h-\[60px\]/);
});

test('Canvas controls share one left rail without a duplicate view toolbar', () => {
  const projectManager = fs.readFileSync('apps/web/src/components/settings/ProjectManager.tsx', 'utf8');
  const workspaceCss = fs.readFileSync('apps/web/src/styles/workspace-ui-v3.css', 'utf8');
  const projectRail = projectManager.match(/<div className="kk-project-rail[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] || '';

  assert.match(projectRail, /data-canvas-interaction-mode="normal"/);
  assert.match(projectRail, /data-canvas-interaction-mode="board"/);
  assert.match(projectRail, /data-canvas-grid-toggle="true"/);
  assert.match(projectRail, /fitToAll|resetView|autoArrange/);
  assert.doesNotMatch(projectManager, /className="kk-canvas-view-tools/);
  assert.match(workspaceCss, /\.kk-project-rail-host\s*\{[\s\S]*width:\s*38px/);
  assert.doesNotMatch(projectManager, /var\(--frost-card-framework-(bg|border|shadow|blur)\)/);
});
