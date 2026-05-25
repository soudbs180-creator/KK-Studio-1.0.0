import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildNextEcommerceGroupSlots,
  resolveLatestEcommerceSlotImageFromCanvas,
  sanitizeEcommerceExportName,
} from '../../apps/web/src/app/useEcommerceGroupExportRuntime.ts';
import { AspectRatio, GenerationMode, ImageSize, type GeneratedImage, type PromptNode } from '../../apps/web/src/types.ts';
import type { EcommerceGroupSlotState } from '../../apps/web/src/services/ecommerce/groupSlotState.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function createEcommercePromptNode(
  id: string,
  sourceRowKey: string,
  taskId: string,
): PromptNode {
  return {
    id,
    prompt: id,
    position: { x: 0, y: 0 },
    aspectRatio: AspectRatio.SQUARE,
    imageSize: ImageSize.SIZE_1K,
    model: 'gemini-3.1-flash-image-preview',
    childImageIds: [],
    timestamp: 1,
    mode: GenerationMode.ECOMMERCE,
    ecommerce: {
      kind: 'main-image',
      sourceSheet: '主图',
      sourceRowKey,
      stage: 'analysis_ready',
      editableTask: {
        taskId,
        sourceKind: 'main-image',
        sourceSheet: '主图',
        sourceRowKey,
        theme: '',
        outputTypeLabel: '主图',
        imageRoleSummary: [],
        sparseUserIntent: '',
        copy: { headline: '', subheadline: '', highlight: '', featureTags: [], cta: '' },
        style: { tone: '', atmosphere: '', effect: '', backgroundType: '' },
        layout: { productSize: 'balanced', textPosition: 'top-left', accessoryPolicy: 'auto' },
        inherit: {
          keepSeriesStyle: true,
          keepFontStyle: true,
          keepLayoutStyle: true,
          keepCopyStyle: true,
          keepPalette: true,
        },
        assetRoles: [],
        consistencyChecks: [],
        missingFields: [],
        resolvedPromptPreview: '',
        displayLabel: '',
      },
    },
  } as PromptNode;
}

function createSlot(sourceKey: string): EcommerceGroupSlotState {
  return {
    slotId: `${sourceKey}-slot`,
    groupKey: 'main',
    sourceKey,
    selected: true,
    currentImageId: null,
    currentSource: null,
    deliveries: [
      {
        deliveryKind: 'desktop',
        label: 'desktop',
        aspectRatio: AspectRatio.LANDSCAPE_21_9,
        currentImageId: null,
        currentSource: null,
        history: [],
      } as any,
    ],
    history: [],
  };
}

function createImage(
  id: string,
  parentPromptId: string,
  timestamp: number,
  ecommerceDeliveryKind?: GeneratedImage['ecommerceDeliveryKind'],
): GeneratedImage {
  return {
    id,
    url: `data:image/png;base64,${id}`,
    prompt: id,
    timestamp,
    parentPromptId,
    mimeType: 'image/png',
    ecommerceDeliveryKind,
  } as GeneratedImage;
}

test('ecommerce group export runtime owns slot sync and export wiring', () => {
  const hookPath = path.join(ROOT_DIR, 'apps/web/src/app/useEcommerceGroupExportRuntime.ts');
  assert.equal(existsSync(hookPath), true, 'apps/web/src/app/useEcommerceGroupExportRuntime.ts should exist');

  const appSource = readSource('apps/web/src/App.tsx');
  const hookSource = readSource('apps/web/src/app/useEcommerceGroupExportRuntime.ts');

  assert.match(hookSource, /export interface UseEcommerceGroupExportRuntimeDeps \{/);
  assert.match(hookSource, /export interface UseEcommerceGroupExportRuntimeResult \{/);
  assert.match(hookSource, /handleExportEcommerceGroup: \(groupNode: PromptNode\) => Promise<void>;/);
  assert.match(hookSource, /resolveLatestEcommerceSlotImage: \(node: PromptNode, deliveryKind\?: 'default' \| 'desktop' \| 'mobile'\) => EcommerceLatestSlotImage \| null;/);
  assert.match(hookSource, /buildEcommerceGroupExportManifest/);
  assert.match(hookSource, /applyEcommerceSlotResult/);
  assert.match(hookSource, /new JSZip\(\)/);
  assert.match(hookSource, /saveEcommerceBlob\(content,/);

  assert.match(appSource, /import \{[^}]*useEcommerceGroupExportRuntime[^}]*\} from '\.\/app\/useEcommerceGroupExportRuntime';/);
  assert.match(appSource, /const \{\s*handleExportEcommerceGroup\s*\} = useEcommerceGroupExportRuntime\(\{/);
  assert.match(appSource, /resolvePptImageBlob,/);
  assert.match(appSource, /activeCanvasRef,/);
  assert.match(appSource, /setEcommerceGroupExportState:/);

  assert.doesNotMatch(appSource, /const sanitizeEcommerceExportName = useCallback/);
  assert.doesNotMatch(appSource, /const resolveLatestEcommerceSlotImage = useCallback/);
  assert.doesNotMatch(appSource, /const handleExportEcommerceGroup = useCallback/);
  assert.doesNotMatch(appSource, /applyEcommerceSlotResult\(nextGroupSlots/);
  assert.doesNotMatch(appSource, /buildEcommerceGroupExportManifest\(\{/);
  assert.doesNotMatch(appSource, /new JSZip\(\)/);
});

test('group export helpers resolve latest generated/redraw images and sync slot state', () => {
  const promptNode = createEcommercePromptNode('prompt-1', 'row-1', 'task-1');
  const redrawPromptNode = {
    ...createEcommercePromptNode('redraw-1', 'row-1-redraw', 'task-1'),
    partialRedraw: {
      inheritedTaskState: promptNode.ecommerce?.editableTask,
    },
  } as PromptNode;
  const generated = createImage('generated-latest', 'prompt-1', 10);
  const redraw = createImage('redraw-latest', 'redraw-1', 20);
  const desktop = createImage('desktop-latest', 'prompt-1', 15, 'desktop');
  const canvas = {
    promptNodes: [promptNode, redrawPromptNode],
    imageNodes: [generated, redraw, desktop],
  };

  assert.equal(sanitizeEcommerceExportName('A+/主图: 01', 'fallback'), 'A+-主图--01');
  assert.equal(sanitizeEcommerceExportName('', 'fallback'), 'fallback');

  const latest = resolveLatestEcommerceSlotImageFromCanvas(canvas, promptNode);
  assert.equal(latest?.image.id, 'redraw-latest');
  assert.equal(latest?.latestSource, 'redraw');

  const latestDesktop = resolveLatestEcommerceSlotImageFromCanvas(canvas, promptNode, 'desktop');
  assert.equal(latestDesktop?.image.id, 'desktop-latest');
  assert.equal(latestDesktop?.latestSource, 'generated');

  const nextSlots = buildNextEcommerceGroupSlots({
    promptNodes: [promptNode],
    previousGroupSlots: {
      '主图': [createSlot('row-1')],
      'A+': [],
    },
    selectedItems: { 'row-1': false },
    resolveLatestSlotImage: (node, deliveryKind) => resolveLatestEcommerceSlotImageFromCanvas(canvas, node, deliveryKind),
  });

  const nextSlot = nextSlots['主图'][0];
  assert.equal(nextSlot?.selected, false);
  assert.deepEqual(nextSlot?.history.map((entry) => entry.imageId), ['redraw-latest', 'desktop-latest']);
  assert.equal(nextSlot?.currentImageId, 'desktop-latest');
  assert.equal(nextSlot?.currentSource, 'generated');
  assert.equal(nextSlot?.deliveries[0]?.currentImageId, 'desktop-latest');
  assert.equal(nextSlot?.deliveries[0]?.currentSource, 'generated');
});
