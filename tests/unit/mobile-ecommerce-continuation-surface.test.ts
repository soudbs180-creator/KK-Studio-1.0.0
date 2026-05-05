import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import type { GeneratedImage, PromptNode } from '../../src/types.ts';
import { selectMobileFeedResults } from '../../src/components/mobile/mobileFeedSelectors.ts';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function createPromptNode(overrides: Partial<PromptNode> = {}): PromptNode {
  return {
    id: 'prompt-default',
    prompt: 'Default prompt',
    originalPrompt: 'Default prompt',
    childImageIds: [],
    referenceImages: [],
    timestamp: 0,
    modelLabel: 'Default model',
    ...overrides,
  } as PromptNode;
}

function createImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'image-default',
    url: 'https://example.com/default.png',
    prompt: 'Default image prompt',
    timestamp: 0,
    parentPromptId: '',
    model: 'default-model',
    modelLabel: 'Default model',
    aspectRatio: '1:1' as GeneratedImage['aspectRatio'],
    imageSize: '1K' as GeneratedImage['imageSize'],
    ...overrides,
  } as GeneratedImage;
}

describe('mobile ecommerce continuation surface', () => {
  test('projects ecommerce continuation metadata into mobile result entries', () => {
    const prompt = createPromptNode({
      id: 'prompt-ecom',
      prompt: 'Ecommerce prompt',
      ecommerce: {
        kind: 'a-plus-module',
        sourceSheet: 'A+',
        sourceRowKey: 'module-hero',
        displayLabel: 'A+ 21:9 4K',
        selectedForGeneration: false,
        stage: 'generated',
        desktopStage: 'generated',
        mobileStage: 'locked',
        declaredSizeText: '21:9 4K',
        needsReview: true,
        reviewWarnings: ['Need confirm'],
        editableTask: {
          taskId: 'task-hero',
          sourceKind: 'a-plus-module',
          sourceSheet: 'A+',
          sourceRowKey: 'module-hero',
          theme: 'Hero',
          outputTypeLabel: 'A+ Hero Banner',
          imageRoleSummary: ['产品图', '参考图 1'],
          sparseUserIntent: '参考图一的构图，产品图保持主体清晰',
          copy: {
            headline: 'headline',
            subheadline: 'subheadline',
            highlight: 'highlight',
            featureTags: [],
            cta: 'cta',
          },
          style: {
            tone: '专业冷静',
            atmosphere: '清爽',
            effect: '高光质感',
            backgroundType: '纯色',
          },
          layout: {
            productSize: 'balanced',
            textPosition: 'right',
            accessoryPolicy: 'minimal',
          },
          inherit: {
            keepSeriesStyle: true,
            keepFontStyle: true,
            keepLayoutStyle: true,
            keepCopyStyle: true,
            keepPalette: true,
          },
          assetRoles: [
            {
              assetId: 'product-1',
              role: 'product',
              label: '产品图',
              normalizedLabel: '产品图',
              source: 'analysis',
            },
            {
              assetId: 'ref-1',
              role: 'reference',
              label: '参考图一',
              normalizedLabel: '参考图一',
              source: 'analysis',
            },
          ],
          consistencyChecks: [],
          missingFields: [],
          resolvedPromptPreview: 'A+ Hero Prompt',
          displayLabel: 'A+ 21:9 4K',
        },
      } as PromptNode['ecommerce'],
    });
    const image = createImage({
      id: 'image-ecom',
      parentPromptId: 'prompt-ecom',
      displayLabel: undefined,
    });

    const [result] = selectMobileFeedResults([prompt], [image]);

    assert.equal(result.displayLabel, 'A+ 21:9 4K');
    assert.equal(result.ecommerceContinuation?.taskId, 'task-hero');
    assert.equal(result.ecommerceContinuation?.kind, 'a-plus-module');
    assert.equal(result.ecommerceContinuation?.sourceSheet, 'A+');
    assert.equal(result.ecommerceContinuation?.sourceRowKey, 'module-hero');
    assert.equal(result.ecommerceContinuation?.outputTypeLabel, 'A+ Hero Banner');
    assert.equal(result.ecommerceContinuation?.selectedForGeneration, false);
    assert.equal(result.ecommerceContinuation?.declaredSizeText, '21:9 4K');
    assert.equal(result.ecommerceContinuation?.stageLabel, '待复核');
    assert.equal(
      result.ecommerceContinuation?.taskPrompt,
      '参考图一的构图，产品图保持主体清晰',
    );
    assert.deepEqual(
      result.ecommerceContinuation?.assetRoles?.map(({ assetId, role, label }) => ({ assetId, role, label })),
      [
        { assetId: 'product-1', role: 'product', label: '产品图' },
        { assetId: 'ref-1', role: 'reference', label: '参考图一' },
      ],
    );
  });

  test('threads ecommerce continuation actions from app into the mobile detail screen', () => {
    const appSource = readSource('src/App.tsx');
    const surfaceSource = readSource('src/components/mobile/MobileWorkspaceSurface.tsx');
    const detailSource = readSource('src/components/mobile/MobileResultDetailScreen.tsx');

    assert.match(appSource, /onEditEcommerceTask=/);
    assert.match(appSource, /onConfirmEcommerceDesktop=/);
    assert.match(appSource, /onGenerateEcommerceMobile=/);
    assert.match(appSource, /onToggleEcommerceSelected=/);

    assert.match(surfaceSource, /onEditEcommerceTask:/);
    assert.match(surfaceSource, /onConfirmEcommerceDesktop:/);
    assert.match(surfaceSource, /onGenerateEcommerceMobile:/);
    assert.match(surfaceSource, /onToggleEcommerceSelected:/);

    assert.match(detailSource, /data-testid="mobile-ecommerce-continuation-panel"/);
    assert.match(detailSource, /编辑任务/);
    assert.match(detailSource, /确认桌面版/);
    assert.match(detailSource, /生成手机版/);
    assert.match(detailSource, /确认生成/);
    assert.match(detailSource, /当前需求/);
    assert.match(detailSource, /产品图/);
    assert.match(detailSource, /参考图/);
  });

  test('localizes mobile framework queue chrome instead of hard-coding English labels', () => {
    const detailSource = readSource('src/components/mobile/MobileResultDetailScreen.tsx');

    assert.match(detailSource, /import \{ useLocale \} from '\.\.\/\.\.\/context\/LocaleContext';/);
    assert.match(detailSource, /const \{ pick \} = useLocale\(\);/);
    assert.doesNotMatch(detailSource, />\s*Framework Queue\s*</);
    assert.doesNotMatch(detailSource, /\? 'Paused' : 'Running'/);
    assert.doesNotMatch(detailSource, />Queued \{frameworkStatus\.queued\}/);
    assert.doesNotMatch(detailSource, />Running \{frameworkStatus\.running\}/);
    assert.doesNotMatch(detailSource, />Failed \{frameworkStatus\.failed\}/);
    assert.doesNotMatch(detailSource, />Total \{frameworkStatus\.total\}/);
  });
});
