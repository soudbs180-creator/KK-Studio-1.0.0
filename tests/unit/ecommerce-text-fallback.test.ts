import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { analyzeFallbackEcommerceText } from '../../src/services/ecommerce/text/fallbackTextAnalysis.ts';

describe('ecommerce text fallback analysis', () => {
  test('builds a draft analysis result from extracted doc text', () => {
    const text = `
需求名称：410Y主图与A+
产品名称：410Y

主图
1. 类型：白底图；角度：朝右；主题：产品展示；设计要求：参考图1做白底，参考图2做场景；文案：16.5Gal
2. 类型：场景图；角度：朝左；主题：风速展示；设计要求：参考图1风效加强；文案：Powerful Cooling

A+
模块1；类型：EBC首图；尺寸：970*600；角度：朝右；设计要求：参考图1排版；产品卖点：水箱容量；文案：Hero Copy
模块2；类型：横幅；角度：朝左；设计要求：先电脑端后手机端，desktop hero first, then mobile crop；产品卖点：多场景；文案：Banner Copy
`.trim();

    const result = analyzeFallbackEcommerceText({
      text,
      sourceFileName: 'fallback.pdf',
      sourceFileType: 'pdf',
    });

    assert.equal(result.projectMeta.projectName, '410Y主图与A+');
    assert.equal(result.projectMeta.productName, '410Y');
    assert.equal(result.projectMeta.sourceFileType, 'pdf');
    assert.equal(result.mainImageItems.length, 2);
    assert.equal(result.aPlusGroup.modules.length, 2);

    assert.equal(result.mainImageItems[0].sizePolicy, 'main-default');
    assert.equal(result.mainImageItems[0].referenceMentions[0]?.label, '参考图1');
    assert.equal(result.aPlusGroup.modules[0].sizePolicy, 'sheet-native');
    assert.equal(result.aPlusGroup.modules[0].declaredSizeText, '970*600');
    assert.equal(result.aPlusGroup.modules[1].sizePolicy, 'desktop-then-mobile');
    assert.ok(result.reviewWarnings.length > 0);
  });
});
