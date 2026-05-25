import type {
  EcommerceAPlusSizeTier,
  EcommerceEditableTaskState,
  EcommerceSeriesTemplate,
  EcommerceSizePolicy,
} from '../../types';

export type EcommerceAnalysisSizePolicy = EcommerceSizePolicy;

export interface EcommerceAnalysisAsset {
  assetId: string;
  label: string;
  source: 'reference' | 'product';
  sheetName?: '主图' | 'A+';
  rowIndex?: number;
  anchorRowIndex?: number;
  anchorColRef?: string;
  displayOrder: number;
  previewUrl?: string;
  mimeType?: string;
}

export interface EcommerceAnalysisProjectMeta {
  projectName: string;
  productName: string;
  sourceFileName: string;
  sourceFileType: string;
  submittedAt?: string;
  defaultMainImageSizeHint?: string;
  warnings: string[];
}

export interface EcommerceReferenceMention {
  assetId: string;
  label: string;
  mentionTokens: string[];
  notes?: string;
}

export interface EcommerceAnalysisMainImageItem {
  itemId: string;
  sheet: '主图';
  rowIndex: number;
  sequence: number;
  type: string;
  angle: string;
  theme: string;
  designRequirements: string;
  copyText: string;
  sizePolicy: EcommerceAnalysisSizePolicy;
  sizeTier?: EcommerceAPlusSizeTier;
  referenceAssetIds: string[];
  referenceMentions: EcommerceReferenceMention[];
  productAssetRequired: boolean;
  promptDraft: string;
  resolvedPromptPreview?: string;
  editableTask?: EcommerceEditableTaskState;
  needsReview: boolean;
  reviewWarnings: string[];
}

export interface EcommerceAnalysisAPlusModule {
  moduleId: string;
  sheet: 'A+';
  rowIndex: number;
  moduleName: string;
  type: string;
  declaredSizeText: string;
  angle: string;
  sellingPoints: string;
  designRequirements: string;
  copyText: string;
  sizePolicy: EcommerceAnalysisSizePolicy;
  sizeTier?: EcommerceAPlusSizeTier;
  referenceAssetIds: string[];
  referenceMentions: EcommerceReferenceMention[];
  productAssetRequired: boolean;
  promptDraft: string;
  resolvedPromptPreview?: string;
  editableTask?: EcommerceEditableTaskState;
  needsReview: boolean;
  reviewWarnings: string[];
}

export interface EcommerceAnalysisResult {
  seriesTemplate: EcommerceSeriesTemplate;
  projectMeta: EcommerceAnalysisProjectMeta;
  assets: {
    productAssets: EcommerceAnalysisAsset[];
    referenceAssets: EcommerceAnalysisAsset[];
  };
  mainImageItems: EcommerceAnalysisMainImageItem[];
  aPlusGroup: {
    groupId: string;
    title: string;
    modules: EcommerceAnalysisAPlusModule[];
    groupWarnings: string[];
  };
  reviewWarnings: string[];
}

export interface OpenXmlParsedReferenceSlot {
  cellRef: string;
  columnRef?: string;
  sheetName?: '主图' | 'A+' | string;
  expectedReferenceIndex?: number;
  dispImgId?: string;
  formula?: string;
}

export interface OpenXmlParsedRow {
  rowIndex: number;
  cells: Record<string, string>;
  referenceSlots: OpenXmlParsedReferenceSlot[];
}

export interface OpenXmlParsedSheet {
  name: '主图' | 'A+' | string;
  worksheetPath?: string;
  rows: OpenXmlParsedRow[];
}

export interface OpenXmlWorkbookAsset {
  assetId: string;
  fileName: string;
  mimeType: string;
  previewUrl: string;
  displayOrder: number;
  sheetName?: '主图' | 'A+' | string;
  rowIndex?: number;
  worksheetPath?: string;
  dispImgId?: string;
  embedRid?: string;
  anchorCellRef?: string;
  anchorRowIndex?: number;
  anchorColRef?: string;
  fromRow?: number;
  fromCol?: number;
  linkedCellRefs?: string[];
}

export interface OpenXmlWorkbookParseResult {
  sheets: OpenXmlParsedSheet[];
  mediaAssets: OpenXmlWorkbookAsset[];
  sourceFileName: string;
  sourceFileType: string;
}
