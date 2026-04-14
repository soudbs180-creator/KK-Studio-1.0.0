import type { EcommerceReferenceMention, OpenXmlWorkbookAsset } from '../types.ts';

const RIGHT_TOKENS = ['右边', '右侧', '右图', '参考右边', '参考右侧', '参考右图'];
const LEFT_TOKENS = ['左边', '左侧', '左图', '参考左边', '参考左侧', '参考左图'];

export function resolveReferenceBindings(params: {
  assets: OpenXmlWorkbookAsset[];
  designRequirements?: string;
  copyText?: string;
}): {
  mentions: EcommerceReferenceMention[];
  needsReview: boolean;
  reviewWarnings: string[];
} {
  const combined = `${params.designRequirements || ''} ${params.copyText || ''}`;
  const mentions: EcommerceReferenceMention[] = [];
  const reviewWarnings: string[] = [];
  let explicitMentionCount = 0;

  params.assets.forEach((asset, index) => {
    const label = `参考图${index + 1}`;
    const tokens: string[] = [];
    const notes: string[] = [];

    const numberedPattern = new RegExp(`(?:参考图|图)${index + 1}`, 'g');
    if (numberedPattern.test(combined)) {
      tokens.push(`参考图${index + 1}`);
      explicitMentionCount += 1;
    }

    if (index === 0 && LEFT_TOKENS.some((token) => combined.includes(token))) {
      tokens.push('左边');
      explicitMentionCount += 1;
    }

    if (index === params.assets.length - 1 && RIGHT_TOKENS.some((token) => combined.includes(token))) {
      tokens.push('右边');
      explicitMentionCount += 1;
    }

    if (asset.anchorColRef) {
      notes.push(`默认锚点：${asset.anchorColRef}${asset.anchorRowIndex || asset.rowIndex || ''}`);
    }

    if (tokens.length === 0) {
      notes.push('未检测到明确引用，默认按顺序理解。');
    }

    mentions.push({
      assetId: asset.assetId,
      label,
      mentionTokens: tokens,
      notes: notes.length > 0 ? notes.join(' ') : undefined,
    });
  });

  const explicitOutOfRange = combined.match(/(?:参考图|图)(\d+)/g) || [];
  for (const token of explicitOutOfRange) {
    const match = token.match(/(\d+)/);
    const index = match ? Number(match[1]) : 0;
    if (index > 0 && index > params.assets.length) {
      reviewWarnings.push(`检测到 ${token}，但该条目只解析出 ${params.assets.length} 张参考图。`);
    }
  }

  if (params.assets.length > 1 && explicitMentionCount === 0) {
    reviewWarnings.push('存在多张参考图，但文本中未检测到明确的编号引用。');
  }

  return {
    mentions,
    needsReview: reviewWarnings.length > 0,
    reviewWarnings,
  };
}
