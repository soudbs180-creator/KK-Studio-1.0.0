import type { ReferenceImage, EcommerceTaskAssetRoleBinding } from '../../types.ts';
import type { EcommerceAnalysisAsset, EcommerceReferenceMention } from './types.ts';

type ManualReferenceBindingLike = {
  assetRole: EcommerceTaskAssetRoleBinding;
};

function withAliasLabels(bindings: EcommerceTaskAssetRoleBinding[]): EcommerceTaskAssetRoleBinding[] {
  return bindings.map((binding, index) => ({
    ...binding,
    aliasLabel: `图${index + 1}`,
  }));
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

  return withAliasLabels([
    ...rowReferenceRoles,
    ...manualReferenceRoles,
    ...productRoles,
    ...extraReferenceRoles,
  ]);
}
