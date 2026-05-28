import type { ReferenceImage, EcommerceTaskAssetRoleBinding } from '../../types';
import type { EcommerceAnalysisAsset, EcommerceReferenceMention } from './types';

type ManualReferenceBindingLike = {
  assetRole: EcommerceTaskAssetRoleBinding;
};

function cleanText(value: string | undefined): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sanitizeAnchorSegment(value: string): string {
  return cleanText(value)
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'ref';
}

function buildAnchorId(binding: EcommerceTaskAssetRoleBinding): string {
  return `${binding.role}:${sanitizeAnchorSegment(binding.assetId || binding.label)}`;
}

function buildStableTokenSuffix(binding: EcommerceTaskAssetRoleBinding): string {
  const normalized = sanitizeAnchorSegment(binding.assetId || binding.label);
  return normalized.length > 10 ? normalized.slice(-10) : normalized;
}

function inferReferenceRoleLabel(
  binding: EcommerceTaskAssetRoleBinding,
  fallback: string,
): string {
  const combinedText = [
    binding.label,
    binding.normalizedLabel,
    binding.note,
    ...(binding.mentionTokens || []),
  ].join(' ');

  if (/产品|主体|main product|product/i.test(combinedText)) return '产品参考';
  if (/风格|色调|配色|光影|氛围|质感|style|tone|palette/i.test(combinedText)) return '风格参考';
  if (/版式|构图|排版|布局|layout|composition/i.test(combinedText)) return '版式参考';
  if (/场景|背景|环境|scene|background/i.test(combinedText)) return '场景参考';
  if (/文案|文字|copy|text/i.test(combinedText)) return '文案参考';

  return fallback;
}

function withReferenceAnchors(bindings: EcommerceTaskAssetRoleBinding[]): EcommerceTaskAssetRoleBinding[] {
  const roleLabelByIndex = bindings.map((binding, index) => {
    if (binding.role === 'product') {
      return index === bindings.findIndex((item) => item.role === 'product') ? '产品主图' : '产品辅图';
    }

    if (binding.role === 'extra-reference') {
      return inferReferenceRoleLabel(binding, '风格参考');
    }

    if (binding.role === 'series-template') {
      return '系列风格参考';
    }

    return inferReferenceRoleLabel(binding, binding.source === 'upload' ? '任务参考' : '需求参考');
  });
  const labelCounts = roleLabelByIndex.reduce<Record<string, number>>((counts, roleLabel) => {
    counts[roleLabel] = (counts[roleLabel] || 0) + 1;
    return counts;
  }, {});

  return bindings.map((binding, index) => {
    const roleLabel = roleLabelByIndex[index];
    const token = labelCounts[roleLabel] > 1
      ? `@${roleLabel}-${buildStableTokenSuffix(binding)}`
      : `@${roleLabel}`;

    return {
      ...binding,
      anchorId: binding.anchorId || buildAnchorId(binding),
      token: binding.token || token,
      roleLabel: binding.roleLabel || roleLabel,
      aliasLabel: binding.aliasLabel || token,
    };
  });
}

export function buildEcommerceAssetRoleBindings(params: {
  rowAssets: Array<Pick<EcommerceAnalysisAsset, 'assetId' | 'label'>>;
  rowMentions: Array<Pick<EcommerceReferenceMention, 'assetId' | 'label' | 'mentionTokens' | 'notes'>>;
  manualReferences: ManualReferenceBindingLike[];
  productReferences: Array<Pick<ReferenceImage, 'id' | 'storageId'>>;
  extraReferences: Array<Pick<ReferenceImage, 'id' | 'storageId'>>;
}): EcommerceTaskAssetRoleBinding[] {
  const rowReferenceRoles = params.rowAssets.map((asset, index) => {
    const mention = params.rowMentions.find((item) => item.assetId === asset.assetId) || params.rowMentions[index];
    const label = mention?.label || `参考图${index + 1}`;

    return {
      assetId: asset.assetId,
      role: 'reference' as const,
      label,
      normalizedLabel: label,
      source: 'analysis' as const,
      note: mention?.notes,
      mentionTokens: mention?.mentionTokens,
    };
  });

  const manualReferenceRoles = params.manualReferences.map((reference, index) => ({
    ...reference.assetRole,
    role: 'reference' as const,
    label: reference.assetRole.label || `手动参考图${index + 1}`,
    normalizedLabel: reference.assetRole.normalizedLabel || reference.assetRole.label || `手动参考图${index + 1}`,
  }));

  const productRoles = params.productReferences.map((referenceImage, index) => ({
    assetId: referenceImage.storageId || referenceImage.id,
    role: 'product' as const,
    label: `产品图${index + 1}`,
    normalizedLabel: index === 0 ? '产品图' : `产品图${index + 1}`,
    source: 'upload' as const,
  }));

  const extraReferenceRoles = params.extraReferences.map((referenceImage, index) => ({
    assetId: referenceImage.storageId || referenceImage.id,
    role: 'extra-reference' as const,
    label: `补充参考图${index + 1}`,
    normalizedLabel: `补充参考图${index + 1}`,
    source: 'upload' as const,
  }));

  return withReferenceAnchors([
    ...rowReferenceRoles,
    ...manualReferenceRoles,
    ...productRoles,
    ...extraReferenceRoles,
  ]);
}
