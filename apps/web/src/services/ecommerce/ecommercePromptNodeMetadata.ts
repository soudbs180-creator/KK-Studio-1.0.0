import type {
  EcommerceAnalysisAPlusModule,
  EcommerceAnalysisMainImageItem,
} from './types';

export type EcommercePromptNodeMetadataSeed =
  | {
      kind: 'main-image';
      item: EcommerceAnalysisMainImageItem;
    }
  | {
      kind: 'a-plus-module';
      item: EcommerceAnalysisAPlusModule;
    };

export type EcommercePromptNodeMetadata = {
  sourceSheet: '主图' | 'A+';
  sourceRowKey: string;
  theme: string;
};

export function resolveEcommercePromptNodeMetadata(
  seed: EcommercePromptNodeMetadataSeed,
): EcommercePromptNodeMetadata {
  if (seed.kind === 'main-image') {
    return {
      sourceSheet: '主图',
      sourceRowKey: seed.item.itemId,
      theme: seed.item.theme,
    };
  }

  return {
    sourceSheet: 'A+',
    sourceRowKey: seed.item.moduleId,
    theme: seed.item.moduleName,
  };
}
