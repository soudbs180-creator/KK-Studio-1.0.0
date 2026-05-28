import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildPromptOptimizerLocalRulebookResult,
} from '../../apps/web/src/services/llm/promptOptimizerRulebook.ts';

test('short Chinese product prompts become product-hero local rulebook prompts', () => {
  const result = buildPromptOptimizerLocalRulebookResult('白底耳机产品图', 'structure-first', {
    mode: 'image',
    aspectRatio: '1:1',
  });

  assert.equal(result.meta.engine, 'local-rulebook');
  assert.equal(result.meta.ai_status, 'skipped');
  assert.equal(result.meta.route_id, 'product-hero');
  assert.equal(result.params.task_type, 'ecommerce_hero');
  assert.match(result.optimized_prompt_en, /Original intent to preserve exactly: "白底耳机产品图"/);
  assert.match(result.optimized_prompt_en, /premium commercial product photography/i);
  assert.match(result.optimized_prompt_en, /copy-safe/i);
});

test('ui and infographic prompts include text hierarchy and factual constraints', () => {
  const result = buildPromptOptimizerLocalRulebookResult('B2B SaaS 数据看板 UI，显示 ARR 和留存率', 'structure-first', {
    mode: 'image',
    aspectRatio: '16:9',
  });

  assert.equal(result.meta.route_id, 'ui-infographic');
  assert.equal(result.params.task_type, 'ui');
  assert.match(result.optimized_prompt_en, /information hierarchy/i);
  assert.match(result.optimized_prompt_en, /text-safe/i);
  assert.match(result.optimized_prompt_en, /accuracy-sensitive/i);
});

test('reference images add explicit local reference-role guidance', () => {
  const result = buildPromptOptimizerLocalRulebookResult('复刻参考图的包装质感，做一张新品主图', 'structure-first', {
    mode: 'image',
    aspectRatio: '1:1',
    referenceImages: [
      { mimeType: 'image/png', data: 'abc' },
      { mimeType: 'image/jpeg', data: 'def' },
    ],
  });

  assert.match(result.optimized_prompt_en, /Reference image roles: 2 reference images attached/i);
  assert.match(result.optimized_prompt_en, /preserve subject identity, pose\/composition cues, palette, material consistency/i);
  assert.match(result.optimized_prompt_zh_display, /已加入 2 张参考图/);
});

test('ecommerce context preserves product, selling copy, size, and series tone', () => {
  const result = buildPromptOptimizerLocalRulebookResult('生成桌面端 A+ 首图', 'structure-first', {
    mode: 'ecommerce',
    aspectRatio: '16:9',
    imageSize: '2K',
    ecommerceContext: {
      taskState: {
        taskId: 'task-1',
        outputTypeLabel: '桌面端 A+ 首图',
        sparseUserIntent: '突出降噪和轻量佩戴',
        product: {
          name: 'KK Air Pro 耳机',
          category: '无线耳机',
        },
        style: {
          effect: '高级棚拍',
        },
        copy: {
          headline: '沉浸降噪',
          highlight: '全天候舒适佩戴',
          cta: '',
        },
      } as any,
      seriesTemplate: {
        styleProfile: {
          tone: 'premium dark studio',
        },
      } as any,
      assetRoles: [
        { normalizedLabel: '主商品图' },
      ] as any,
      outputTarget: {
        label: '桌面端 A+ 首图',
        aspectRatio: '16:9',
        imageSize: '2K',
      },
    },
  });

  assert.match(result.optimized_prompt_en, /Product name: KK Air Pro 耳机/);
  assert.match(result.optimized_prompt_en, /Copy to preserve: 沉浸降噪 \/ 全天候舒适佩戴/);
  assert.match(result.optimized_prompt_en, /Delivery aspect ratio: 16:9/);
  assert.match(result.optimized_prompt_zh_display, /已保留电商任务里的商品、卖点、尺寸和系列风格/);
});
